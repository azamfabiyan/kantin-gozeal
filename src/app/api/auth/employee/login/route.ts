import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { createEmployeeToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { name, dateOfBirth } = await req.json()
    if (!name || typeof name !== 'string') {
      return Response.json({ error: 'Nama lengkap wajib diisi' }, { status: 400 })
    }
    if (!dateOfBirth || typeof dateOfBirth !== 'string') {
      return Response.json({ error: 'Tanggal lahir wajib diisi' }, { status: 400 })
    }
    const normalizedName = String(name).trim()
    if (normalizedName.length < 2) {
      return Response.json({ error: 'Nama minimal 2 karakter' }, { status: 400 })
    }
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return Response.json({ error: 'Format tanggal lahir tidak valid' }, { status: 400 })
    }

    // Case-insensitive name search (SQLite lower)
    const employees = await db.employee.findMany({
      where: { active: true },
    })
    const emp = employees.find(
      (e) => e.name.trim().toLowerCase() === normalizedName.toLowerCase(),
    )

    if (!emp) {
      return Response.json({ error: `Karyawan dengan nama "${normalizedName}" tidak ditemukan` }, { status: 404 })
    }

    if (!emp.dateOfBirth) {
      // First login - save DOB
      const updated = await db.employee.update({
        where: { id: emp.id },
        data: { dateOfBirth },
      })
      const token = createEmployeeToken(updated.id)
      return Response.json({
        token,
        employee: { id: updated.id, code: updated.code, name: updated.name, dateOfBirth: updated.dateOfBirth },
      })
    }

    // Must match exactly
    if (emp.dateOfBirth !== dateOfBirth) {
      return Response.json({ error: 'Tanggal lahir tidak cocok' }, { status: 401 })
    }

    const token = createEmployeeToken(emp.id)
    return Response.json({
      token,
      employee: { id: emp.id, code: emp.code, name: emp.name, dateOfBirth: emp.dateOfBirth },
    })
  } catch (e) {
    console.error('[auth/employee/login]', e)
    return Response.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
