import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_NAME, ensureAdminExists } from '@/lib/auth'
import bcrypt from 'bcryptjs'

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

    if (forceReset) {
      // Delete all seedable data (preserve admin)
      await db.pickup.deleteMany()
      await db.stockHistory.deleteMany()
      await db.variant.deleteMany()
      await db.employee.deleteMany()
      await db.periodSetting.deleteMany()
    }

    // Upsert admin credentials (in case password changed)
    const adminRow = await db.admin.findUnique({ where: { username: ADMIN_USERNAME } })
    if (adminRow) {
      const ok = await bcrypt.compare(ADMIN_PASSWORD, adminRow.passwordHash)
      if (!ok) {
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
        await db.admin.update({
          where: { id: adminRow.id },
          data: { passwordHash, name: ADMIN_NAME },
        })
      }
    }

    // Seed employees
    const existingEmpCount = await db.employee.count()
    let createdEmployees = 0
    if (existingEmpCount === 0) {
      for (let i = 0; i < EMPLOYEE_NAMES.length; i++) {
        const code = `EMP${String(i + 1).padStart(3, '0')}`
        await db.employee.create({
          data: {
            code,
            name: EMPLOYEE_NAMES[i],
            dateOfBirth: null,
            active: true,
          },
        })
        createdEmployees++
      }
    }

    // Seed variants
    const existingVariantCount = await db.variant.count()
    let createdVariants = 0
    if (existingVariantCount === 0) {
      for (const name of FOOD_VARIANTS) {
        const v = await db.variant.create({
          data: { name, type: 'FOOD', stock: 31, initialStock: 31, active: true },
        })
        await db.stockHistory.create({
          data: {
            variantId: v.id,
            changeType: 'SET',
            amount: 31,
            oldStock: 0,
            newStock: 31,
            note: 'Inisialisasi seed',
            changedBy: 'seed',
          },
        })
        createdVariants++
      }
      for (const name of DRINK_VARIANTS) {
        const v = await db.variant.create({
          data: { name, type: 'DRINK', stock: 31, initialStock: 31, active: true },
        })
        await db.stockHistory.create({
          data: {
            variantId: v.id,
            changeType: 'SET',
            amount: 31,
            oldStock: 0,
            newStock: 31,
            note: 'Inisialisasi seed',
            changedBy: 'seed',
          },
        })
        createdVariants++
      }
    }

    // Seed period setting if none
    const periodSetting = await db.periodSetting.findFirst()
    if (!periodSetting) {
      const now = new Date()
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      await db.periodSetting.create({
        data: { currentPeriod: period, resetBy: 'seed' },
      })
    }

    return Response.json({
      ok: true,
      employeesCreated: createdEmployees,
      variantsCreated: createdVariants,
      totalEmployees: await db.employee.count(),
      totalVariants: await db.variant.count(),
    })
  } catch (e) {
    console.error('[seed]', e)
    return Response.json({ error: 'Gagal seed data' }, { status: 500 })
  }
}
