import { verifyAdminToken } from '@/lib/auth'

// Admin guard for API routes - returns adminId or null
export function requireAdmin(req: Request): { adminId: string } | null {
  const token = req.headers.get('x-admin-token') || ''
  return verifyAdminToken(token)
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
