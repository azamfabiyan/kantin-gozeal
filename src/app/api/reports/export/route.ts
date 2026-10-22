import { NextRequest } from 'next/server'
import { db, isTurso, turso } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod } from '@/lib/auth'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period')
  const type = searchParams.get('type') as 'FOOD' | 'DRINK' | null
  const employeeId = searchParams.get('employeeId')
  const variantId = searchParams.get('variantId')

  const activePeriod = await getActivePeriod()
  const targetPeriod = period || activePeriod

  // Build the row list for CSV export.
  type CsvRow = {
    period: string
    timestamp: string // ISO string
    employeeCode: string
    employeeName: string
    type: string
    variantName: string
  }

  let rows: CsvRow[] = []

  if (isTurso && turso) {
    const conditions = ['p.period = ?']
    const args: unknown[] = [targetPeriod]
    if (type) {
      conditions.push('p.type = ?')
      args.push(type)
    }
    if (employeeId) {
      conditions.push('p.employeeId = ?')
      args.push(employeeId)
    }
    if (variantId) {
      conditions.push('p.variantId = ?')
      args.push(variantId)
    }
    const sql = `SELECT p.period, p.timestamp, p.type,
                        e.code as e_code, e.name as e_name,
                        v.name as v_name
                 FROM Pickup p
                 LEFT JOIN Employee e ON e.id = p.employeeId
                 LEFT JOIN Variant v ON v.id = p.variantId
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY p.timestamp DESC`
    const r = await turso.execute({ sql, args })
    rows = r.rows.map((row) => ({
      period: String(row.period),
      timestamp: row.timestamp === null || row.timestamp === undefined ? new Date().toISOString() : String(row.timestamp),
      employeeCode: row.e_code === null || row.e_code === undefined ? '' : String(row.e_code),
      employeeName: row.e_name === null || row.e_name === undefined ? '' : String(row.e_name),
      type: String(row.type),
      variantName: row.v_name === null || row.v_name === undefined ? '' : String(row.v_name),
    }))
  } else {
    const where: Record<string, unknown> = { period: targetPeriod }
    if (type) where.type = type
    if (employeeId) where.employeeId = employeeId
    if (variantId) where.variantId = variantId
    const pickups = await (db as PrismaClient).pickup.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: { employee: true, variant: true },
    })
    rows = pickups.map((p) => ({
      period: p.period,
      timestamp: p.timestamp.toISOString(),
      employeeCode: p.employee?.code || '',
      employeeName: p.employee?.name || '',
      type: p.type,
      variantName: p.variant?.name || '',
    }))
  }

  const escapeCsv = (s: string) => {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const header = ['Periode', 'Tanggal', 'Waktu', 'Kode Karyawan', 'Nama Karyawan', 'Tipe', 'Nama Variant']
  const csvRows = rows.map((p) => {
    const d = new Date(p.timestamp)
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    return [
      p.period,
      dateStr,
      timeStr,
      p.employeeCode,
      p.employeeName,
      p.type === 'FOOD' ? 'Makanan' : 'Minuman',
      p.variantName,
    ].map(escapeCsv).join(',')
  })

  const csv = [header.join(','), ...csvRows].join('\n')
  return Response.json({ csv })
}
