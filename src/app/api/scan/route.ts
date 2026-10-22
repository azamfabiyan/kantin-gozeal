import { NextRequest } from 'next/server'
import { db, isTurso, turso, toBool, toInt, toISO } from '@/lib/db'
import { getActivePeriod } from '@/lib/auth'
import type { VariantWithStatus } from '@/lib/types'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  if (!employeeId) return Response.json({ error: 'employeeId wajib diisi' }, { status: 400 })

  const activePeriod = await getActivePeriod()

  if (isTurso && turso) {
    // Fetch employee, active variants, pickups this period, and balances in parallel.
    const [empR, variantsR, pickupsR, balancesR] = await Promise.all([
      turso.execute({
        sql: 'SELECT id, code, name, dateOfBirth FROM Employee WHERE id = ?',
        args: [employeeId],
      }),
      turso.execute(
        'SELECT id, name, type, stock, initialStock, active, createdAt FROM Variant WHERE active = 1 ORDER BY type ASC',
      ),
      turso.execute({
        sql: `SELECT p.id, p.employeeId, p.variantId, p.type, p.period, p.timestamp,
                     v.id as v_id, v.name as v_name, v.type as v_type
              FROM Pickup p
              LEFT JOIN Variant v ON v.id = p.variantId
              WHERE p.employeeId = ? AND p.period = ?
              ORDER BY p.timestamp DESC`,
        args: [employeeId, activePeriod],
      }),
      turso.execute({
        sql: 'SELECT variantId, balance FROM EmployeeBalance WHERE employeeId = ?',
        args: [employeeId],
      }),
    ])

    if (empR.rows.length === 0) {
      return Response.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
    }
    const employee = empR.rows[0]

    const balanceMap = new Map<string, number>()
    for (const row of balancesR.rows) {
      balanceMap.set(String(row.variantId), Number(row.balance))
    }

    const foodTaken = pickupsR.rows.filter((p) => String(p.type) === 'FOOD').length
    const drinkTaken = pickupsR.rows.filter((p) => String(p.type) === 'DRINK').length

    const mapVariant = (row: typeof variantsR.rows[number]): VariantWithStatus => {
      const vId = String(row.id)
      const balance = balanceMap.get(vId) ?? 0
      let status: VariantWithStatus['status'] = 'available'
      if (balance <= 0) status = 'no_balance'
      else if (Number(row.stock) <= 0) status = 'out_of_stock'
      return {
        id: vId,
        name: String(row.name),
        type: String(row.type) as 'FOOD' | 'DRINK',
        stock: toInt(row.stock),
        initialStock: toInt(row.initialStock),
        active: toBool(row.active),
        createdAt: toISO(row.createdAt),
        taken: false,
        takenCount: 0,
        balance,
        status,
      }
    }

    const foodVariants = variantsR.rows.filter((r) => String(r.type) === 'FOOD').map(mapVariant)
    const drinkVariants = variantsR.rows.filter((r) => String(r.type) === 'DRINK').map(mapVariant)

    const history = pickupsR.rows.map((p) => ({
      id: String(p.id),
      employeeId: String(p.employeeId),
      variantId: String(p.variantId),
      type: String(p.type) as 'FOOD' | 'DRINK',
      period: String(p.period),
      timestamp: toISO(p.timestamp),
      variant: p.v_id ? { id: String(p.v_id), name: String(p.v_name), type: String(p.v_type) as 'FOOD' | 'DRINK' } : undefined,
    }))

    return Response.json({
      employee: { id: String(employee.id), code: String(employee.code), name: String(employee.name), dateOfBirth: employee.dateOfBirth === null || employee.dateOfBirth === undefined ? null : String(employee.dateOfBirth) },
      activePeriod,
      foodVariants,
      drinkVariants,
      history,
      foodTaken,
      drinkTaken,
    })
  }

  // Prisma mode (local dev)
  const [employee, variants, pickups, balances] = await Promise.all([
    (db as PrismaClient).employee.findUnique({ where: { id: employeeId } }),
    (db as PrismaClient).variant.findMany({ where: { active: true }, orderBy: { type: 'asc' } }),
    (db as PrismaClient).pickup.findMany({
      where: { employeeId, period: activePeriod },
      include: { variant: true },
      orderBy: { timestamp: 'desc' },
    }),
    (db as PrismaClient).employeeBalance.findMany({ where: { employeeId } }),
  ])

  if (!employee) return Response.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

  const balanceMap = new Map(balances.map((b) => [b.variantId, b.balance]))
  const foodTaken = pickups.filter((p) => p.type === 'FOOD').length
  const drinkTaken = pickups.filter((p) => p.type === 'DRINK').length

  const mapVariant = (v: typeof variants[number]): VariantWithStatus => {
    const balance = balanceMap.get(v.id) ?? 0
    let status: VariantWithStatus['status'] = 'available'
    if (balance <= 0) status = 'no_balance'
    else if (v.stock <= 0) status = 'out_of_stock'
    return {
      id: v.id,
      name: v.name,
      type: v.type as 'FOOD' | 'DRINK',
      stock: v.stock,
      initialStock: v.initialStock,
      active: v.active,
      createdAt: v.createdAt.toISOString(),
      taken: false,
      takenCount: 0,
      balance,
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
