import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod } from '@/lib/auth'

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

  const where: Record<string, unknown> = { period: targetPeriod }
  if (type) where.type = type
  if (employeeId) where.employeeId = employeeId
  if (variantId) where.variantId = variantId

  const pickups = await db.pickup.findMany({
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
