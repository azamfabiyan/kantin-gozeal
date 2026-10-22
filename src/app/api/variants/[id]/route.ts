import { NextRequest } from 'next/server'
import { db, isTurso, turso, toBool, toInt, toISO, genId } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const nowIso = new Date().toISOString()

    if (isTurso && turso) {
      const existingR = await turso.execute({
        sql: 'SELECT id, name, type, stock, initialStock, active, createdAt FROM Variant WHERE id = ?',
        args: [id],
      })
      if (existingR.rows.length === 0) {
        return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })
      }
      const existing = existingR.rows[0]
      const curStock = toInt(existing.stock)

      // Build update fields dynamically
      const updates: string[] = []
      const args: unknown[] = []
      if (typeof body.name === 'string' && body.name.trim()) {
        updates.push('name = ?')
        args.push(body.name.trim())
      }
      if (body.type === 'FOOD' || body.type === 'DRINK') {
        updates.push('type = ?')
        args.push(body.type)
      }
      if (typeof body.active === 'boolean') {
        updates.push('active = ?')
        args.push(body.active ? 1 : 0)
      }
      if (typeof body.defaultQuota === 'number' && body.defaultQuota >= 1) {
        updates.push('defaultQuota = ?')
        args.push(body.defaultQuota)
      }
      let newStock = curStock
      if (typeof body.stock === 'number' && body.stock !== curStock) {
        newStock = Math.max(0, body.stock)
        updates.push('stock = ?')
        args.push(newStock)
        await turso.execute({
          sql: 'INSERT INTO StockHistory (id, variantId, changeType, amount, oldStock, newStock, note, changedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [genId(), id, 'SET', newStock - curStock, curStock, newStock, body.note || 'Update stok via edit', admin.username, nowIso],
        })
      }
      if (updates.length > 0) {
        updates.push('updatedAt = ?')
        args.push(nowIso)
        args.push(id)
        await turso.execute({
          sql: `UPDATE Variant SET ${updates.join(', ')} WHERE id = ?`,
          args,
        })
      }
      await broadcastEvent('variant:updated', { id, action: 'update' })
      return Response.json({
        variant: {
          id,
          name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : String(existing.name),
          type: body.type === 'FOOD' || body.type === 'DRINK' ? body.type : String(existing.type),
          stock: newStock,
          initialStock: toInt(existing.initialStock),
          active: typeof body.active === 'boolean' ? body.active : toBool(existing.active),
          createdAt: toISO(existing.createdAt),
        },
      })
    }

    // Prisma mode
    const existing = await (db as PrismaClient).variant.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })
    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (body.type === 'FOOD' || body.type === 'DRINK') data.type = body.type
    if (typeof body.active === 'boolean') data.active = body.active
    if (typeof body.stock === 'number' && body.stock !== existing.stock) {
      const newStock = Math.max(0, body.stock)
      await (db as PrismaClient).stockHistory.create({
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
    const variant = await (db as PrismaClient).variant.update({ where: { id }, data })
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

    if (isTurso && turso) {
      const existingR = await turso.execute({ sql: 'SELECT id FROM Variant WHERE id = ?', args: [id] })
      if (existingR.rows.length === 0) {
        return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })
      }
      // Delete stock history, pickups, balances, then variant
      await turso.execute({ sql: 'DELETE FROM StockHistory WHERE variantId = ?', args: [id] })
      await turso.execute({ sql: 'DELETE FROM Pickup WHERE variantId = ?', args: [id] })
      await turso.execute({ sql: 'DELETE FROM EmployeeBalance WHERE variantId = ?', args: [id] })
      await turso.execute({ sql: 'DELETE FROM Variant WHERE id = ?', args: [id] })
      await broadcastEvent('variant:updated', { id, action: 'delete' })
      return Response.json({ ok: true })
    }

    const existing = await (db as PrismaClient).variant.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })
    await (db as PrismaClient).stockHistory.deleteMany({ where: { variantId: id } })
    await (db as PrismaClient).pickup.deleteMany({ where: { variantId: id } })
    await (db as PrismaClient).variant.delete({ where: { id } })
    await broadcastEvent('variant:updated', { id, action: 'delete' })
    return Response.json({ ok: true })
  } catch (e) {
    console.error('[variants DELETE]', e)
    return Response.json({ error: 'Gagal menghapus variant' }, { status: 500 })
  }
}
