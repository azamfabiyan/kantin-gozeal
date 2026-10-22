import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const activePeriod = await getActivePeriod()
  const employees = await db.employee.findMany({
    orderBy: { code: 'asc' },
    include: {
      pickups: { where: { period: activePeriod } },
    },
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

    // Generate next employee code
    const count = await db.employee.count()
    const code = `EMP${String(count + 1).padStart(3, '0')}`

    const emp = await db.employee.create({
      data: {
        code,
        name: String(name).trim(),
        dateOfBirth: dateOfBirth || null,
        active: active !== false,
      },
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
