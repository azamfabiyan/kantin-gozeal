import { NextRequest } from 'next/server'
import { isTurso, turso, db, genId, toInt } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod } from '@/lib/auth'
import { broadcastEvent } from '@/lib/ws-broadcast'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

// POST /api/variants/[id]/apply-quota
// Apply defaultQuota to all active employees
// Logic: balance = defaultQuota - (pickups in current period)
// This does NOT delete existing pickups - only updates balance
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const activePeriod = await getActivePeriod()

  try {
    if (isTurso && turso) {
      // Get variant + defaultQuota
      const variantR = await turso.execute({
        sql: 'SELECT id, name, defaultQuota FROM Variant WHERE id = ?',
        args: [id],
      })
      if (variantR.rows.length === 0) {
        return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })
      }
      const quota = toInt(variantR.rows[0].defaultQuota)
      const variantName = String(variantR.rows[0].name)

      // Get all active employees
      const employees = await turso.execute('SELECT id FROM Employee WHERE active = 1')

      // For each employee: count pickups in current period, set balance = quota - pickups
      const updateStmts = []
      let updatedCount = 0

      for (const emp of employees.rows) {
        const empId = String(emp.id)

        // Count pickups for this employee + variant in current period
        const pickupsR = await turso.execute({
          sql: 'SELECT COUNT(*) as c FROM Pickup WHERE employeeId = ? AND variantId = ? AND period = ?',
          args: [empId, id, activePeriod],
        })
        const pickupCount = toInt(pickupsR.rows[0].c)
        const newBalance = Math.max(0, quota - pickupCount)

        // Upsert balance
        updateStmts.push({
          sql: 'INSERT INTO EmployeeBalance (id, employeeId, variantId, balance, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(employeeId, variantId) DO UPDATE SET balance = ?, updatedAt = ?',
          args: [genId(), empId, id, newBalance, new Date().toISOString(), new Date().toISOString(), newBalance, new Date().toISOString()],
        })
        updatedCount++
      }

      // Execute all updates
      if (updateStmts.length > 0) {
        await turso.batch(updateStmts)
      }

      await broadcastEvent('variant:updated', { id, action: 'apply-quota' })

      return Response.json({
        ok: true,
        variant: variantName,
        quota,
        employeesUpdated: updatedCount,
        message: `Jatah ${variantName} diatur ke ${quota} per karyawan untuk ${updatedCount} karyawan`,
      })
    }

    // Prisma mode (local dev)
    const variant = await (db as PrismaClient).variant.findUnique({ where: { id } })
    if (!variant) return Response.json({ error: 'Variant tidak ditemukan' }, { status: 404 })

    const quota = variant.defaultQuota
    const employees = await (db as PrismaClient).employee.findMany({ where: { active: true } })

    for (const emp of employees) {
      const pickupCount = await (db as PrismaClient).pickup.count({
        where: { employeeId: emp.id, variantId: id, period: activePeriod },
      })
      const newBalance = Math.max(0, quota - pickupCount)

      await (db as PrismaClient).employeeBalance.upsert({
        where: { employeeId_variantId: { employeeId: emp.id, variantId: id } },
        update: { balance: newBalance },
        create: { employeeId: emp.id, variantId: id, balance: newBalance },
      })
    }

    await broadcastEvent('variant:updated', { id, action: 'apply-quota' })

    return Response.json({
      ok: true,
      variant: variant.name,
      quota,
      employeesUpdated: employees.length,
      message: `Jatah ${variant.name} diatur ke ${quota} per karyawan untuk ${employees.length} karyawan`,
    })
  } catch (e) {
    console.error('[apply-quota]', e)
    return Response.json({ error: 'Gagal menerapkan jatah' }, { status: 500 })
  }
}
