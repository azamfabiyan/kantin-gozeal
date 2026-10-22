'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useEmployee } from '@/stores/router'
import { api } from '@/lib/api'
import { EmployeeLayout } from './EmployeeLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Download, Utensils, CupSoda, History as HistoryIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatPeriod, formatTimestamp } from '@/lib/auth-client'
import type { PickupInfo } from '@/lib/types'

export function EmployeeHistory() {
  const setRoute = useRouter((s) => s.setRoute)
  const employee = useEmployee((s) => s.employee)
  const [history, setHistory] = useState<PickupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')

  const fetchData = useCallback(async () => {
    if (!employee) {
      setRoute('karyawan/login')
      return
    }
    setLoading(true)
    try {
      const res = await api.employeeHistory(employee.id)
      setHistory(res.history)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat riwayat')
    } finally {
      setLoading(false)
    }
  }, [employee, setRoute])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const periods = useMemo(() => {
    const set = new Set(history.map((p) => p.period))
    return Array.from(set).sort().reverse()
  }, [history])

  const filtered = useMemo(() => {
    if (selectedPeriod === 'all') return history
    return history.filter((p) => p.period === selectedPeriod)
  }, [history, selectedPeriod])

  const grouped = useMemo(() => {
    const map = new Map<string, PickupInfo[]>()
    for (const p of filtered) {
      const arr = map.get(p.period) || []
      arr.push(p)
      map.set(p.period, arr)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const handleExport = () => {
    const header = ['Periode', 'Tanggal', 'Waktu', 'Tipe', 'Nama Variant']
    const rows = filtered.map((p) => {
      const d = new Date(p.timestamp)
      const pad = (n: number) => String(n).padStart(2, '0')
      return [
        p.period,
        `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
        `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        p.type === 'FOOD' ? 'Makanan' : 'Minuman',
        p.variant?.name || '',
      ].join(',')
    })
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `riwayat-${employee?.name || 'karyawan'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Riwayat diunduh')
  }

  if (!employee) {
    return (
      <EmployeeLayout>
        <div className="text-center py-12">Mengarahkan ke login...</div>
      </EmployeeLayout>
    )
  }

  return (
    <EmployeeLayout title="Riwayat Pengambilan">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRoute('karyawan/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Kembali
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">Riwayat Pengambilan</h1>
          </div>
          <div className="flex gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[140px] sm:w-[180px]">
                <SelectValue placeholder="Semua Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Periode</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p} value={p}>{formatPeriod(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="w-4 h-4 mr-1.5" />
              CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : grouped.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <HistoryIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Belum ada riwayat pengambilan
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {grouped.map(([period, items]) => (
              <div key={period} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-semibold">{formatPeriod(period)}</h2>
                  <Badge variant="secondary">{items.length} pengambilan</Badge>
                </div>
                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <ul className="space-y-2">
                      {items.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {p.type === 'FOOD' ? (
                              <Utensils className="w-4 h-4 text-slate-600 shrink-0" />
                            ) : (
                              <CupSoda className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate">{p.variant?.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatTimestamp(p.timestamp)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </EmployeeLayout>
  )
}
