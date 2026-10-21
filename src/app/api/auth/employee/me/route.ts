import { NextRequest } from 'next/server'
import { getEmployeeFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const emp = await getEmployeeFromRequest(req)
  if (!emp) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return Response.json({ employee: emp })
}
