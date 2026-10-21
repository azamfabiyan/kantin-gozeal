import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod, getPreviousPeriods } from '@/lib/auth'
import type { DashboardStats } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const activePeriod = await getActivePeriod()
  const periods = getPreviousPeriods(6)

  const [totalEmployees, pickupsThisPeriodData, allEmployees, variants, recentPickupsRaw] = await Promise.all([
    db.employee.count(),
    db.pickup.findMany({ where: { period: activePeriod }, include: { employee: true, variant: true } }),
    db.employee.findMany({ where: { active: true }, select: { id: true } }),
    db.variant.findMany(),
    db.pickup.findMany({
      take: 20,
      orderBy: { timestamp: 'desc' },
      include: { employee: true, variant: true },
    }),
  ])

  const employeesWithPickupThisPeriod = new Set(pickupsThisPeriodData.map((p) => p.employeeId))
  const employeesWithoutPickup = allEmployees.filter((e) => !employeesWithPickupThisPeriod.has(e.id)).length
  const lowStockCount = variants.filter((v) => v.active && v.stock <= 5).length

  const foodStock = variants.filter((v) => v.type === 'FOOD')
  const drinkStock = variants.filter((v) => v.type === 'DRINK')

  // Period trend
  const periodTrend = await Promise.all(
    periods.map(async (period) => {
      const [food, drink] = await Promise.all([
        db.pickup.count({ where: { period, type: 'FOOD' } }),
        db.pickup.count({ where: { period, type: 'DRINK' } }),
      ])
      return { period, food, drink }
    }),
  )
  // Reverse so oldest first
  periodTrend.reverse()

  // Period distribution
  const foodPickupsThisPeriod = pickupsThisPeriodData.filter((p) => p.type === 'FOOD').length
  const drinkPickupsThisPeriod = pickupsThisPeriodData.filter((p) => p.type === 'DRINK').length

  const recentPickups = recentPickupsRaw.map((p) => ({
    id: p.id,
    employeeId: p.employeeId,
    variantId: p.variantId,
    type: p.type as 'FOOD' | 'DRINK',
    period: p.period,
    timestamp: p.timestamp.toISOString(),
    employee: p.employee ? { id: p.employee.id, name: p.employee.name, code: p.employee.code } : undefined,
    variant: p.variant ? { id: p.variant.id, name: p.variant.name, type: p.variant.type as 'FOOD' | 'DRINK' } : undefined,
  }))

  const stats: DashboardStats = {
    totalEmployees,
    pickupsThisPeriod: pickupsThisPeriodData.length,
    employeesWithoutPickup,
    lowStockCount,
    activePeriod,
    recentPickups,
    foodStock: foodStock.map((v) => ({
      id: v.id, name: v.name, type: 'FOOD' as const, stock: v.stock, initialStock: v.initialStock, active: v.active, createdAt: v.createdAt.toISOString(),
    })),
    drinkStock: drinkStock.map((v) => ({
      id: v.id, name: v.name, type: 'DRINK' as const, stock: v.stock, initialStock: v.initialStock, active: v.active, createdAt: v.createdAt.toISOString(),
    })),
    periodTrend,
    periodDistribution: [
      { type: 'FOOD' as const, count: foodPickupsThisPeriod },
      { type: 'DRINK' as const, count: drinkPickupsThisPeriod },
    ],
  }

  return Response.json({ stats })
}
