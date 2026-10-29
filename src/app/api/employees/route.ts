import { NextRequest } from 'next/server'
import { db, isTurso, turso, toBool, toISO, genId } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const activePeriod = await getActivePeriod()

  if (isTurso && turso) {
    const empsR = await turso.execute(
      'SELECT id, code, name, dateOfBirth, active, createdAt FROM Employee ORDER BY code ASC',
    )
    const pickupsR = await turso.execute({
      sql: 'SELECT employeeId, type FROM Pickup WHERE period = ?',
      args: [activePeriod],
    })
    // Build pickup counts per employee
    const foodMap = new Map<string, number>()
    const drinkMap = new Map<string, number>()
    for (const row of pickupsR.rows) {
      const eId = String(row.employeeId)
      const type = String(row.type)
      if (type === 'FOOD') foodMap.set(eId, (foodMap.get(eId) || 0) + 1)
      else drinkMap.set(eId, (drinkMap.get(eId) || 0) + 1)
    }
    const employees = empsR.rows.map((row) => {
      const eId = String(row.id)
      const foodPickups = foodMap.get(eId) || 0
      const drinkPickups = drinkMap.get(eId) || 0
      return {
        id: eId,
        code: String(row.code),
        name: String(row.name),
        dateOfBirth: row.dateOfBirth === null || row.dateOfBirth === undefined ? null : String(row.dateOfBirth),
        active: toBool(row.active),
        createdAt: toISO(row.createdAt),
        foodPickups,
        drinkPickups,
        totalPickups: foodPickups + drinkPickups,
      }
    })
    return Response.json({ employees, activePeriod })
  }

  // Prisma mode (local dev)
  const employees = await (db as PrismaClient).employee.findMany({
    orderBy: { code: 'asc' },
    include: { pickups: { where: { period: activePeriod } } },
  })
  const result = employees.map((e) => {
    const foodPickups = e.pickups.filter((p) => p.type === 'FOOD').length
    const drinkPickups = e.pickups.filter((p) => p.type === 'DRINK').length
    return {
      id: e.id,
      code: e.code,
      name: e.name,
      dateOfBirth: e.dateOfBirth,
      active: e.active,
      createdAt: e.createdAt.toISOString(),
      foodPickups,
      drinkPickups,
      totalPickups: foodPickups + drinkPickups,
    }
  })
  return Response.json({ employees: result, activePeriod })
}

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, dateOfBirth, active } = await req.json()
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return Response.json({ error: 'Nama minimal 2 karakter' }, { status: 400 })
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return Response.json({ error: 'Format tanggal lahir tidak valid' }, { status: 400 })
    }

    const trimmedName = String(name).trim()
    const activeFlag = active !== false
    const nowIso = new Date().toISOString()

    if (isTurso && turso) {
      // Generate unique employee code - find max number and +1
      const codesR = await turso.execute('SELECT code FROM Employee ORDER BY code DESC LIMIT 1')
      let nextNum = 1
      if (codesR.rows.length > 0) {
        const lastCode = String((codesR.rows[0] as { code: string }).code)
        const match = lastCode.match(/EMP(\d+)/)
        if (match) nextNum = parseInt(match[1], 10) + 1
      }
      const code = `EMP${String(nextNum).padStart(3, '0')}`
      const id = genId()
      await turso.execute({
        sql: 'INSERT INTO Employee (id, code, name, dateOfBirth, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [id, code, trimmedName, dateOfBirth || null, activeFlag ? 1 : 0, nowIso, nowIso],
      })
      // Auto-create EmployeeBalance (saldo=1) untuk semua variant aktif
      const variants = await turso.execute('SELECT id FROM Variant WHERE active = 1')
      const balanceStmts = variants.rows.map((v) => ({
        sql: 'INSERT OR IGNORE INTO EmployeeBalance (id, employeeId, variantId, balance, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)',
        args: [genId(), id, String(v.id), nowIso, nowIso],
      }))
      if (balanceStmts.length > 0) {
        await turso.batch(balanceStmts)
      }
      await broadcastEvent('employee:changed', { id, action: 'create' })
      return Response.json({
        employee: { id, code, name: trimmedName, dateOfBirth: dateOfBirth || null, active: activeFlag },
      })
    }

    // Prisma mode (local dev)
    // Find max code number + 1
    const lastEmp = await (db as PrismaClient).employee.findFirst({ orderBy: { code: 'desc' } })
    let nextNum = 1
    if (lastEmp) {
      const match = lastEmp.code.match(/EMP(d+)/)
      if (match) nextNum = parseInt(match[1], 10) + 1
    }
    const code = `EMP${String(nextNum).padStart(3, '0')}`
    const emp = await (db as PrismaClient).employee.create({
      data: { code, name: trimmedName, dateOfBirth: dateOfBirth || null, active: activeFlag },
    })
    // Auto-create EmployeeBalance
    const activeVariants = await (db as PrismaClient).variant.findMany({ where: { active: true } })
    await (db as PrismaClient).employeeBalance.createMany({
      data: activeVariants.map((v) => ({ employeeId: emp.id, variantId: v.id, balance: 1 })),
      skipDuplicates: true,
    })
    await broadcastEvent('employee:changed', { id: emp.id, action: 'create' })
    return Response.json({
      employee: { id: emp.id, code: emp.code, name: emp.name, dateOfBirth: emp.dateOfBirth, active: emp.active },
    })
  } catch (e) {
    console.error('[employees POST]', e)
    return Response.json({ error: 'Gagal membuat karyawan' }, { status: 500 })
  }
}
