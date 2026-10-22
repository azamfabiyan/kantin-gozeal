import { NextRequest } from 'next/server'
import { db, isTurso, turso, toBool, toInt, toISO } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod, getPreviousPeriods } from '@/lib/auth'
import type { DashboardStats } from '@/lib/types'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const activePeriod = await getActivePeriod()
  const periods = getPreviousPeriods(6)

  if (isTurso && turso) {
    const [
      totalEmpR,
      pickupsThisPeriodR,
      allActiveEmpR,
      variantsR,
      recentPickupsR,
    ] = await Promise.all([
      turso.execute('SELECT COUNT(*) as cnt FROM Employee'),
      turso.execute({
        sql: `SELECT p.id, p.employeeId, p.variantId, p.type, p.period, p.timestamp,
                     e.id as e_id, e.name as e_name, e.code as e_code,
                     v.id as v_id, v.name as v_name, v.type as v_type
              FROM Pickup p
              LEFT JOIN Employee e ON e.id = p.employeeId
              LEFT JOIN Variant v ON v.id = p.variantId
              WHERE p.period = ?`,
        args: [activePeriod],
      }),
      turso.execute('SELECT id FROM Employee WHERE active = 1'),
      turso.execute('SELECT id, name, type, stock, initialStock, active, createdAt FROM Variant'),
      turso.execute({
        sql: `SELECT p.id, p.employeeId, p.variantId, p.type, p.period, p.timestamp,
                     e.id as e_id, e.name as e_name, e.code as e_code,
                     v.id as v_id, v.name as v_name, v.type as v_type
              FROM Pickup p
              LEFT JOIN Employee e ON e.id = p.employeeId
              LEFT JOIN Variant v ON v.id = p.variantId
              ORDER BY p.timestamp DESC
              LIMIT 20`,
      }),
    ])

    const totalEmployees = Number((totalEmpR.rows[0] as { cnt: number | bigint }).cnt)
    const pickupsThisPeriodData = pickupsThisPeriodR.rows
    const employeesWithPickupThisPeriod = new Set(pickupsThisPeriodData.map((p) => String(p.employeeId)))
    const employeesWithoutPickup = allActiveEmpR.rows.filter((e) => !employeesWithPickupThisPeriod.has(String(e.id))).length

    const variants = variantsR.rows
    const lowStockCount = variants.filter((v) => toBool(v.active) && toInt(v.stock) <= 5).length
    const foodStock = variants.filter((v) => String(v.type) === 'FOOD')
    const drinkStock = variants.filter((v) => String(v.type) === 'DRINK')

    // Period trend (6 previous periods)
    const periodTrend: { period: string; food: number; drink: number }[] = []
    for (const period of periods) {
      const r = await turso.execute({
        sql: "SELECT type, COUNT(*) as cnt FROM Pickup WHERE period = ? GROUP BY type",
        args: [period],
      })
      let food = 0
      let drink = 0
      for (const row of r.rows) {
        if (String(row.type) === 'FOOD') food = Number(row.cnt)
        else if (String(row.type) === 'DRINK') drink = Number(row.cnt)
      }
      periodTrend.push({ period, food, drink })
    }
    periodTrend.reverse()

    const foodPickupsThisPeriod = pickupsThisPeriodData.filter((p) => String(p.type) === 'FOOD').length
    const drinkPickupsThisPeriod = pickupsThisPeriodData.filter((p) => String(p.type) === 'DRINK').length

    const recentPickups = recentPickupsR.rows.map((p) => ({
      id: String(p.id),
      employeeId: String(p.employeeId),
      variantId: String(p.variantId),
      type: String(p.type) as 'FOOD' | 'DRINK',
      period: String(p.period),
      timestamp: toISO(p.timestamp),
      employee: p.e_id ? { id: String(p.e_id), name: String(p.e_name), code: String(p.e_code) } : undefined,
      variant: p.v_id ? { id: String(p.v_id), name: String(p.v_name), type: String(p.v_type) as 'FOOD' | 'DRINK' } : undefined,
    }))

    const stats: DashboardStats = {
      totalEmployees,
      pickupsThisPeriod: pickupsThisPeriodData.length,
      employeesWithoutPickup,
      lowStockCount,
      activePeriod,
      recentPickups,
      foodStock: foodStock.map((v) => ({
        id: String(v.id), name: String(v.name), type: 'FOOD' as const, stock: toInt(v.stock), initialStock: toInt(v.initialStock), active: toBool(v.active), createdAt: toISO(v.createdAt),
      })),
      drinkStock: drinkStock.map((v) => ({
        id: String(v.id), name: String(v.name), type: 'DRINK' as const, stock: toInt(v.stock), initialStock: toInt(v.initialStock), active: toBool(v.active), createdAt: toISO(v.createdAt),
      })),
      periodTrend,
      periodDistribution: [
        { type: 'FOOD' as const, count: foodPickupsThisPeriod },
        { type: 'DRINK' as const, count: drinkPickupsThisPeriod },
      ],
    }
    return Response.json({ stats })
  }

  // Prisma mode (local dev)
  const [totalEmployees, pickupsThisPeriodData, allEmployees, variants, recentPickupsRaw] = await Promise.all([
    (db as PrismaClient).employee.count(),
    (db as PrismaClient).pickup.findMany({ where: { period: activePeriod }, include: { employee: true, variant: true } }),
    (db as PrismaClient).employee.findMany({ where: { active: true }, select: { id: true } }),
    (db as PrismaClient).variant.findMany(),
    (db as PrismaClient).pickup.findMany({
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

  const periodTrend = await Promise.all(
    periods.map(async (period) => {
      const [food, drink] = await Promise.all([
        (db as PrismaClient).pickup.count({ where: { period, type: 'FOOD' } }),
        (db as PrismaClient).pickup.count({ where: { period, type: 'DRINK' } }),
      ])
      return { period, food, drink }
    }),
  )
  periodTrend.reverse()

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
