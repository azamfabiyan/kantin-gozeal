'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter, useEmployee } from '@/stores/router'
import { api } from '@/lib/api'
import { EmployeeLayout } from './EmployeeLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, LogOut, History, Utensils, CupSoda, CheckCircle2, PackageX, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useWebSocket } from '@/hooks/use-websocket'
import type { PickupInfo, VariantWithStatus } from '@/lib/types'
import { formatPeriod, formatTimestamp } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

interface ScanData {
  employee: { id: string; code: string; name: string; dateOfBirth: string | null }
  activePeriod: string
  foodVariants: VariantWithStatus[]
  drinkVariants: VariantWithStatus[]
  history: PickupInfo[]
  foodTaken: number
  drinkTaken: number
}

export function EmployeeDashboard() {
  const setRoute = useRouter((s) => s.setRoute)
  const employee = useEmployee((s) => s.employee)
  const logoutEmployee = useEmployee((s) => s.logout)
  const [data, setData] = useState<ScanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pickupTarget, setPickupTarget] = useState<VariantWithStatus | null>(null)
  const [pickupLoading, setPickupLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!employee) {
      setRoute('karyawan/login')
      return
    }
    setLoading(true)
    try {
      const res = await api.getScan(employee.id)
      setData(res)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [employee, setRoute])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useWebSocket({
    'pickup:created': () => fetchData(),
    'variant:updated': () => fetchData(),
    'period:reset': () => {
      toast.info('Periode telah direset')
      fetchData()
    },
  })

  const handleConfirmPickup = async () => {
    if (!pickupTarget || !employee) return
    setPickupLoading(true)
    try {
      await api.createPickup(employee.id, pickupTarget.id)
      toast.success(`Berhasil mengambil ${pickupTarget.name}`)
      setPickupTarget(null)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengambil')
    } finally {
      setPickupLoading(false)
    }
  }

  const handleSwitchEmployee = () => {
    logoutEmployee()
    setRoute('karyawan/login')
  }

  if (!employee) {
    return (
      <EmployeeLayout>
        <div className="text-center py-12">Mengarahkan ke login...</div>
      </EmployeeLayout>
    )
  }

  return (
    <EmployeeLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Halo, {employee.name}!</h1>
            <p className="text-sm text-muted-foreground">
              Periode aktif: <span className="font-medium">{data ? formatPeriod(data.activePeriod) : '...'}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRoute('karyawan/history')}>
              <History className="w-4 h-4 mr-1.5" />
              Riwayat
            </Button>
            <Button variant="outline" size="sm" onClick={handleSwitchEmployee}>
              <LogOut className="w-4 h-4 mr-1.5" />
              Ganti
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        {loading && !data ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Utensils className="w-5 h-5 text-amber-600" />
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">Makanan</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold">
                  {data.foodTaken}<span className="text-base text-muted-foreground">/6</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">diambil periode ini</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CupSoda className="w-5 h-5 text-cyan-600" />
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">Minuman</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold">
                  {data.drinkTaken}<span className="text-base text-muted-foreground">/4</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">diambil periode ini</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Food section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg sm:text-xl font-semibold">Pilih Makanan</h2>
          </div>
          {loading && !data ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              {data.foodVariants.map((v) => (
                <VariantCard key={v.id} variant={v} onPickup={setPickupTarget} period={data.activePeriod} />
              ))}
            </div>
          ) : null}
        </section>

        {/* Drink section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CupSoda className="w-5 h-5 text-cyan-600" />
            <h2 className="text-lg sm:text-xl font-semibold">Pilih Minuman</h2>
          </div>
          {loading && !data ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              {data.drinkVariants.map((v) => (
                <VariantCard key={v.id} variant={v} onPickup={setPickupTarget} period={data.activePeriod} />
              ))}
            </div>
          ) : null}
        </section>

        {/* History section */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-semibold">Pengambilan Periode Ini</h2>
          <Card>
            <CardContent className="p-3 sm:p-4">
              {!data || data.history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Belum ada pengambilan periode ini
                </p>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-y-auto scroll-area-custom">
                  {data.history.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {p.type === 'FOOD' ? (
                          <Utensils className="w-4 h-4 text-amber-600 shrink-0" />
                        ) : (
                          <CupSoda className="w-4 h-4 text-cyan-600 shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">{p.variant?.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTimestamp(p.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Pickup confirmation */}
      <AlertDialog open={!!pickupTarget} onOpenChange={(open) => !open && setPickupTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pengambilan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin mengambil: <strong className="text-foreground">{pickupTarget?.name}</strong>?
              <br /><br />
              <span className="text-amber-600 dark:text-amber-500">
                ⚠️ Setelah diambil, Anda tidak bisa mengganti atau membatalkan pilihan ini di periode {pickupTarget && formatPeriod(data?.activePeriod || '')}.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pickupLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPickup}
              disabled={pickupLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {pickupLoading ? 'Memproses...' : 'Ya, Ambil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EmployeeLayout>
  )
}

function VariantCard({
  variant,
  onPickup,
  period,
}: {
  variant: VariantWithStatus
  onPickup: (v: VariantWithStatus) => void
  period: string
}) {
  const isFood = variant.type === 'FOOD'
  return (
    <Card className={cn('flex flex-col', variant.status === 'taken' && 'opacity-70')}>
      <CardContent className="p-3 sm:p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm sm:text-base line-clamp-2">{variant.name}</span>
        </div>
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-muted-foreground">
            Stok: <span className={cn('font-medium', variant.stock <= 5 ? 'text-amber-600' : 'text-foreground')}>
              {variant.stock}
            </span>
          </span>
          {variant.status === 'taken' ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Sudah Diambil
            </Badge>
          ) : variant.status === 'out_of_stock' ? (
            <Badge variant="destructive">
              <PackageX className="w-3 h-3 mr-1" />
              Habis
            </Badge>
          ) : (
            <Badge variant="secondary">Tersedia</Badge>
          )}
        </div>
        <Button
          size="sm"
          className={cn(
            'mt-auto w-full',
            isFood ? 'bg-amber-600 hover:bg-amber-700' : 'bg-cyan-600 hover:bg-cyan-700',
          )}
          disabled={variant.status !== 'available'}
          onClick={() => onPickup(variant)}
        >
          {variant.status === 'taken' ? (
            <>
              <Lock className="w-3.5 h-3.5 mr-1" /> Terkunci
            </>
          ) : variant.status === 'out_of_stock' ? (
            'Habis'
          ) : (
            'Ambil'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
