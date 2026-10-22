import { db, isTurso, turso, toBool } from '@/lib/db'
import type { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (isTurso && turso) {
    const r = await turso.execute(
      'SELECT id, code, name, dateOfBirth, active FROM Employee WHERE active = 1 ORDER BY name ASC',
    )
    const employees = r.rows.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      dateOfBirth: row.dateOfBirth === null || row.dateOfBirth === undefined ? null : String(row.dateOfBirth),
      active: toBool(row.active),
    }))
    return Response.json({ employees })
  }
  const employees = await (db as PrismaClient).employee.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true, dateOfBirth: true, active: true },
  })
  return Response.json({ employees })
}
