'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from '@/stores/router'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  LogIn, ArrowRight, ArrowLeft, QrCode, Coffee,
  Calendar, Users, Package, AlertCircle, RefreshCw, Info
} from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import Image from 'next/image'

export default function Scanner() {
  const { setRoute } = useRouter()
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [period, setPeriod] = useState<{ currentPeriod: string; startedAt: string; resetBy: string | null; stats: { totalPickups: number; foodPickups: number; drinkPickups: number; uniqueEmployees: number } } | null>(null)
  const [loading, setLoading] = useState(true)

  // Generate QR code containing the current URL (so scanning it opens this app)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const appUrl = window.location.origin + window.location.pathname + '#/picker'
    QRCode.toDataURL(appUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1e40af', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [])

  const loadPeriod = useCallback(async () => {
    setLoading(true)
    try {
      const p = await api.getCurrentPeriod()
      setPeriod(p)
    } catch (e) {
      // Silent fail - period info is not critical for landing
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadPeriod() }, [loadPeriod])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="brand-gradient text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-1.5 shadow-md">
              <Image
                src="/gozeal-logo.png"
                alt="GozEal Logo"
                width={80}
                height={18}
                priority
              />
            </div>
            <div>
              <h1 className="text-xl font-bold">Kantin Gozeal</h1>
              <p className="text-xs text-blue-100">Sistem Jatah Makan & Minum Karyawan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRoute('karyawan/login')}
              className="bg-white/15 hover:bg-white/25 text-white border-white/20"
            >
              <LogIn className="w-4 h-4 mr-1.5" /> Login Karyawan
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRoute('admin/login')}
              className="bg-white/15 hover:bg-white/25 text-white border-white/20"
            >
              <LogIn className="w-4 h-4 mr-1.5" /> Admin
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        <div className="grid md:grid-cols-2 gap-6">
          {/* QR Code Section */}
          <Card className="border-2 border-blue-200 shadow-lg">
            <CardHeader className="brand-gradient text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-lg">
                <QrCode className="w-5 h-5" /> Scan QR untuk Mulai
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl shadow-md mb-4">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" className="w-64 h-64 md:w-72 md:h-72" />
                  ) : (
                    <div className="w-64 h-64 md:w-72 md:h-72 flex items-center justify-center bg-slate-100 rounded">
                      <QrCode className="w-12 h-12 text-slate-400 animate-pulse" />
                    </div>
                  )}
                </div>
                <p className="text-center text-sm text-muted-foreground mb-4 max-w-xs">
                  Arahkan kamera HP ke QR code di atas untuk membuka halaman pengambilan makanan & minuman.
                </p>
                <Button
                  onClick={() => setRoute('picker')}
                  className="w-full brand-gradient"
                  size="lg"
                >
                  <ArrowRight className="w-4 h-4 mr-2" /> Buka Halaman Pengambilan
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Atau klik tombol di atas jika Anda sudah di perangkat ini
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Info & Period Stats */}
          <div className="space-y-4">
            <Card className="border-2 border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" /> Periode Aktif
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Memuat...</p>
                ) : period ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Periode:</span>
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-sm">{period.currentPeriod}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-slate-50 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Pengambilan</p>
                        <p className="text-lg font-bold">{period.stats.totalPickups}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Karyawan Aktif</p>
                        <p className="text-lg font-bold">{period.stats.uniqueEmployees}</p>
                      </div>
                      <div className="p-2 bg-amber-50 rounded-lg text-center">
                        <p className="text-xs text-muted-amber-700">Makanan</p>
                        <p className="text-lg font-bold text-amber-700">{period.stats.foodPickups}</p>
                      </div>
                      <div className="p-2 bg-cyan-50 rounded-lg text-center">
                        <p className="text-xs text-muted-cyan-700">Minuman</p>
                        <p className="text-lg font-bold text-cyan-700">{period.stats.drinkPickups}</p>
                      </div>
                    </div>
                    <Button onClick={loadPeriod} variant="ghost" size="sm" className="w-full">
                      <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Gagal memuat data periode</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-blue-50/50 border-blue-100">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" /> Aturan Pengambilan
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">1.</span>
                    <span>Scan QR atau klik "Buka Halaman Pengambilan"</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">2.</span>
                    <span>Pilih nama Anda dari daftar karyawan</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">3.</span>
                    <span>Pilih variant makanan/minuman yang ingin diambil</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">4.</span>
                    <span>Konfirmasi pilihan Anda sebelum diambil</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">5.</span>
                    <span>1 variant hanya bisa diambil 1x per periode (per bulan)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-blue-600">6.</span>
                    <span>Periode di-reset manual oleh admin</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="mt-auto py-6 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Kantin Gozeal &middot; Sistem Manajemen Jatah Makanan & Minuman Karyawan</p>
      </footer>
    </div>
  )
}
