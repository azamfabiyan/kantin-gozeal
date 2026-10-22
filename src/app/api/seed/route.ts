import { NextRequest } from 'next/server'
import { db, isTurso, turso, toBool, genId } from '@/lib/db'
import { getAdminFromRequest, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_NAME, ensureAdminExists } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const EMPLOYEE_NAMES = [
  'ADIS', 'ALDI NURFAUZI', 'ALIF', 'ANGGA', 'ANGGARA', 'AZAM FABIYAN MUFAZAL HAQ',
  'BAGAS', 'BAYU', 'DIMAS', 'DITO', 'FERDI', 'FIKRI', 'GHIDAM', 'HILAL', 'ILHAM',
  'INDRA', 'KIPOY', 'LUKMAN', 'NADIA', 'NAYA', 'OVI', 'RAMA', 'RIZKI', 'SAHRUL',
  'TOMI', 'VINO', 'YOGA', 'ZAKI',
]

const FOOD_VARIANTS = ['AOKA', 'CHITATO', 'MIE ENAK', 'POP MIE', 'TARO', 'WAFLE']
const DRINK_VARIANTS = ['HYDROCOCO', 'MIZONE', 'NESCAFE', 'POCARI']

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { forceReset } = await req.json()
    await ensureAdminExists()

    if (isTurso && turso) {
      const nowIso = new Date().toISOString()

      if (forceReset) {
        // Delete all seedable data (preserve admin)
        await turso.execute('DELETE FROM Pickup')
        await turso.execute('DELETE FROM StockHistory')
        await turso.execute('DELETE FROM EmployeeBalance')
        await turso.execute('DELETE FROM Variant')
        await turso.execute('DELETE FROM Employee')
        await turso.execute('DELETE FROM PeriodSetting')
      }

      // Upsert admin credentials (in case password changed)
      const adminR = await turso.execute({
        sql: 'SELECT id, passwordHash FROM Admin WHERE username = ?',
        args: [ADMIN_USERNAME],
      })
      if (adminR.rows.length > 0) {
        const adminRow = adminR.rows[0]
        const ok = await bcrypt.compare(ADMIN_PASSWORD, String(adminRow.passwordHash))
        if (!ok) {
          const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
          await turso.execute({
            sql: 'UPDATE Admin SET passwordHash = ?, name = ?, updatedAt = ? WHERE id = ?',
            args: [passwordHash, ADMIN_NAME, nowIso, String(adminRow.id)],
          })
        }
      }

      // Seed employees
      const empCntR = await turso.execute('SELECT COUNT(*) as cnt FROM Employee')
      let createdEmployees = 0
      if (Number((empCntR.rows[0] as { cnt: number | bigint }).cnt) === 0) {
        for (let i = 0; i < EMPLOYEE_NAMES.length; i++) {
          const code = `EMP${String(i + 1).padStart(3, '0')}`
          await turso.execute({
            sql: 'INSERT INTO Employee (id, code, name, dateOfBirth, active, createdAt, updatedAt) VALUES (?, ?, ?, NULL, 1, ?, ?)',
            args: [genId(), code, EMPLOYEE_NAMES[i], nowIso, nowIso],
          })
          createdEmployees++
        }
      }

      // Seed variants
      const variantCntR = await turso.execute('SELECT COUNT(*) as cnt FROM Variant')
      let createdVariants = 0
      if (Number((variantCntR.rows[0] as { cnt: number | bigint }).cnt) === 0) {
        for (const name of FOOD_VARIANTS) {
          const id = genId()
          await turso.batch([
            {
              sql: 'INSERT INTO Variant (id, name, type, stock, initialStock, active, createdAt, updatedAt) VALUES (?, ?, ?, 31, 31, 1, ?, ?)',
              args: [id, name, 'FOOD', nowIso, nowIso],
            },
            {
              sql: 'INSERT INTO StockHistory (id, variantId, changeType, amount, oldStock, newStock, note, changedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              args: [genId(), id, 'SET', 31, 0, 31, 'Inisialisasi seed', 'seed', nowIso],
            },
          ])
          createdVariants++
        }
        for (const name of DRINK_VARIANTS) {
          const id = genId()
          await turso.batch([
            {
              sql: 'INSERT INTO Variant (id, name, type, stock, initialStock, active, createdAt, updatedAt) VALUES (?, ?, ?, 31, 31, 1, ?, ?)',
              args: [id, name, 'DRINK', nowIso, nowIso],
            },
            {
              sql: 'INSERT INTO StockHistory (id, variantId, changeType, amount, oldStock, newStock, note, changedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              args: [genId(), id, 'SET', 31, 0, 31, 'Inisialisasi seed', 'seed', nowIso],
            },
          ])
          createdVariants++
        }
      }

      // Seed period setting if none
      const periodR = await turso.execute('SELECT id FROM PeriodSetting LIMIT 1')
      if (periodR.rows.length === 0) {
        const now = new Date()
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        await turso.execute({
          sql: 'INSERT INTO PeriodSetting (id, currentPeriod, startedAt, resetBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          args: [genId(), period, nowIso, 'seed', nowIso, nowIso],
        })
      }

      const finalEmpCntR = await turso.execute('SELECT COUNT(*) as cnt FROM Employee')
      const finalVariantCntR = await turso.execute('SELECT COUNT(*) as cnt FROM Variant')
      return Response.json({
        ok: true,
        employeesCreated: createdEmployees,
        variantsCreated: createdVariants,
        totalEmployees: Number((finalEmpCntR.rows[0] as { cnt: number | bigint }).cnt),
        totalVariants: Number((finalVariantCntR.rows[0] as { cnt: number | bigint }).cnt),
      })
    }

    // Prisma mode (local dev)
    if (forceReset) {
      await (db as PrismaClient).pickup.deleteMany()
      await (db as PrismaClient).stockHistory.deleteMany()
      await (db as PrismaClient).employeeBalance.deleteMany()
      await (db as PrismaClient).variant.deleteMany()
      await (db as PrismaClient).employee.deleteMany()
      await (db as PrismaClient).periodSetting.deleteMany()
    }

    // Upsert admin credentials (in case password changed)
    const adminRow = await (db as PrismaClient).admin.findUnique({ where: { username: ADMIN_USERNAME } })
    if (adminRow) {
      const ok = await bcrypt.compare(ADMIN_PASSWORD, adminRow.passwordHash)
      if (!ok) {
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
        await (db as PrismaClient).admin.update({
          where: { id: adminRow.id },
          data: { passwordHash, name: ADMIN_NAME },
        })
      }
    }

    // Seed employees
    const existingEmpCount = await (db as PrismaClient).employee.count()
    let createdEmployees = 0
    if (existingEmpCount === 0) {
      for (let i = 0; i < EMPLOYEE_NAMES.length; i++) {
        const code = `EMP${String(i + 1).padStart(3, '0')}`
        await (db as PrismaClient).employee.create({
          data: { code, name: EMPLOYEE_NAMES[i], dateOfBirth: null, active: true },
        })
        createdEmployees++
      }
    }

    // Seed variants
    const existingVariantCount = await (db as PrismaClient).variant.count()
    let createdVariants = 0
    if (existingVariantCount === 0) {
      for (const name of FOOD_VARIANTS) {
        const v = await (db as PrismaClient).variant.create({
          data: { name, type: 'FOOD', stock: 31, initialStock: 31, active: true },
        })
        await (db as PrismaClient).stockHistory.create({
          data: { variantId: v.id, changeType: 'SET', amount: 31, oldStock: 0, newStock: 31, note: 'Inisialisasi seed', changedBy: 'seed' },
        })
        createdVariants++
      }
      for (const name of DRINK_VARIANTS) {
        const v = await (db as PrismaClient).variant.create({
          data: { name, type: 'DRINK', stock: 31, initialStock: 31, active: true },
        })
        await (db as PrismaClient).stockHistory.create({
          data: { variantId: v.id, changeType: 'SET', amount: 31, oldStock: 0, newStock: 31, note: 'Inisialisasi seed', changedBy: 'seed' },
        })
        createdVariants++
      }
    }

    // Seed period setting if none
    const periodSetting = await (db as PrismaClient).periodSetting.findFirst()
    if (!periodSetting) {
      const now = new Date()
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      await (db as PrismaClient).periodSetting.create({ data: { currentPeriod: period, resetBy: 'seed' } })
    }

    return Response.json({
      ok: true,
      employeesCreated: createdEmployees,
      variantsCreated: createdVariants,
      totalEmployees: await (db as PrismaClient).employee.count(),
      totalVariants: await (db as PrismaClient).variant.count(),
    })
  } catch (e) {
    console.error('[seed]', e)
    return Response.json({ error: 'Gagal seed data' }, { status: 500 })
  }
}
