import { verifyEmployeeToken } from '@/lib/auth'

export function requireEmployee(req: Request): { employeeId: string } | null {
  const token = req.headers.get('x-employee-token') || ''
  return verifyEmployeeToken(token)
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
