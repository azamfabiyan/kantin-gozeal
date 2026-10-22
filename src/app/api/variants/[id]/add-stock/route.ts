import { NextRequest } from 'next/server'
import { db, isTurso, turso, toInt, toBool, toISO, genId } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'
import type { PrismaClient } from '@prisma/client'

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
    const nowIso = new Date().toISOString()

    if (isTurso && turso) {
      const variantR = await turso.execute({
        sql: 'SELECT id, name, type, stock, initialStock, active, createdAt FROM Variant WHERE id = ?',
        args: [id],
      })
      if (variantR.rows.length === 0) {
        return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })
      }
      const variant = variantR.rows[0]
      const curStock = toInt(variant.stock)
      const newStock = Math.max(0, curStock + amt)

      await turso.batch([
        {
          sql: 'UPDATE Variant SET stock = ?, updatedAt = ? WHERE id = ?',
          args: [newStock, nowIso, id],
        },
        {
          sql: 'INSERT INTO StockHistory (id, variantId, changeType, amount, oldStock, newStock, note, changedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [genId(), id, amt > 0 ? 'ADD' : 'REDUCE', amt, curStock, newStock, note || null, admin.username, nowIso],
        },
      ])

      await broadcastEvent('variant:updated', { id, action: 'stock_change' })
      return Response.json({
        variant: {
          id,
          name: String(variant.name),
          type: String(variant.type),
          stock: newStock,
          initialStock: toInt(variant.initialStock),
          active: toBool(variant.active),
          createdAt: toISO(variant.createdAt),
        },
      })
    }

    // Prisma mode (local dev)
    const variant = await (db as PrismaClient).variant.findUnique({ where: { id } })
    if (!variant) return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })

    const newStock = Math.max(0, variant.stock + amt)
    const [updatedVariant] = await (db as PrismaClient).$transaction([
      (db as PrismaClient).variant.update({ where: { id }, data: { stock: newStock } }),
      (db as PrismaClient).stockHistory.create({
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
