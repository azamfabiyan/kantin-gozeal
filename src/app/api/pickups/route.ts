import { NextRequest } from 'next/server'
import { db, isTurso, turso, toISO } from '@/lib/db'
import { getEmployeeFromRequest, getActivePeriod } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const emp = await getEmployeeFromRequest(req)
  if (!emp) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId') || emp.id

  if (employeeId !== emp.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (isTurso && turso) {
    const r = await turso.execute({
      sql: `SELECT p.id, p.employeeId, p.variantId, p.type, p.period, p.timestamp,
                   v.id as v_id, v.name as v_name, v.type as v_type
            FROM Pickup p
            LEFT JOIN Variant v ON v.id = p.variantId
            WHERE p.employeeId = ?
            ORDER BY p.timestamp DESC`,
      args: [employeeId],
    })
    return Response.json({
      history: r.rows.map((row) => ({
        id: String(row.id),
        employeeId: String(row.employeeId),
        variantId: String(row.variantId),
        type: String(row.type) as 'FOOD' | 'DRINK',
        period: String(row.period),
        timestamp: toISO(row.timestamp),
        variant: row.v_id ? { id: String(row.v_id), name: String(row.v_name), type: String(row.v_type) as 'FOOD' | 'DRINK' } : undefined,
      })),
    })
  }

  const history = await (db as PrismaClient).pickup.findMany({
    where: { employeeId },
    orderBy: { timestamp: 'desc' },
    include: { variant: true },
  })
  return Response.json({
    history: history.map((p) => ({
      id: p.id,
      employeeId: p.employeeId,
      variantId: p.variantId,
      type: p.type as 'FOOD' | 'DRINK',
      period: p.period,
      timestamp: p.timestamp.toISOString(),
      variant: p.variant ? { id: p.variant.id, name: p.variant.name, type: p.variant.type as 'FOOD' | 'DRINK' } : undefined,
    })),
  })
}

export async function POST(req: NextRequest) {
  const emp = await getEmployeeFromRequest(req)
  if (!emp) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { employeeId, variantId } = await req.json()
    if (!employeeId || !variantId) {
      return Response.json({ error: 'employeeId dan variantId wajib diisi' }, { status: 400 })
    }
    if (employeeId !== emp.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const period = await getActivePeriod()
    const nowIso = new Date().toISOString()

    if (isTurso && turso) {
      // Manual transaction via batch (libsql batch is atomic).
      // 1) Lookup variant and balance.
      const variantR = await turso.execute({
        sql: 'SELECT id, name, type, stock, active FROM Variant WHERE id = ?',
        args: [String(variantId)],
      })
      if (variantR.rows.length === 0) {
        return Response.json({ error: 'Variant tidak ditemukan' }, { status: 400 })
      }
      const variant = variantR.rows[0]
      const variantIdDb = String(variant.id)
      const variantStock = Number(variant.stock)
      const variantActive = variant.active === 1 || variant.active === true || variant.active === 1n
      if (!variantActive) {
        return Response.json({ error: 'Variant tidak aktif' }, { status: 400 })
      }
      if (variantStock <= 0) {
        return Response.json({ error: 'Stok habis' }, { status: 400 })
      }

      const balanceR = await turso.execute({
        sql: 'SELECT id, balance FROM EmployeeBalance WHERE employeeId = ? AND variantId = ?',
        args: [emp.id, variantIdDb],
      })
      if (balanceR.rows.length === 0 || Number(balanceR.rows[0].balance) <= 0) {
        return Response.json({
          error: `Saldo ${String(variant.name)} habis. Tunggu periode berikutnya untuk dapat saldo baru.`,
        }, { status: 400 })
      }
      const balanceId = String(balanceR.rows[0].id)
      const curBalance = Number(balanceR.rows[0].balance)

      const pickupId = crypto.randomUUID()
      // Execute as a single batch (atomic in libsql/Turso)
      await turso.batch([
        {
          sql: 'INSERT INTO Pickup (id, employeeId, variantId, type, period, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
          args: [pickupId, emp.id, variantIdDb, String(variant.type), period, nowIso],
        },
        {
          sql: 'UPDATE Variant SET stock = ?, updatedAt = ? WHERE id = ?',
          args: [variantStock - 1, nowIso, variantIdDb],
        },
        {
          sql: 'UPDATE EmployeeBalance SET balance = ?, updatedAt = ? WHERE id = ?',
          args: [curBalance - 1, nowIso, balanceId],
        },
        {
          sql: 'INSERT INTO StockHistory (id, variantId, changeType, amount, oldStock, newStock, note, changedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [
            crypto.randomUUID(),
            variantIdDb,
            'PICKUP_DECREMENT',
            -1,
            variantStock,
            variantStock - 1,
            `Pengambilan oleh ${emp.name} (${emp.code})`,
            emp.name,
            nowIso,
          ],
        },
      ])

      await broadcastEvent('pickup:created', {
        id: pickupId,
        employeeId: emp.id,
        variantId: variantIdDb,
      })

      return Response.json({
        pickup: {
          id: pickupId,
          employeeId: emp.id,
          variantId: variantIdDb,
          type: String(variant.type) as 'FOOD' | 'DRINK',
          period,
          timestamp: nowIso,
          variant: { id: variantIdDb, name: String(variant.name), type: String(variant.type) as 'FOOD' | 'DRINK' },
        },
      })
    }

    // Prisma mode (local dev)
    const result = await (db as PrismaClient).$transaction(async (tx) => {
      const variant = await tx.variant.findUnique({ where: { id: String(variantId) } })
      if (!variant) throw new Error('Variant tidak ditemukan')
      if (!variant.active) throw new Error('Variant tidak aktif')
      if (variant.stock <= 0) throw new Error('Stok habis')
      const balance = await tx.employeeBalance.findUnique({
        where: { employeeId_variantId: { employeeId: emp.id, variantId: variant.id } },
      })
      if (!balance || balance.balance <= 0) {
        throw new Error(`Saldo ${variant.name} habis. Tunggu periode berikutnya untuk dapat saldo baru.`)
      }
      const [pickup] = await Promise.all([
        tx.pickup.create({
          data: { employeeId: emp.id, variantId: variant.id, type: variant.type, period },
        }),
        tx.variant.update({ where: { id: variant.id }, data: { stock: variant.stock - 1 } }),
        tx.employeeBalance.update({ where: { id: balance.id }, data: { balance: balance.balance - 1 } }),
        tx.stockHistory.create({
          data: {
            variantId: variant.id,
            changeType: 'PICKUP_DECREMENT',
            amount: -1,
            oldStock: variant.stock,
            newStock: variant.stock - 1,
            note: `Pengambilan oleh ${emp.name} (${emp.code})`,
            changedBy: emp.name,
          },
        }),
      ])
      return tx.pickup.findUnique({ where: { id: pickup.id }, include: { variant: true, employee: true } })
    })

    await broadcastEvent('pickup:created', {
      id: result!.id,
      employeeId: result!.employeeId,
      variantId: result!.variantId,
    })

    return Response.json({
      pickup: {
        id: result!.id,
        employeeId: result!.employeeId,
        variantId: result!.variantId,
        type: result!.type as 'FOOD' | 'DRINK',
        period: result!.period,
        timestamp: result!.timestamp.toISOString(),
        variant: { id: result!.variant.id, name: result!.variant.name, type: result!.variant.type as 'FOOD' | 'DRINK' },
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Gagal membuat pengambilan'
    console.error('[pickups POST]', msg)
    return Response.json({ error: msg }, { status: 400 })
  }
}
