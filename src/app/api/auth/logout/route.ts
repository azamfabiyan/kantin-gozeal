import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  // Stateless tokens - client just clears local storage
  return Response.json({ ok: true })
}
