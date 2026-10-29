import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'

// GET /api/qr/[code] - generate QR code PNG for given employee code
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!code) {
    return NextResponse.json({ error: 'Code wajib diisi' }, { status: 400 })
  }

  // Verify employee exists
  const emp = await db.employee.findUnique({ where: { code } })
  if (!emp) {
    return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
  }

  try {
    const buffer = await QRCode.toBuffer(code, {
      type: 'png',
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Gagal generate QR' }, { status: 500 })
  }
}
