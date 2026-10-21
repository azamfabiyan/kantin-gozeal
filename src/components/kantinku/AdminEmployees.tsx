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
import { Search, Plus, Pencil, Trash2, Utensils, CupSoda, Info, Users, Loader2 } from 'lucide-react'
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
    <AdminLayout title="Manajemen Karyawan" activeTab="employees">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Manajemen Karyawan</h1>
            <p className="text-sm text-muted-foreground">Periode aktif: {formatPeriod(activePeriod)}</p>
          </div>
          <Button onClick={openAdd} size="sm" className="brand-gradient text-white">
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Karyawan
          </Button>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 text-xs sm:text-sm">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Setiap karyawan bisa ambil 1x per variant per periode. Dengan 6 makanan + 4 minuman, maksimal 10 pengambilan per periode.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama karyawan..."
            className="pl-9"
          />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                {search ? 'Tidak ada karyawan yang cocok' : 'Belum ada karyawan'}
              </div>
            ) : (
              <div className="overflow-x-auto scroll-area-custom">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="text-left p-3 font-medium">Nama</th>
                      <th className="text-center p-3 font-medium hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1"><Utensils className="w-3 h-3" /> Makan</span>
                      </th>
                      <th className="text-center p-3 font-medium hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1"><CupSoda className="w-3 h-3" /> Minum</span>
                      </th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Tanggal Lahir</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr key={e.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-medium">{e.name}</td>
                        <td className="p-3 text-center hidden sm:table-cell">
                          <Badge variant="outline">{e.foodPickups}/6</Badge>
                        </td>
                        <td className="p-3 text-center hidden sm:table-cell">
                          <Badge variant="outline">{e.drinkPickups}/4</Badge>
                        </td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground">
                          {e.dateOfBirth ? formatDateOfBirth(e.dateOfBirth) : '-'}
                        </td>
                        <td className="p-3 text-center">
                          {e.active ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Aktif</Badge>
                          ) : (
                            <Badge variant="secondary">Nonaktif</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="icon-btn" onClick={() => openEdit(e)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="icon-btn text-destructive hover:text-destructive" onClick={() => setDeleteTarget(e)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Karyawan' : 'Tambah Karyawan'}</DialogTitle>
            <DialogDescription>
              {editTarget ? 'Perbarui data karyawan' : 'Isi data karyawan baru. Kode akan dibuat otomatis.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Lengkap <span className="text-destructive">*</span></label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama lengkap"
              />
            </div>
            <DateOfBirthPicker
              value={form.dateOfBirth}
              onChange={(v) => setForm({ ...form, dateOfBirth: v })}
              description="Kosongkan jika karyawan akan mengisi sendiri saat login pertama"
            />
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">Status Aktif</label>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Karyawan</AlertDialogTitle>
            <AlertDialogDescription>
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
