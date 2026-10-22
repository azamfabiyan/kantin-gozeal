import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getEmployeeFromRequest, getActivePeriod } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const emp = await getEmployeeFromRequest(req)
  if (!emp) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId') || emp.id

  if (employeeId !== emp.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const history = await db.pickup.findMany({
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

    const result = await db.$transaction(async (tx) => {
      const variant = await tx.variant.findUnique({ where: { id: String(variantId) } })
      if (!variant) throw new Error('Variant tidak ditemukan')
      if (!variant.active) throw new Error('Variant tidak aktif')

      // Check stock
      if (variant.stock <= 0) throw new Error('Stok habis')

      // Check EmployeeBalance (carry-over system)
      const balance = await tx.employeeBalance.findUnique({
        where: {
          employeeId_variantId: {
            employeeId: emp.id,
            variantId: variant.id,
          },
        },
      })
      if (!balance || balance.balance <= 0) {
        throw new Error(`Saldo ${variant.name} habis. Tunggu periode berikutnya untuk dapat saldo baru.`)
      }

      // Create pickup, decrement stock, decrement balance, record history
      const [pickup] = await Promise.all([
        tx.pickup.create({
          data: {
            employeeId: emp.id,
            variantId: variant.id,
            type: variant.type,
            period,
          },
        }),
        tx.variant.update({
          where: { id: variant.id },
          data: { stock: variant.stock - 1 },
        }),
        tx.employeeBalance.update({
          where: { id: balance.id },
          data: { balance: balance.balance - 1 },
        }),
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

      const fullPickup = await tx.pickup.findUnique({
        where: { id: pickup.id },
        include: { variant: true, employee: true },
      })
      return fullPickup
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
