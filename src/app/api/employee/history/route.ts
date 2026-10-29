import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireEmployee } from '@/lib/employee-guard'
import { getCurrentPeriodKey, getRecentPeriods } from '@/lib/auth'

// GET /api/employee/history?period=YYYY-MM - employee's own pickup history by period
// If no period specified, return all history (most recent 100)
export async function GET(req: NextRequest) {
  const guard = requireEmployee(req)
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') // YYYY-MM or 'all'

  // Get all pickups for this employee (most recent first)
  const pickups = await db.pickup.findMany({
    where: {
      employeeId: guard.employeeId,
      ...(period && period !== 'all' ? { period } : {}),
    },
    include: {
      variant: { select: { name: true, type: true } },
    },
    orderBy: { timestamp: 'desc' },
    take: 500,
  })

  const totalFood = pickups.filter((p) => p.type === 'FOOD').length
  const totalDrink = pickups.filter((p) => p.type === 'DRINK').length

  // Group by period
  const byPeriod = new Map<string, { period: string; food: number; drink: number; total: number; items: typeof pickups }>()
  for (const p of pickups) {
    if (!byPeriod.has(p.period)) {
      byPeriod.set(p.period, { period: p.period, food: 0, drink: 0, total: 0, items: [] })
    }
    const entry = byPeriod.get(p.period)!
    entry.items.push(p)
    if (p.type === 'FOOD') entry.food++
    else entry.drink++
    entry.total++
  }

  // Get current period info
  let periodSetting = await db.periodSetting.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  const currentPeriod = periodSetting?.currentPeriod || getCurrentPeriodKey()

  return NextResponse.json({
    currentPeriod,
    requestedPeriod: period || 'all',
    summary: {
      totalPickups: pickups.length,
      totalFood,
      totalDrink,
      uniquePeriods: byPeriod.size,
    },
    pickups: pickups.map((p) => ({
      id: p.id,
      period: p.period,
      timestamp: p.timestamp,
      type: p.type,
      variant: p.variant ? { name: p.variant.name, type: p.variant.type } : null,
    })),
    grouped: Array.from(byPeriod.values())
      .sort((a, b) => b.period.localeCompare(a.period))
      .map((g) => ({
        period: g.period,
        food: g.food,
        drink: g.drink,
        total: g.total,
        items: g.items.map((p) => ({
          id: p.id,
          type: p.type,
          timestamp: p.timestamp,
          variantName: p.variant?.name ?? null,
        })),
      })),
  })
}
