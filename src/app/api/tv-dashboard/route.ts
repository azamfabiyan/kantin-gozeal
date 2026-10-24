import { db, isTurso, turso, toInt, toBool } from '@/lib/db'
import { getActivePeriod } from '@/lib/auth'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET /api/tv-dashboard - public endpoint for TV display (no auth)
export async function GET() {
  const activePeriod = await getActivePeriod()
  const todayStr = new Date().toISOString().slice(0, 10)

  if (isTurso && turso) {
    const [variantsR, pickupsR, empR] = await Promise.all([
      turso.execute('SELECT id, name, type, stock, initialStock, active FROM Variant WHERE active = 1 ORDER BY type ASC, name ASC'),
      turso.execute({
        sql: `SELECT p.id, p.type, p.timestamp, p.employeeId, p.variantId,
              e.name as e_name, e.code as e_code,
              v.name as v_name, v.type as v_type
              FROM Pickup p
              LEFT JOIN Employee e ON p.employeeId = e.id
              LEFT JOIN Variant v ON p.variantId = v.id
              WHERE p.period = ?
              ORDER BY p.timestamp DESC
              LIMIT 20`,
        args: [activePeriod],
      }),
      turso.execute('SELECT COUNT(*) as c FROM Employee WHERE active = 1'),
    ])

    const variants = variantsR.rows
    const foodStock = variants.filter(r => String(r.type) === 'FOOD').map(r => ({
      id: String(r.id), name: String(r.name), stock: toInt(r.stock), initialStock: toInt(r.initialStock), active: toBool(r.active),
    }))
    const drinkStock = variants.filter(r => String(r.type) === 'DRINK').map(r => ({
      id: String(r.id), name: String(r.name), stock: toInt(r.stock), initialStock: toInt(r.initialStock), active: toBool(r.active),
    }))

    // Count today's pickups
    const todayR = await turso.execute({
      sql: 'SELECT COUNT(*) as c FROM Pickup WHERE timestamp >= ?',
      args: [todayStr + 'T00:00:00.000Z'],
    })

    const recentPickups = pickupsR.rows.map(r => ({
      id: String(r.id),
      type: String(r.type),
      timestamp: String(r.timestamp),
      employee: { name: String(r.e_name || ''), code: String(r.e_code || '') },
      variant: r.v_name ? { name: String(r.v_name), type: String(r.v_type) } : null,
    }))

    return Response.json({
      period: activePeriod,
      stats: {
        totalEmployees: toInt(empR.rows[0].c),
        pickupsThisPeriod: pickupsR.rows.length,
        todayPickups: toInt(todayR.rows[0].c),
      },
      foodStock,
      drinkStock,
      recentPickups,
    })
  }

  // Prisma mode (local dev)
  const [variants, pickups, empCount] = await Promise.all([
    (db as PrismaClient).variant.findMany({ where: { active: true }, orderBy: { type: 'asc' } }),
    (db as PrismaClient).pickup.findMany({
      where: { period: activePeriod },
      include: { employee: { select: { name: true, code: true } }, variant: { select: { name: true, type: true } } },
      orderBy: { timestamp: 'desc' },
      take: 20,
    }),
    (db as PrismaClient).employee.count({ where: { active: true } }),
  ])

  const todayPickups = pickups.filter(p => p.timestamp.toISOString().slice(0, 10) === todayStr).length

  return Response.json({
    period: activePeriod,
    stats: { totalEmployees: empCount, pickupsThisPeriod: pickups.length, todayPickups },
    foodStock: variants.filter(v => v.type === 'FOOD').map(v => ({ id: v.id, name: v.name, stock: v.stock, initialStock: v.initialStock, active: v.active })),
    drinkStock: variants.filter(v => v.type === 'DRINK').map(v => ({ id: v.id, name: v.name, stock: v.stock, initialStock: v.initialStock, active: v.active })),
    recentPickups: pickups.map(p => ({
      id: p.id, type: p.type, timestamp: p.timestamp.toISOString(),
      employee: { name: p.employee.name, code: p.employee.code },
      variant: p.variant ? { name: p.variant.name, type: p.variant.type } : null,
    })),
  })
}
