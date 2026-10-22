import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const { amount, note } = await req.json()
    const amt = Number(amount)
    if (!Number.isInteger(amt) || amt === 0) {
      return Response.json({ error: 'Jumlah harus berupa integer non-zero' }, { status: 400 })
    }
    const variant = await db.variant.findUnique({ where: { id } })
    if (!variant) return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })

    const newStock = Math.max(0, variant.stock + amt)
    const [updatedVariant] = await db.$transaction([
      db.variant.update({
        where: { id },
        data: { stock: newStock },
      }),
      db.stockHistory.create({
        data: {
          variantId: id,
          changeType: amt > 0 ? 'ADD' : 'REDUCE',
          amount: amt,
          oldStock: variant.stock,
          newStock,
          note: note || null,
          changedBy: admin.username,
        },
      }),
    ])
    await broadcastEvent('variant:updated', { id, action: 'stock_change' })
    return Response.json({
      variant: {
        id: updatedVariant.id,
        name: updatedVariant.name,
        type: updatedVariant.type,
        stock: updatedVariant.stock,
        initialStock: updatedVariant.initialStock,
        active: updatedVariant.active,
        createdAt: updatedVariant.createdAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('[variants add-stock]', e)
    return Response.json({ error: 'Gagal mengubah stok' }, { status: 500 })
  }
}
