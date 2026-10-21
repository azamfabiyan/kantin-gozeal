import { NextRequest } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return Response.json({ admin })
}
