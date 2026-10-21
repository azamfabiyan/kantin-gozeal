import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const history = await db.stockHistory.findMany({
    orderBy: { createdAt: 'desc' },
    include: { variant: true },
    take: 200,
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
