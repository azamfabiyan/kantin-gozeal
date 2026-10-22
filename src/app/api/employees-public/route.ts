import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const employees = await db.employee.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true, dateOfBirth: true, active: true },
  })
  return Response.json({ employees })
}
