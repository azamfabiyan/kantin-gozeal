'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useAdmin } from '@/stores/router'
import { api } from '@/lib/api'
import { AdminLayout } from './AdminLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { DateOfBirthPicker } from './DateOfBirthPicker'
import {
  Search, Plus, Pencil, Trash2, Utensils, CupSoda, Info, Users, Loader2,
  Calendar, UserCheck, UserX, Cake, X, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { useWebSocket } from '@/hooks/use-websocket'
import { formatDateOfBirth, formatPeriod } from '@/lib/auth-client'
import type { EmployeeWithPickups } from '@/lib/types'

export function AdminEmployees() {
  const setRoute = useRouter((s) => s.setRoute)
  const admin = useAdmin((s) => s.admin)
  const [employees, setEmployees] = useState<EmployeeWithPickups[]>([])
  const [activePeriod, setActivePeriod] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<EmployeeWithPickups | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EmployeeWithPickups | null>(null)
  const [quickDobTarget, setQuickDobTarget] = useState<EmployeeWithPickups | null>(null)
  const [quickDobValue, setQuickDobValue] = useState('')
  const [quickDobSaving, setQuickDobSaving] = useState(false)
  const [form, setForm] = useState<{ name: string; dateOfBirth: string; active: boolean }>({ name: '', dateOfBirth: '', active: true })
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!admin) {
      setRoute('admin/login')
      return
    }
    setLoading(true)
    try {
      const res = await api.listEmployees()
      setEmployees(res.employees)
      setActivePeriod(res.activePeriod)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat data karyawan')
    } finally {
      setLoading(false)
    }
  }, [admin, setRoute])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useWebSocket({
    'employee:changed': () => fetchData(),
    'pickup:created': () => fetchData(),
    'period:reset': () => fetchData(),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) => e.name.toLowerCase().includes(q))
  }, [employees, search])

  // Quick stats
  const stats = useMemo(() => {
    const total = employees.length
    const active = employees.filter(e => e.active).length
    const withDob = employees.filter(e => e.dateOfBirth).length
    const withoutDob = total - withDob
    return { total, active, inactive: total - active, withDob, withoutDob }
  }, [employees])

  const openAdd = () => {
    setEditTarget(null)
    setForm({ name: '', dateOfBirth: '', active: true })
    setDialogOpen(true)
  }

  const openEdit = (emp: EmployeeWithPickups) => {
    setEditTarget(emp)
    setForm({ name: emp.name, dateOfBirth: emp.dateOfBirth || '', active: emp.active })
    setDialogOpen(true)
  }

  const openQuickDob = (emp: EmployeeWithPickups) => {
    setQuickDobTarget(emp)
    setQuickDobValue(emp.dateOfBirth || '')
  }

  const handleQuickDobSave = async () => {
    if (!quickDobTarget) return
    if (!quickDobValue) {
      toast.error('Tanggal lahir wajib diisi')
      return
    }
    setQuickDobSaving(true)
    try {
      await api.updateEmployee(quickDobTarget.id, {
        name: quickDobTarget.name,
        dateOfBirth: quickDobValue,
        active: quickDobTarget.active,
      })
      toast.success(`Tanggal lahir ${quickDobTarget.name} diperbarui`)
      setQuickDobTarget(null)
      setQuickDobValue('')
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setQuickDobSaving(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error('Nama minimal 2 karakter')
      return
    }
    setSaving(true)
    try {
      if (editTarget) {
        await api.updateEmployee(editTarget.id, form)
        toast.success('Karyawan diperbarui')
      } else {
        await api.createEmployee(form)
        toast.success('Karyawan ditambahkan')
      }
      setDialogOpen(false)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await api.deleteEmployee(deleteTarget.id)
      toast.success('Karyawan dihapus')
      setDeleteTarget(null)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus')
    } finally {
      setSaving(false)
    }
  }

  if (!admin) {
    return (
      <AdminLayout title="Karyawan">
        <div className="text-center py-12">Mengarahkan ke login...</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Karyawan" activeTab="employees">
      <div className="space-y-4">
        {/* Header - compact */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">Karyawan</h1>
            <p className="text-xs text-muted-foreground">Periode: {formatPeriod(activePeriod)}</p>
          </div>
          <Button onClick={openAdd} size="sm" className="brand-gradient text-white shrink-0">
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Tambah</span>
            <span className="sm:hidden">Tambah</span>
          </Button>
        </div>

        {/* Stats - compact grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-card border rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total</span>
            </div>
            <p className="text-lg sm:text-xl font-bold mt-0.5">{stats.total}</p>
          </div>
          <div className="bg-card border rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Aktif</span>
            </div>
            <p className="text-lg sm:text-xl font-bold mt-0.5">{stats.active}</p>
          </div>
          <div className="bg-card border rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1.5">
              <Cake className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Punya DOB</span>
            </div>
            <p className="text-lg sm:text-xl font-bold mt-0.5">{stats.withDob}</p>
          </div>
          <div className="bg-card border rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Belum DOB</span>
            </div>
            <p className="text-lg sm:text-xl font-bold mt-0.5 text-amber-600 dark:text-amber-400">{stats.withoutDob}</p>
          </div>
        </div>

        {/* Search - compact */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama karyawan..."
            className="pl-9 h-10"
          />
        </div>

        {/* Employee List - compact cards */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              {search ? 'Tidak ada karyawan yang cocok' : 'Belum ada karyawan'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <div
                key={e.id}
                className="bg-card border rounded-lg p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Left: Name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm sm:text-base truncate">{e.name}</p>
                      {e.active ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                          <Check className="w-2.5 h-2.5 mr-0.5" /> Aktif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                          <UserX className="w-2.5 h-2.5 mr-0.5" /> Nonaktif
                        </Badge>
                      )}
                      {!e.dateOfBirth && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-amber-300 text-amber-700 dark:text-amber-400">
                          <Calendar className="w-2.5 h-2.5 mr-0.5" /> Belum DOB
                        </Badge>
                      )}
                    </div>
                    {/* Info row - compact */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Utensils className="w-3 h-3" />
                        {e.foodPickups}/6
                      </span>
                      <span className="flex items-center gap-1">
                        <CupSoda className="w-3 h-3" />
                        {e.drinkPickups}/4
                      </span>
                      <span className="flex items-center gap-1">
                        <Cake className="w-3 h-3" />
                        {e.dateOfBirth ? formatDateOfBirth(e.dateOfBirth) : '—'}
                      </span>
                    </div>
                  </div>
                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Quick Edit DOB - prominent button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="icon-btn h-8 px-2 text-xs"
                      onClick={() => openQuickDob(e)}
                      title="Edit Tanggal Lahir"
                    >
                      <Cake className="w-3.5 h-3.5 mr-1" />
                      <span className="hidden sm:inline">DOB</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="icon-btn h-8 w-8 p-0"
                      onClick={() => openEdit(e)}
                      title="Edit Karyawan"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="icon-btn h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(e)}
                      title="Hapus Karyawan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info note - compact */}
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/50 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>
            Klik tombol <strong>DOB</strong> untuk edit tanggal lahir karyawan. Karyawan yang belum punya DOB akan disuruh isi sendiri saat login pertama.
          </p>
        </div>
      </div>

      {/* Quick Edit DOB Dialog */}
      <Dialog open={!!quickDobTarget} onOpenChange={(open) => {
        if (!open) {
          setQuickDobTarget(null)
          setQuickDobValue('')
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Cake className="w-4 h-4" /> Edit Tanggal Lahir
            </DialogTitle>
            <DialogDescription>
              Karyawan: <strong>{quickDobTarget?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <DateOfBirthPicker
              value={quickDobValue}
              onChange={setQuickDobValue}
              label="Tanggal Lahir"
              required
              description={quickDobTarget?.dateOfBirth ? 'Ubah tanggal lahir karyawan' : 'Set tanggal lahir untuk karyawan ini'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setQuickDobTarget(null); setQuickDobValue('') }} disabled={quickDobSaving}>
              Batal
            </Button>
            <Button onClick={handleQuickDobSave} disabled={quickDobSaving || !quickDobValue} className="brand-gradient text-white">
              {quickDobSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
              Simpan DOB
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{editTarget ? 'Edit Karyawan' : 'Tambah Karyawan'}</DialogTitle>
            <DialogDescription className="text-xs">
              {editTarget ? 'Perbarui data karyawan' : 'Isi data karyawan baru. Kode akan dibuat otomatis.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nama Lengkap <span className="text-destructive">*</span></label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama lengkap"
                className="h-10"
              />
            </div>
            <DateOfBirthPicker
              value={form.dateOfBirth}
              onChange={(v) => setForm({ ...form, dateOfBirth: v })}
              description="Kosongkan jika karyawan akan mengisi sendiri saat login pertama"
            />
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-muted/50">
              <div>
                <label className="text-sm font-medium">Status Aktif</label>
                <p className="text-xs text-muted-foreground">Karyawan nonaktif tidak bisa login</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="brand-gradient text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Hapus Karyawan</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak bisa dibatalkan dan semua riwayat pengambilan akan ikut terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? 'Menghapus...' : 'Ya, Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
