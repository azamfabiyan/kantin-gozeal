import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'

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
    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

    const emp = await db.employee.update({
      where: { id },
      data: {
        name: String(name).trim(),
        dateOfBirth: dateOfBirth || null,
        active: active !== false,
      },
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
    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

    await db.employee.delete({ where: { id } })
    await broadcastEvent('employee:changed', { id, action: 'delete' })
    return Response.json({ ok: true })
  } catch (e) {
    console.error('[employees DELETE]', e)
    return Response.json({ error: 'Gagal menghapus karyawan' }, { status: 500 })
  }
}
