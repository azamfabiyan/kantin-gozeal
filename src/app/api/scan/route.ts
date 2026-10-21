import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getActivePeriod } from '@/lib/auth'
import type { VariantWithStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  if (!employeeId) return Response.json({ error: 'employeeId wajib diisi' }, { status: 400 })

  const activePeriod = await getActivePeriod()

  const [employee, variants, pickups] = await Promise.all([
    db.employee.findUnique({ where: { id: employeeId } }),
    db.variant.findMany({ where: { active: true }, orderBy: { type: 'asc' } }),
    db.pickup.findMany({
      where: { employeeId, period: activePeriod },
      include: { variant: true },
      orderBy: { timestamp: 'desc' },
    }),
  ])

  if (!employee) return Response.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

  const takenVariantIds = new Set(pickups.map((p) => p.variantId))
  const foodTaken = pickups.filter((p) => p.type === 'FOOD').length
  const drinkTaken = pickups.filter((p) => p.type === 'DRINK').length

  const mapVariant = (v: typeof variants[number]): VariantWithStatus => {
    const taken = takenVariantIds.has(v.id)
    let status: VariantWithStatus['status'] = 'available'
    if (taken) status = 'taken'
    else if (v.stock <= 0) status = 'out_of_stock'
    return {
      id: v.id,
      name: v.name,
      type: v.type as 'FOOD' | 'DRINK',
      stock: v.stock,
      initialStock: v.initialStock,
      active: v.active,
      createdAt: v.createdAt.toISOString(),
      taken,
      takenCount: 0,
      status,
    }
  }

  const foodVariants = variants.filter((v) => v.type === 'FOOD').map(mapVariant)
  const drinkVariants = variants.filter((v) => v.type === 'DRINK').map(mapVariant)

  const history = pickups.map((p) => ({
    id: p.id,
    employeeId: p.employeeId,
    variantId: p.variantId,
    type: p.type as 'FOOD' | 'DRINK',
    period: p.period,
    timestamp: p.timestamp.toISOString(),
    variant: p.variant ? { id: p.variant.id, name: p.variant.name, type: p.variant.type as 'FOOD' | 'DRINK' } : undefined,
  }))

  return Response.json({
    employee: { id: employee.id, code: employee.code, name: employee.name, dateOfBirth: employee.dateOfBirth },
    activePeriod,
    foodVariants,
    drinkVariants,
    history,
    foodTaken,
    drinkTaken,
  })
}
