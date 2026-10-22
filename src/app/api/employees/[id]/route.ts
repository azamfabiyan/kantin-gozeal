import { NextRequest } from 'next/server'
import { db, isTurso, turso, toBool, toISO, genId } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
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
      const existingR = await turso.execute({ sql: 'SELECT id FROM Employee WHERE id = ?', args: [id] })
      if (existingR.rows.length === 0) {
        return Response.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
      }
      await turso.execute({
        sql: 'UPDATE Employee SET name = ?, dateOfBirth = ?, active = ?, updatedAt = ? WHERE id = ?',
        args: [trimmedName, dateOfBirth || null, activeFlag ? 1 : 0, nowIso, id],
      })
      await broadcastEvent('employee:changed', { id, action: 'update' })
      return Response.json({
        employee: { id, code: String(existingR.rows[0].code ?? ''), name: trimmedName, dateOfBirth: dateOfBirth || null, active: activeFlag },
      })
    }

    const existing = await (db as PrismaClient).employee.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
    const emp = await (db as PrismaClient).employee.update({
      where: { id },
      data: { name: trimmedName, dateOfBirth: dateOfBirth || null, active: activeFlag },
    })
    await broadcastEvent('employee:changed', { id: emp.id, action: 'update' })
    return Response.json({
      employee: { id: emp.id, code: emp.code, name: emp.name, dateOfBirth: emp.dateOfBirth, active: emp.active },
    })
  } catch (e) {
    console.error('[employees PUT]', e)
    return Response.json({ error: 'Gagal memperbarui karyawan' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    if (isTurso && turso) {
      const existingR = await turso.execute({ sql: 'SELECT id FROM Employee WHERE id = ?', args: [id] })
      if (existingR.rows.length === 0) {
        return Response.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
      }
      // Cascade: delete pickups, balances, then employee
      await turso.execute({ sql: 'DELETE FROM Pickup WHERE employeeId = ?', args: [id] })
      await turso.execute({ sql: 'DELETE FROM EmployeeBalance WHERE employeeId = ?', args: [id] })
      await turso.execute({ sql: 'DELETE FROM Employee WHERE id = ?', args: [id] })
      await broadcastEvent('employee:changed', { id, action: 'delete' })
      return Response.json({ ok: true })
    }

    const existing = await (db as PrismaClient).employee.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
    await (db as PrismaClient).employee.delete({ where: { id } })
    await broadcastEvent('employee:changed', { id, action: 'delete' })
    return Response.json({ ok: true })
  } catch (e) {
    console.error('[employees DELETE]', e)
    return Response.json({ error: 'Gagal menghapus karyawan' }, { status: 500 })
  }
}
