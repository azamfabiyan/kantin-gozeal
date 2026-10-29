import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireEmployee } from '@/lib/employee-guard'

// GET /api/employee/dashboard - employee's own dashboard data (period-based)
export async function GET(req: NextRequest) {
  const guard = requireEmployee(req)
  if (!guard.ok) return guard.response

  const emp = await db.employee.findUnique({
    where: { id: guard.employeeId },
  })
  if (!emp) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

  // Get current period
  let periodSetting = await db.periodSetting.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  if (!periodSetting) {
    periodSetting = await db.periodSetting.create({
      data: { currentPeriod: new Date().toISOString().slice(0, 7) },
    })
  }
  const currentPeriod = periodSetting.currentPeriod

  // Get all variants
  const allVariants = await db.variant.findMany({
    where: { active: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  // Get pickups for this employee in current period
  const periodPickups = await db.pickup.findMany({
    where: { employeeId: guard.employeeId, period: currentPeriod },
    include: { variant: { select: { name: true, type: true } } },
    orderBy: { timestamp: 'asc' },
  })

  // Build variant list with status
  const variants = allVariants.map((v) => {
    const taken = periodPickups.find((p) => p.variantId === v.id)
    return {
      id: v.id,
      name: v.name,
      type: v.type,
      stock: v.stock,
      initialStock: v.initialStock,
      status: taken ? 'taken' as const : (v.stock > 0 ? 'available' as const : 'out_of_stock' as const),
      takenAt: taken?.timestamp ?? null,
    }
  })

  const foodTaken = periodPickups.filter((p) => p.type === 'FOOD').length
  const drinkTaken = periodPickups.filter((p) => p.type === 'DRINK').length
  const foodTotal = allVariants.filter((v) => v.type === 'FOOD').length
  const drinkTotal = allVariants.filter((v) => v.type === 'DRINK').length

  return NextResponse.json({
    employee: {
      id: emp.id,
      code: emp.code,
      name: emp.name,
      department: emp.department,
    },
    period: {
      current: currentPeriod,
      startedAt: periodSetting.startedAt,
    },
    summary: {
      foodTaken,
      drinkTaken,
      foodTotal,
      drinkTotal,
      totalTaken: periodPickups.length,
      totalVariants: allVariants.length,
    },
    history: periodPickups.map((p) => ({
      id: p.id,
      type: p.type,
      variantId: p.variantId,
      variantName: p.variant?.name ?? null,
      timestamp: p.timestamp,
    })),
    variants,
  })
}
