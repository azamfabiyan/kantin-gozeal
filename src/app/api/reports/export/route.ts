import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest, getActivePeriod } from '@/lib/auth'

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

  const where: Record<string, unknown> = { period: targetPeriod }
  if (type) where.type = type
  if (employeeId) where.employeeId = employeeId
  if (variantId) where.variantId = variantId

  const pickups = await db.pickup.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    include: { employee: true, variant: true },
  })

  const escapeCsv = (s: string) => {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const header = ['Periode', 'Tanggal', 'Waktu', 'Kode Karyawan', 'Nama Karyawan', 'Tipe', 'Nama Variant']
  const rows = pickups.map((p) => {
    const d = p.timestamp
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    return [
      p.period,
      dateStr,
      timeStr,
      p.employee?.code || '',
      p.employee?.name || '',
      p.type === 'FOOD' ? 'Makanan' : 'Minuman',
      p.variant?.name || '',
    ].map(escapeCsv).join(',')
  })

  const csv = [header.join(','), ...rows].join('\n')
  return Response.json({ csv })
}
