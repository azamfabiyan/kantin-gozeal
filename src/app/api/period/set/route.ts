import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'

export const dynamic = 'force-dynamic'

// POST /api/period/set - set period manually (e.g., "2026-10")
// Body: { period: "2026-10" }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { period } = await req.json()
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return Response.json({ error: 'Format periode tidak valid. Gunakan YYYY-MM (contoh: 2026-10)' }, { status: 400 })
    }

    // Upsert period setting
    await db.periodSetting.upsert({
      where: { currentPeriod: period },
      update: { startedAt: new Date(), resetBy: admin.username, updatedAt: new Date() },
      create: { currentPeriod: period, resetBy: admin.username },
    })

    // Make it the latest by updating createdAt
    await db.periodSetting.update({
      where: { currentPeriod: period },
      data: { createdAt: new Date() },
    })

    await broadcastEvent('period:reset', { mode: 'set', period })

    return Response.json({ period, message: `Periode diatur ke ${period}` })
  } catch (e) {
    console.error('[period/set]', e)
    return Response.json({ error: 'Gagal mengatur periode' }, { status: 500 })
  }
}
