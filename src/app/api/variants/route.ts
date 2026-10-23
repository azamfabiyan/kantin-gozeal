import { NextRequest } from 'next/server'
import { db, isTurso, turso, toBool, toISO, toInt, genId } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const activePeriod = await getActivePeriod()

  if (isTurso && turso) {
    const variantsR = await turso.execute(
      'SELECT id, name, type, stock, initialStock, defaultQuota, active, createdAt FROM Variant ORDER BY type ASC',
    )
    const pickupsR = await turso.execute({
      sql: 'SELECT variantId, COUNT(*) as cnt FROM Pickup WHERE period = ? GROUP BY variantId',
      args: [activePeriod],
    })
    const pickupMap = new Map<string, number>()
    for (const row of pickupsR.rows) {
      pickupMap.set(String(row.variantId), Number(row.cnt))
    }
    const variants = variantsR.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      type: String(row.type),
      stock: toInt(row.stock),
      initialStock: toInt(row.initialStock),
      active: toBool(row.active),
      createdAt: toISO(row.createdAt),
      defaultQuota: toInt(row.defaultQuota),
      takenCount: pickupMap.get(String(row.id)) || 0,
    }))
    return Response.json({ variants, activePeriod })
  }

  const variants = await (db as PrismaClient).variant.findMany({ orderBy: { type: 'asc' } })
  const pickups = await (db as PrismaClient).pickup.groupBy({
    by: ['variantId'],
    where: { period: activePeriod },
    _count: true,
  })
  const pickupMap = new Map(pickups.map((p) => [p.variantId, p._count]))
  return Response.json({
    variants: variants.map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      stock: v.stock,
      initialStock: v.initialStock,
      active: v.active,
      createdAt: v.createdAt.toISOString(),
      defaultQuota: v.defaultQuota,
      takenCount: pickupMap.get(v.id) || 0,
    })),
    activePeriod,
  })
}

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { name, type, stock, active } = body
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return Response.json({ error: 'Nama variant wajib diisi' }, { status: 400 })
    }
    if (type !== 'FOOD' && type !== 'DRINK') {
      return Response.json({ error: 'Tipe harus FOOD atau DRINK' }, { status: 400 })
    }
    const stockNum = Number(stock) || 0
    const defaultQuota = Math.max(1, Number(body.defaultQuota) || 1)
    if (stockNum < 0) {
      return Response.json({ error: 'Stok tidak boleh negatif' }, { status: 400 })
    }
    const trimmedName = String(name).trim()
    const activeFlag = active !== false
    const nowIso = new Date().toISOString()

    if (isTurso && turso) {
      const id = genId()
      // 1. Insert variant + stock history
      await turso.batch([
        {
          sql: 'INSERT INTO Variant (id, name, type, stock, initialStock, defaultQuota, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [id, trimmedName, type, stockNum, stockNum, defaultQuota, activeFlag ? 1 : 0, nowIso, nowIso],
        },
        {
          sql: 'INSERT INTO StockHistory (id, variantId, changeType, amount, oldStock, newStock, note, changedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [genId(), id, 'SET', stockNum, 0, stockNum, 'Inisialisasi variant', admin.username, nowIso],
        },
      ])
      // 2. Auto-create EmployeeBalance (saldo=1) untuk semua karyawan aktif
      const employees = await turso.execute('SELECT id FROM Employee WHERE active = 1')
      const balanceStmts = employees.rows.map((emp) => ({
        sql: 'INSERT OR IGNORE INTO EmployeeBalance (id, employeeId, variantId, balance, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)',
        args: [genId(), String(emp.id), id, nowIso, nowIso],
      }))
      if (balanceStmts.length > 0) {
        await turso.batch(balanceStmts)
      }
      await broadcastEvent('variant:updated', { id, action: 'create' })
      return Response.json({
        variant: {
          id,
          name: trimmedName,
          type,
          stock: stockNum,
          initialStock: stockNum,
          active: activeFlag,
          createdAt: nowIso,
          defaultQuota,
        },
      })
    }

    const variant = await (db as PrismaClient).variant.create({
      data: { name: trimmedName, type, stock: stockNum, initialStock: stockNum, defaultQuota, active: activeFlag },
    })
    await (db as PrismaClient).stockHistory.create({
      data: {
        variantId: variant.id,
        changeType: 'SET',
        amount: stockNum,
        oldStock: 0,
        newStock: stockNum,
        note: 'Inisialisasi variant',
        changedBy: admin.username,
      },
    })
    // Auto-create EmployeeBalance (saldo=1) untuk semua karyawan aktif
    const activeEmployees = await (db as PrismaClient).employee.findMany({ where: { active: true } })
    await (db as PrismaClient).employeeBalance.createMany({
      data: activeEmployees.map((emp) => ({
        employeeId: emp.id,
        variantId: variant.id,
        balance: 1,
      })),
      skipDuplicates: true,
    })
    await broadcastEvent('variant:updated', { id: variant.id, action: 'create' })
    return Response.json({
      variant: {
        id: variant.id,
        name: variant.name,
        type: variant.type,
        stock: variant.stock,
        initialStock: variant.initialStock,
        active: variant.active,
        createdAt: variant.createdAt.toISOString(),
        defaultQuota: variant.defaultQuota,
      },
    })
  } catch (e) {
    console.error('[variants POST]', e)
    return Response.json({ error: 'Gagal membuat variant' }, { status: 500 })
  }
}
