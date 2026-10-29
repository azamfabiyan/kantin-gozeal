import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentPeriodKey } from '@/lib/auth'

// GET /api/dashboard/public - public read-only dashboard data (for TV/pantry display, no auth)
export async function GET() {
  const period = getCurrentPeriodKey()

  const [variants, periodPickupsCount, totalEmployees, employeesWithPickupsThisPeriod] = await Promise.all([
    db.variant.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true, stock: true, initialStock: true },
    }),
    db.pickup.count({ where: { period } }),
    db.employee.count({ where: { active: true } }),
    db.pickup.findMany({
      where: { period },
      select: { employeeId: true },
      distinct: ['employeeId'],
    }),
  ])

  const variantStock = variants.map((v) => ({
    id: v.id,
    name: v.name,
    type: v.type,
    stock: v.stock,
    initialStock: v.initialStock,
    taken: v.initialStock - v.stock,
  }))

  return NextResponse.json({
    period,
    stats: {
      totalEmployees,
      periodParticipants: employeesWithPickupsThisPeriod.length,
      periodPickups: periodPickupsCount,
    },
    variants: variantStock,
  })
}
