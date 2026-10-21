import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.variant.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (body.type === 'FOOD' || body.type === 'DRINK') data.type = body.type
    if (typeof body.active === 'boolean') data.active = body.active

    // Stock changes need history
    if (typeof body.stock === 'number' && body.stock !== existing.stock) {
      const newStock = Math.max(0, body.stock)
      await db.stockHistory.create({
        data: {
          variantId: id,
          changeType: 'SET',
          amount: newStock - existing.stock,
          oldStock: existing.stock,
          newStock,
          note: body.note || 'Update stok via edit',
          changedBy: admin.username,
        },
      })
      data.stock = newStock
    }

    const variant = await db.variant.update({ where: { id }, data })
    await broadcastEvent('variant:updated', { id: variant.id, action: 'update' })
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
    console.error('[variants PUT]', e)
    return Response.json({ error: 'Gagal memperbarui variant' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const existing = await db.variant.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })

    // Delete stock history first (cascade should handle, but explicit)
    await db.stockHistory.deleteMany({ where: { variantId: id } })
    await db.pickup.deleteMany({ where: { variantId: id } })
    await db.variant.delete({ where: { id } })
    await broadcastEvent('variant:updated', { id, action: 'delete' })
    return Response.json({ ok: true })
  } catch (e) {
    console.error('[variants DELETE]', e)
    return Response.json({ error: 'Gagal menghapus variant' }, { status: 500 })
  }
}
