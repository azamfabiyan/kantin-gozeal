import { NextRequest } from 'next/server'
import { db, isTurso, turso, toBool, genId } from '@/lib/db'
import { createEmployeeToken } from '@/lib/auth'
import type { PrismaClient } from '@prisma/client'

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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return Response.json({ error: 'Format tanggal lahir tidak valid' }, { status: 400 })
    }

    let emp: { id: string; code: string; name: string; dateOfBirth: string | null } | null = null

    if (isTurso && turso) {
      // Fetch all active employees and match case-insensitively (SQLite lower() is OK but we
      // normalize in JS for reliable trimming/lowercasing).
      const r = await turso.execute('SELECT id, code, name, dateOfBirth, active FROM Employee WHERE active = 1')
      const lowerTarget = normalizedName.toLowerCase()
      const matched = r.rows.find((row) => {
        const n = String(row.name ?? '').trim().toLowerCase()
        return n === lowerTarget
      })
      if (!matched) {
        return Response.json({ error: `Karyawan dengan nama "${normalizedName}" tidak ditemukan` }, { status: 404 })
      }
      const id = String(matched.id)
      const code = String(matched.code)
      const matchedName = String(matched.name)
      const existingDob = matched.dateOfBirth === null || matched.dateOfBirth === undefined ? null : String(matched.dateOfBirth)

      if (!existingDob) {
        // First login - save DOB
        await turso.execute({
          sql: 'UPDATE Employee SET dateOfBirth = ?, updatedAt = ? WHERE id = ?',
          args: [dateOfBirth, new Date().toISOString(), id],
        })
        emp = { id, code, name: matchedName, dateOfBirth }
      } else if (existingDob !== dateOfBirth) {
        return Response.json({ error: 'Tanggal lahir tidak cocok' }, { status: 401 })
      } else {
        emp = { id, code, name: matchedName, dateOfBirth: existingDob }
      }
    } else {
      // Prisma mode (local dev)
      const employees = await (db as PrismaClient).employee.findMany({ where: { active: true } })
      const found = employees.find(
        (e) => e.name.trim().toLowerCase() === normalizedName.toLowerCase(),
      )
      if (!found) {
        return Response.json({ error: `Karyawan dengan nama "${normalizedName}" tidak ditemukan` }, { status: 404 })
      }
      if (!found.dateOfBirth) {
        const updated = await (db as PrismaClient).employee.update({
          where: { id: found.id },
          data: { dateOfBirth },
        })
        emp = { id: updated.id, code: updated.code, name: updated.name, dateOfBirth: updated.dateOfBirth }
      } else if (found.dateOfBirth !== dateOfBirth) {
        return Response.json({ error: 'Tanggal lahir tidak cocok' }, { status: 401 })
      } else {
        emp = { id: found.id, code: found.code, name: found.name, dateOfBirth: found.dateOfBirth }
      }
    }

    if (!emp) {
      return Response.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }

    const token = createEmployeeToken(emp.id)
    return Response.json({ token, employee: emp })
  } catch (e) {
    console.error('[auth/employee/login]', e)
    return Response.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
