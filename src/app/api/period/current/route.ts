import { db } from '@/lib/db'
import { getActivePeriod } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const activePeriod = await getActivePeriod()
  const setting = await db.periodSetting.findFirst({
    where: { currentPeriod: activePeriod },
    orderBy: { startedAt: 'desc' },
  })
  return Response.json({
    period: {
      currentPeriod: activePeriod,
      startedAt: setting?.startedAt.toISOString() || new Date().toISOString(),
      resetBy: setting?.resetBy || null,
    },
  })
}
