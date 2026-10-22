import { NextRequest } from 'next/server'
import { db, isTurso, turso, toInt, toISO } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (isTurso && turso) {
    const r = await turso.execute({
      sql: `SELECT h.id, h.variantId, h.changeType, h.amount, h.oldStock, h.newStock, h.note, h.changedBy, h.createdAt,
                   v.id as v_id, v.name as v_name, v.type as v_type
            FROM StockHistory h
            LEFT JOIN Variant v ON v.id = h.variantId
            WHERE h.variantId = ?
            ORDER BY h.createdAt DESC`,
      args: [id],
    })
    return Response.json({
      history: r.rows.map((row) => ({
        id: String(row.id),
        variantId: String(row.variantId),
        changeType: String(row.changeType),
        amount: toInt(row.amount),
        oldStock: toInt(row.oldStock),
        newStock: toInt(row.newStock),
        note: row.note === null || row.note === undefined ? null : String(row.note),
        changedBy: String(row.changedBy),
        createdAt: toISO(row.createdAt),
        variant: row.v_id ? { id: String(row.v_id), name: String(row.v_name), type: String(row.v_type) as 'FOOD' | 'DRINK' } : undefined,
      })),
    })
  }

  const history = await (db as PrismaClient).stockHistory.findMany({
    where: { variantId: id },
    orderBy: { createdAt: 'desc' },
    include: { variant: true },
  })
  return Response.json({
    history: history.map((h) => ({
      id: h.id,
      variantId: h.variantId,
      changeType: h.changeType,
      amount: h.amount,
      oldStock: h.oldStock,
      newStock: h.newStock,
      note: h.note,
      changedBy: h.changedBy,
      createdAt: h.createdAt.toISOString(),
      variant: h.variant ? { id: h.variant.id, name: h.variant.name, type: h.variant.type as 'FOOD' | 'DRINK' } : undefined,
    })),
  })
}
