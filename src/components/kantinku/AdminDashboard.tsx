'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useAdmin } from '@/stores/router'
import { api } from '@/lib/api'
import { AdminLayout } from './AdminLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Users, Package, PackageX, AlertTriangle, RefreshCw, RotateCcw, Utensils, CupSoda, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { useWebSocket } from '@/hooks/use-websocket'
import { formatPeriod, formatTimestamp } from '@/lib/auth-client'
import type { DashboardStats } from '@/lib/types'
import { cn } from '@/lib/utils'

export function AdminDashboard() {
  const setRoute = useRouter((s) => s.setRoute)
  const admin = useAdmin((s) => s.admin)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetMode, setResetMode] = useState<'current' | 'next'>('current')
  const [resetting, setResetting] = useState(false)

  const fetchData = useCallback(async () => {
    if (!admin) {
      setRoute('admin/login')
      return
    }
    setLoading(true)
    try {
      const res = await api.getDashboard()
      setStats(res.stats)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat dashboard')
    } finally {
      setLoading(false)
    }
  }, [admin, setRoute])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useWebSocket({
    'pickup:created': () => fetchData(),
    'variant:updated': () => fetchData(),
    'employee:changed': () => fetchData(),
    'period:reset': () => fetchData(),
  })

  const handleReset = async () => {
    setResetting(true)
    try {
      await api.resetPeriod(resetMode)
      toast.success(resetMode === 'current' ? 'Periode aktif telah direset' : 'Periode baru dimulai')
      setResetOpen(false)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal reset periode')
    } finally {
      setResetting(false)
    }
  }

  if (!admin) {
    return (
      <AdminLayout title="Dashboard">
        <div className="text-center py-12">Mengarahkan ke login...</div>
      </AdminLayout>
    )
  }

  const trendData = stats?.periodTrend.map((t) => ({
    period: formatPeriod(t.period),
    Makanan: t.food,
    Minuman: t.drink,
  })) || []
  const pieData = stats?.periodDistribution.map((p) => ({
    name: p.type === 'FOOD' ? 'Makanan' : 'Minuman',
    value: p.count,
    color: p.type === 'FOOD' ? '#d97706' : '#0891b2',
  })) || []

  return (
    <AdminLayout title="Dashboard Monitoring" activeTab="dashboard">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Dashboard Monitoring</h1>
            <p className="text-sm text-muted-foreground">
              Periode aktif: <span className="font-medium">{stats ? formatPeriod(stats.activePeriod) : '...'}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="default" size="sm" onClick={() => setResetOpen(true)} className="brand-gradient text-white">
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Reset Periode
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        {loading && !stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <StatCard icon={<Users className="w-5 h-5" />} label="Total Karyawan" value={stats.totalEmployees} color="blue" />
            <StatCard icon={<Package className="w-5 h-5" />} label="Pengambilan Periode Ini" value={stats.pickupsThisPeriod} color="emerald" />
            <StatCard icon={<PackageX className="w-5 h-5" />} label="Belum Ambil Apa Pun" value={stats.employeesWithoutPickup} color="amber" />
            <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Stok Menipis" value={stats.lowStockCount} color="red" />
          </div>
        ) : null}

        {/* Charts */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base">Tren 6 Periode Terakhir</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Makanan" fill="#d97706" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Minuman" fill="#0891b2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base">Distribusi Periode Ini</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stock cards */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
            <StockCard title="Stok Makanan" icon={<Utensils className="w-5 h-5 text-slate-600" />} variants={stats.foodStock} accent="amber" />
            <StockCard title="Stok Minuman" icon={<CupSoda className="w-5 h-5 text-slate-500" />} variants={stats.drinkStock} accent="cyan" />
          </div>
        )}

        {/* Activity feed */}
        {stats && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Aktivitas Terkini
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentPickups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada aktivitas</p>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-y-auto scroll-area-custom">
                  {stats.recentPickups.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {p.type === 'FOOD' ? (
                          <Utensils className="w-4 h-4 text-slate-600 shrink-0" />
                        ) : (
                          <CupSoda className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {p.employee?.name} <span className="text-muted-foreground font-normal">mengambil</span> {p.variant?.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatTimestamp(p.timestamp)}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">{formatPeriod(p.period)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reset period dialog */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Periode</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Pilih mode reset periode:</p>
                <div className="space-y-2">
                  <label className={cn('flex items-start gap-2 p-3 border rounded-md cursor-pointer', resetMode === 'current' && 'border-slate-700 bg-slate-100 dark:bg-slate-800/30')}>
                    <input
                      type="radio"
                      name="resetMode"
                      checked={resetMode === 'current'}
                      onChange={() => setResetMode('current')}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm text-foreground">Reset Periode Aktif</div>
                      <div className="text-xs text-muted-foreground">Hapus semua pengambilan periode ini & reset stok ke awal</div>
                    </div>
                  </label>
                  <label className={cn('flex items-start gap-2 p-3 border rounded-md cursor-pointer', resetMode === 'next' && 'border-slate-700 bg-slate-100 dark:bg-slate-800/30')}>
                    <input
                      type="radio"
                      name="resetMode"
                      checked={resetMode === 'next'}
                      onChange={() => setResetMode('next')}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm text-foreground">Mulai Periode Baru</div>
                      <div className="text-xs text-muted-foreground">Buat periode baru (bulan berjalan) & reset stok ke awal</div>
                    </div>
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={resetting}
              className="brand-gradient text-white"
            >
              {resetting ? 'Memproses...' : 'Ya, Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'blue' | 'emerald' | 'amber' | 'red' }) {
  const colorMap = {
    blue: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    emerald: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    amber: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    red: 'bg-red-100 text-slate-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn('w-8 h-8 rounded-md flex items-center justify-center', colorMap[color])}>
            {icon}
          </div>
          <span className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{label}</span>
        </div>
        <div className="text-2xl sm:text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function StockCard({ title, icon, variants, accent }: { title: string; icon: React.ReactNode; variants: { id: string; name: string; stock: number; initialStock: number; active: boolean }[]; accent: 'amber' | 'cyan' }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {variants.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada variant</p>
        ) : (
          variants.map((v) => {
            const pct = v.initialStock > 0 ? (v.stock / v.initialStock) * 100 : 0
            return (
              <div key={v.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-medium truncate">{v.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    {v.stock}/{v.initialStock}
                    {!v.active && <Badge variant="secondary" className="ml-1 text-[10px]">Nonaktif</Badge>}
                  </span>
                </div>
                <Progress value={pct} className={cn('h-1.5', accent === 'amber' ? '[&>div]:bg-slate-600' : '[&>div]:bg-slate-400')} />
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
