import { db, isTurso, turso, toISO } from '@/lib/db'
import { getActivePeriod } from '@/lib/auth'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const activePeriod = await getActivePeriod()

  if (isTurso && turso) {
    const r = await turso.execute({
      sql: 'SELECT currentPeriod, startedAt, resetBy FROM PeriodSetting WHERE currentPeriod = ? ORDER BY startedAt DESC LIMIT 1',
      args: [activePeriod],
    })
    const row = r.rows[0]
    return Response.json({
      period: {
        currentPeriod: activePeriod,
        startedAt: row && row.startedAt != null ? toISO(row.startedAt) : new Date().toISOString(),
        resetBy: row && row.resetBy != null ? String(row.resetBy) : null,
      },
    })
  }

  const setting = await (db as PrismaClient).periodSetting.findFirst({
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
