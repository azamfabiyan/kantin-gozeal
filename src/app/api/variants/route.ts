import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const activePeriod = await getActivePeriod()
  const variants = await db.variant.findMany({ orderBy: { type: 'asc' } })

  // Count pickups per variant this period
  const pickups = await db.pickup.groupBy({
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
      takenCount: pickupMap.get(v.id) || 0,
    })),
    activePeriod,
  })
}

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, type, stock, active } = await req.json()
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return Response.json({ error: 'Nama variant wajib diisi' }, { status: 400 })
    }
    if (type !== 'FOOD' && type !== 'DRINK') {
      return Response.json({ error: 'Tipe harus FOOD atau DRINK' }, { status: 400 })
    }
    const stockNum = Number(stock) || 0
    if (stockNum < 0) {
      return Response.json({ error: 'Stok tidak boleh negatif' }, { status: 400 })
    }
    const variant = await db.variant.create({
      data: {
        name: String(name).trim(),
        type,
        stock: stockNum,
        initialStock: stockNum,
        active: active !== false,
      },
    })
    await db.stockHistory.create({
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
      },
    })
  } catch (e) {
    console.error('[variants POST]', e)
    return Response.json({ error: 'Gagal membuat variant' }, { status: 500 })
  }
}
