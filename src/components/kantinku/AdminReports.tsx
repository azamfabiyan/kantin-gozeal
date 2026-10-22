'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useAdmin } from '@/stores/router'
import { api } from '@/lib/api'
import { AdminLayout } from './AdminLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Utensils, CupSoda, Download, Users, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useWebSocket } from '@/hooks/use-websocket'
import { formatPeriod, formatTimestamp } from '@/lib/auth-client'
import type { EmployeeInfo, ReportData, VariantInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

export function AdminReports() {
  const setRoute = useRouter((s) => s.setRoute)
  const admin = useAdmin((s) => s.admin)
  const [period, setPeriod] = useState<string>('current')
  const [type, setType] = useState<'all' | 'FOOD' | 'DRINK'>('all')
  const [employeeId, setEmployeeId] = useState<string>('all')
  const [variantId, setVariantId] = useState<string>('all')
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const [variants, setVariants] = useState<VariantInfo[]>([])
  const [currentPeriod, setCurrentPeriod] = useState('')

  const fetchMeta = useCallback(async () => {
    try {
      const [empRes, varRes, periodRes] = await Promise.all([
        api.listEmployeesPublic(),
        api.listVariants(),
        api.getCurrentPeriod(),
      ])
      setEmployees(empRes.employees)
      setVariants(varRes.variants)
      setCurrentPeriod(periodRes.period.currentPeriod)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat metadata')
    }
  }, [])

  const fetchReport = useCallback(async () => {
    if (!admin) {
      setRoute('admin/login')
      return
    }
    setLoading(true)
    try {
      const filters: {
        period?: string
        type?: 'FOOD' | 'DRINK'
        employeeId?: string
        variantId?: string
      } = {}
      if (period !== 'current') filters.period = period
      else filters.period = currentPeriod || undefined
      if (type !== 'all') filters.type = type
      if (employeeId !== 'all') filters.employeeId = employeeId
      if (variantId !== 'all') filters.variantId = variantId
      const res = await api.getReports(filters)
      setReport(res.report)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat laporan')
    } finally {
      setLoading(false)
    }
  }, [admin, setRoute, period, type, employeeId, variantId, currentPeriod])

  useEffect(() => {
    fetchMeta()
  }, [fetchMeta])

  useEffect(() => {
    if (currentPeriod) fetchReport()
  }, [fetchReport, currentPeriod])

  useWebSocket({
    'pickup:created': () => fetchReport(),
    'period:reset': () => { fetchMeta(); fetchReport() },
  })

  const handleExport = async () => {
    try {
      const filters: {
        period?: string
        type?: 'FOOD' | 'DRINK'
        employeeId?: string
        variantId?: string
      } = {}
      if (period !== 'current') filters.period = period
      else filters.period = currentPeriod || undefined
      if (type !== 'all') filters.type = type
      if (employeeId !== 'all') filters.employeeId = employeeId
      if (variantId !== 'all') filters.variantId = variantId
      const res = await api.exportReports(filters)
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `laporan-${period === 'current' ? currentPeriod : period}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Laporan diunduh')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunduh')
    }
  }

  const periodList = useMemo(() => {
    const set = new Set<string>()
    if (currentPeriod) set.add(currentPeriod)
    // last 12 months
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return Array.from(set).sort().reverse()
  }, [currentPeriod])

  if (!admin) {
    return (
      <AdminLayout title="Laporan">
        <div className="text-center py-12">Mengarahkan ke login...</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Laporan" activeTab="reports">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Laporan Pengambilan</h1>
            <p className="text-sm text-muted-foreground">Filter &amp; analisis data pengambilan</p>
          </div>
          <Button onClick={handleExport} size="sm" className="brand-gradient text-white" disabled={loading || !report}>
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Periode</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Periode Aktif ({currentPeriod ? formatPeriod(currentPeriod) : '...'})</SelectItem>
                    {periodList.map((p) => (
                      <SelectItem key={p} value={p}>{formatPeriod(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipe</label>
                <Select value={type} onValueChange={(v) => setType(v as 'all' | 'FOOD' | 'DRINK')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="FOOD">Makanan</SelectItem>
                    <SelectItem value="DRINK">Minuman</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Karyawan</label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Variant</label>
                <Select value={variantId} onValueChange={setVariantId}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : report ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <SummaryCard icon={<Package className="w-5 h-5" />} label="Total Pengambilan" value={report.summary.totalPickups} color="blue" />
            <SummaryCard icon={<Utensils className="w-5 h-5" />} label="Makanan" value={report.summary.foodPickups} color="amber" />
            <SummaryCard icon={<CupSoda className="w-5 h-5" />} label="Minuman" value={report.summary.drinkPickups} color="cyan" />
            <SummaryCard icon={<Users className="w-5 h-5" />} label="Karyawan Unik" value={report.summary.uniqueEmployees} color="emerald" />
          </div>
        ) : null}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : !report || report.rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                Tidak ada data untuk filter ini
              </div>
            ) : (
              <div className="overflow-x-auto scroll-area-custom">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="text-left p-3 font-medium">Tanggal</th>
                      <th className="text-left p-3 font-medium hidden sm:table-cell">Karyawan</th>
                      <th className="text-left p-3 font-medium">Variant</th>
                      <th className="text-center p-3 font-medium">Tipe</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Periode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((p) => (
                      <tr key={p.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 text-xs whitespace-nowrap">{formatTimestamp(p.timestamp)}</td>
                        <td className="p-3 hidden sm:table-cell">{p.employee?.name}</td>
                        <td className="p-3 font-medium">{p.variant?.name}</td>
                        <td className="p-3 text-center">
                          {p.type === 'FOOD' ? (
                            <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300 text-[10px]">Makanan</Badge>
                          ) : (
                            <Badge className="bg-slate-300 text-slate-700 dark:bg-slate-600/40 dark:text-slate-300 text-[10px]">Minuman</Badge>
                          )}
                        </td>
                        <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{formatPeriod(p.period)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'blue' | 'emerald' | 'amber' | 'cyan' }) {
  const colorMap = {
    blue: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    emerald: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    amber: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    cyan: 'bg-slate-300 text-slate-700 dark:bg-slate-600/40 dark:text-slate-300',
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
