import { NextRequest } from 'next/server'
import { authenticateAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return Response.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
    }
    const result = await authenticateAdmin(String(username).trim(), String(password))
    if (!result) {
      return Response.json({ error: 'Username atau password salah' }, { status: 401 })
    }
    return Response.json({ token: result.token, admin: result.admin })
  } catch (e) {
    console.error('[auth/login]', e)
    return Response.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
