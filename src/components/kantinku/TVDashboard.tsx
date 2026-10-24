'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Utensils, CupSoda, Package, Activity, Clock } from 'lucide-react'

interface TVData {
  period: string
  stats: {
    totalEmployees: number
    pickupsThisPeriod: number
    todayPickups: number
  }
  foodStock: Array<{ id: string; name: string; stock: number; initialStock: number; active: boolean }>
  drinkStock: Array<{ id: string; name: string; stock: number; initialStock: number; active: boolean }>
  recentPickups: Array<{
    id: string
    type: string
    timestamp: string
    employee: { name: string; code: string }
    variant: { name: string; type: string } | null
  }>
}

export default function TVDashboard() {
  const [data, setData] = useState<TVData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/tv-dashboard')
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => {
      clearInterval(interval)
      clearInterval(clockInterval)
    }
  }, [fetchData])

  const formatTime = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const formatDate = (d: Date) => d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const formatPickupTime = (ts: string) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-slate-300 border-t-slate-800 rounded-full mx-auto mb-4" />
          <p className="text-slate-500 text-xl">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900 p-4 sm:p-6 lg:p-8 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-200">
            <Image src="/gozeal-logo.png" alt="Kantin Gozeal" width={80} height={56} priority />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">KANTIN GOZEAL</h1>
            <p className="text-slate-500 text-sm sm:text-base">Dashboard Pantry — Periode {data.period}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold font-mono">{formatTime(currentTime)}</p>
          <p className="text-slate-500 text-sm sm:text-base">{formatDate(currentTime)}</p>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
            <span className="text-slate-500 text-xs sm:text-sm">Total Karyawan</span>
          </div>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">{data.stats.totalEmployees}</p>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
            <span className="text-slate-500 text-xs sm:text-sm">Pengambilan Periode Ini</span>
          </div>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">{data.stats.pickupsThisPeriod}</p>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
            <span className="text-slate-500 text-xs sm:text-sm">Pengambilan Hari Ini</span>
          </div>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">{data.stats.todayPickups}</p>
        </div>
      </div>

      {/* Main Content: Stock + Activity */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Food Stock */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Utensils className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
            <h2 className="text-lg sm:text-xl font-bold">MAKANAN</h2>
          </div>
          <div className="space-y-3">
            {data.foodStock.map(v => {
              const pct = v.initialStock > 0 ? (v.stock / v.initialStock) * 100 : 0
              const low = v.stock <= 5
              const empty = v.stock === 0
              return (
                <div key={v.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm sm:text-base font-medium">{v.name}</span>
                    <span className={`text-sm sm:text-base font-bold ${empty ? 'text-red-600' : low ? 'text-amber-600' : 'text-slate-800'}`}>
                      {v.stock}
                      {empty && ' HABIS'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${empty ? 'bg-red-400' : low ? 'bg-amber-400' : 'bg-slate-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Drink Stock */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CupSoda className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
            <h2 className="text-lg sm:text-xl font-bold">MINUMAN</h2>
          </div>
          <div className="space-y-3">
            {data.drinkStock.map(v => {
              const pct = v.initialStock > 0 ? (v.stock / v.initialStock) * 100 : 0
              const low = v.stock <= 5
              const empty = v.stock === 0
              return (
                <div key={v.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm sm:text-base font-medium">{v.name}</span>
                    <span className={`text-sm sm:text-base font-bold ${empty ? 'text-red-600' : low ? 'text-amber-600' : 'text-slate-800'}`}>
                      {v.stock}
                      {empty && ' HABIS'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${empty ? 'bg-red-400' : low ? 'bg-amber-400' : 'bg-slate-300'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
            <h2 className="text-lg sm:text-xl font-bold">AKTIVITAS TERKINI</h2>
          </div>
          <div className="space-y-2 max-h-96 overflow-hidden">
            {data.recentPickups.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Belum ada pengambilan</p>
            ) : (
              data.recentPickups.slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${p.type === 'FOOD' ? 'bg-slate-100' : 'bg-slate-200'}`}>
                      {p.type === 'FOOD' ? <Utensils className="w-4 h-4 text-slate-600" /> : <CupSoda className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.employee.name}</p>
                      <p className="text-xs text-slate-400 truncate">{p.variant?.name || '-'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{formatPickupTime(p.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-4 text-center text-xs text-slate-400">
        Auto-refresh setiap 10 detik · Kantin Gozeal · {formatDate(currentTime)}
      </footer>
    </div>
  )
}
