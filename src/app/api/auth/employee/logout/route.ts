import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  return Response.json({ ok: true })
}
