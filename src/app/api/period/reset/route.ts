import { NextRequest } from 'next/server'
import { getAdminFromRequest, resetCurrentPeriod, startNewPeriod } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { mode } = await req.json()
    if (mode === 'current') {
      await resetCurrentPeriod(admin.username)
      await broadcastEvent('period:reset', { mode: 'current' })
      return Response.json({ period: 'reset' })
    }
    if (mode === 'next') {
      const newPeriod = await startNewPeriod(admin.username)
      await broadcastEvent('period:reset', { mode: 'next', period: newPeriod })
      return Response.json({ period: newPeriod })
    }
    return Response.json({ error: 'Mode harus "current" atau "next"' }, { status: 400 })
  } catch (e) {
    console.error('[period/reset]', e)
    return Response.json({ error: 'Gagal reset periode' }, { status: 500 })
  }
}
