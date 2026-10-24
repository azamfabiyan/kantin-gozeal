'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter, useEmployee } from '@/stores/router'
import { api } from '@/lib/api'
import { DateOfBirthPicker } from './DateOfBirthPicker'
import { EmployeeLayout } from './EmployeeLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, User, Shield, Info, CheckCircle2, Tv, Utensils, CupSoda, Package, Activity, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface TVData {
  period: string
  stats: { totalEmployees: number; pickupsThisPeriod: number; todayPickups: number }
  foodStock: Array<{ id: string; name: string; stock: number; initialStock: number; active: boolean }>
  drinkStock: Array<{ id: string; name: string; stock: number; initialStock: number; active: boolean }>
  recentPickups: Array<{ id: string; type: string; timestamp: string; employee: { name: string; code: string }; variant: { name: string; type: string } | null }>
}

export function EmployeeLogin() {
  const setRoute = useRouter((s) => s.setRoute)
  const setEmployee = useEmployee((s) => s.setEmployee)
  const [name, setName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [loading, setLoading] = useState(false)
  const [tvData, setTvData] = useState<TVData | null>(null)

  // Fetch TV dashboard data for display on login page
  const fetchTvData = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-dashboard')
      if (res.ok) {
        const d = await res.json()
        setTvData(d)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchTvData()
    const interval = setInterval(fetchTvData, 15000) // refresh every 15s
    return () => clearInterval(interval)
  }, [fetchTvData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Nama lengkap wajib diisi'); return }
    if (!dateOfBirth) { toast.error('Tanggal lahir wajib diisi'); return }
    setLoading(true)
    try {
      const res = await api.employeeLogin(name, dateOfBirth)
      setEmployee(res.employee, res.token)
      if (res.firstLoginSetup) {
        toast.success(`Selamat datang, ${res.employee.name}! Tanggal lahir Anda telah disimpan.`)
      } else {
        toast.success(`Selamat datang, ${res.employee.name}!`)
      }
      setRoute('karyawan/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal login')
    } finally {
      setLoading(false)
    }
  }

  const formatPickupTime = (ts: string) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  return (
    <EmployeeLayout title="Login Karyawan">
      <div className="max-w-5xl mx-auto py-2 sm:py-4 space-y-4">
        
        {/* TOP: Login Form + Quick Stats */}
        <div className="grid md:grid-cols-2 gap-4">
          
          {/* LEFT: Login Form */}
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700/40">
                <User className="w-7 h-7 text-slate-700 dark:text-slate-300" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold">Login Karyawan</h1>
              <p className="text-xs sm:text-sm text-muted-foreground px-2">
                Masuk dengan nama lengkap dan tanggal lahir
              </p>
            </div>

            <Card>
              <CardContent className="pt-4 p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-medium">
                      Nama Lengkap <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: BAYU"
                      autoComplete="off"
                      disabled={loading}
                      className="h-11"
                    />
                  </div>
                  <DateOfBirthPicker
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    required
                    description="Pilih tanggal, bulan, dan tahun lahir"
                  />
                  <Button type="submit" className="w-full h-11 brand-gradient text-white" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {loading ? 'Memproses...' : 'Masuk'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Info box */}
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/50 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>1. Login pertama: tanggal lahir disimpan otomatis</p>
                <p>2. Login berikutnya: gunakan tanggal lahir yang sama</p>
                <p>3. Jika lupa, hubungi admin</p>
              </div>
            </div>

            {/* Quick links */}
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setRoute('admin/login')} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted/50">
                <Shield className="w-3.5 h-3.5" /> Admin
              </button>
              <span className="text-muted-foreground/30">|</span>
              <button onClick={() => setRoute('tv')} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted/50">
                <Tv className="w-3.5 h-3.5" /> Dashboard TV
              </button>
            </div>
          </div>

          {/* RIGHT: Quick Stats + Stock Overview */}
          {tvData && (
            <div className="space-y-3">
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-card border rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Karyawan</span>
                  </div>
                  <p className="text-lg sm:text-xl font-bold mt-0.5">{tvData.stats.totalEmployees}</p>
                </div>
                <div className="bg-card border rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Periode Ini</span>
                  </div>
                  <p className="text-lg sm:text-xl font-bold mt-0.5">{tvData.stats.pickupsThisPeriod}</p>
                </div>
                <div className="bg-card border rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Hari Ini</span>
                  </div>
                  <p className="text-lg sm:text-xl font-bold mt-0.5">{tvData.stats.todayPickups}</p>
                </div>
              </div>

              {/* Stock Overview - Food */}
              <div className="bg-card border rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Utensils className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-bold">Stok Makanan</h3>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {tvData.foodStock.map(v => {
                    const low = v.stock <= 5
                    const empty = v.stock === 0
                    return (
                      <div key={v.id} className="flex items-center justify-between text-xs">
                        <span className="truncate">{v.name}</span>
                        <span className={`font-bold ${empty ? 'text-red-600' : low ? 'text-amber-600' : 'text-slate-700'}`}>
                          {v.stock}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Stock Overview - Drinks */}
              <div className="bg-card border rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <CupSoda className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-bold">Stok Minuman</h3>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {tvData.drinkStock.map(v => {
                    const low = v.stock <= 5
                    const empty = v.stock === 0
                    return (
                      <div key={v.id} className="flex items-center justify-between text-xs">
                        <span className="truncate">{v.name}</span>
                        <span className={`font-bold ${empty ? 'text-red-600' : low ? 'text-amber-600' : 'text-slate-700'}`}>
                          {v.stock}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-card border rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-bold">Aktivitas Terkini</h3>
                </div>
                <div className="space-y-1 max-h-32 overflow-hidden">
                  {tvData.recentPickups.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Belum ada pengambilan</p>
                  ) : (
                    tvData.recentPickups.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-xs py-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {p.type === 'FOOD' ? <Utensils className="w-3 h-3 text-slate-500 shrink-0" /> : <CupSoda className="w-3 h-3 text-slate-400 shrink-0" />}
                          <span className="font-medium truncate">{p.employee.name}</span>
                          <span className="text-muted-foreground truncate hidden sm:inline">{p.variant?.name}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0">{formatPickupTime(p.timestamp)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </EmployeeLayout>
  )
}
