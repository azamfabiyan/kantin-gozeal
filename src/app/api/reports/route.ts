import { NextRequest } from 'next/server'
import { db, isTurso, turso, toISO } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod } from '@/lib/auth'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period')
  const type = searchParams.get('type') as 'FOOD' | 'DRINK' | null
  const employeeId = searchParams.get('employeeId')
  const variantId = searchParams.get('variantId')

  const activePeriod = await getActivePeriod()
  const targetPeriod = period || activePeriod

  if (isTurso && turso) {
    // Build dynamic query
    const conditions = ['p.period = ?']
    const args: unknown[] = [targetPeriod]
    if (type) {
      conditions.push('p.type = ?')
      args.push(type)
    }
    if (employeeId) {
      conditions.push('p.employeeId = ?')
      args.push(employeeId)
    }
    if (variantId) {
      conditions.push('p.variantId = ?')
      args.push(variantId)
    }
    const sql = `SELECT p.id, p.employeeId, p.variantId, p.type, p.period, p.timestamp,
                        e.id as e_id, e.name as e_name, e.code as e_code,
                        v.id as v_id, v.name as v_name, v.type as v_type
                 FROM Pickup p
                 LEFT JOIN Employee e ON e.id = p.employeeId
                 LEFT JOIN Variant v ON v.id = p.variantId
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY p.timestamp DESC`
    const r = await turso.execute({ sql, args })

    const pickups = r.rows
    const uniqueEmployees = new Set(pickups.map((p) => String(p.employeeId)))
    const foodCount = pickups.filter((p) => String(p.type) === 'FOOD').length
    const drinkCount = pickups.filter((p) => String(p.type) === 'DRINK').length

    return Response.json({
      report: {
        summary: {
          totalPickups: pickups.length,
          foodPickups: foodCount,
          drinkPickups: drinkCount,
          uniqueEmployees: uniqueEmployees.size,
        },
        rows: pickups.map((p) => ({
          id: String(p.id),
          employeeId: String(p.employeeId),
          variantId: String(p.variantId),
          type: String(p.type) as 'FOOD' | 'DRINK',
          period: String(p.period),
          timestamp: toISO(p.timestamp),
          employee: p.e_id ? { id: String(p.e_id), name: String(p.e_name), code: String(p.e_code) } : undefined,
          variant: p.v_id ? { id: String(p.v_id), name: String(p.v_name), type: String(p.v_type) as 'FOOD' | 'DRINK' } : undefined,
        })),
      },
    })
  }

  // Prisma mode (local dev)
  const where: Record<string, unknown> = { period: targetPeriod }
  if (type) where.type = type
  if (employeeId) where.employeeId = employeeId
  if (variantId) where.variantId = variantId

  const pickups = await (db as PrismaClient).pickup.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    include: { employee: true, variant: true },
  })

  const uniqueEmployees = new Set(pickups.map((p) => p.employeeId))
  const foodCount = pickups.filter((p) => p.type === 'FOOD').length
  const drinkCount = pickups.filter((p) => p.type === 'DRINK').length

  return Response.json({
    report: {
      summary: {
        totalPickups: pickups.length,
        foodPickups: foodCount,
        drinkPickups: drinkCount,
        uniqueEmployees: uniqueEmployees.size,
      },
      rows: pickups.map((p) => ({
        id: p.id,
        employeeId: p.employeeId,
        variantId: p.variantId,
        type: p.type as 'FOOD' | 'DRINK',
        period: p.period,
        timestamp: p.timestamp.toISOString(),
        employee: p.employee ? { id: p.employee.id, name: p.employee.name, code: p.employee.code } : undefined,
        variant: p.variant ? { id: p.variant.id, name: p.variant.name, type: p.variant.type as 'FOOD' | 'DRINK' } : undefined,
      })),
    },
  })
}
