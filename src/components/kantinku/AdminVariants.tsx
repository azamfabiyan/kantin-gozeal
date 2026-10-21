'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useAdmin } from '@/stores/router'
import { api } from '@/lib/api'
import { AdminLayout } from './AdminLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { Utensils, CupSoda, Plus, Pencil, Trash2, Package, History as HistoryIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useWebSocket } from '@/hooks/use-websocket'
import { formatTimestamp } from '@/lib/auth-client'
import type { StockHistoryInfo, VariantInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

interface VariantRow extends VariantInfo {
  takenCount?: number
}

export function AdminVariants() {
  const setRoute = useRouter((s) => s.setRoute)
  const admin = useAdmin((s) => s.admin)
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [loading, setLoading] = useState(true)

  const [editTarget, setEditTarget] = useState<VariantRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VariantRow | null>(null)
  const [stockTarget, setStockTarget] = useState<VariantRow | null>(null)
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<VariantRow | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [form, setForm] = useState<{ name: string; type: 'FOOD' | 'DRINK'; stock: number; active: boolean }>({ name: '', type: 'FOOD', stock: 0, active: true })
  const [stockAmount, setStockAmount] = useState<string>('')
  const [stockNote, setStockNote] = useState('')
  const [stockHistory, setStockHistory] = useState<StockHistoryInfo[]>([])
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!admin) {
      setRoute('admin/login')
      return
    }
    setLoading(true)
    try {
      const res = await api.listVariants()
      setVariants(res.variants.map((v) => ({ ...v, createdAt: v.createdAt, takenCount: (v as VariantRow).takenCount ?? 0 })))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat variant')
    } finally {
      setLoading(false)
    }
  }, [admin, setRoute])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useWebSocket({
    'variant:updated': () => fetchData(),
    'pickup:created': () => fetchData(),
    'period:reset': () => fetchData(),
  })

  const openAdd = (type: 'FOOD' | 'DRINK') => {
    setEditTarget(null)
    setForm({ name: '', type, stock: 0, active: true })
    setDialogOpen(true)
  }
  const openEdit = (v: VariantRow) => {
    setEditTarget(v)
    setForm({ name: v.name, type: v.type, stock: v.stock, active: v.active })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nama variant wajib diisi')
      return
    }
    setSaving(true)
    try {
      if (editTarget) {
        await api.updateVariant(editTarget.id, { name: form.name, type: form.type, stock: form.stock, active: form.active })
        toast.success('Variant diperbarui')
      } else {
        await api.createVariant(form)
        toast.success('Variant ditambahkan')
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
      await api.deleteVariant(deleteTarget.id)
      toast.success('Variant dihapus')
      setDeleteTarget(null)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus')
    } finally {
      setSaving(false)
    }
  }

  const openStock = (v: VariantRow) => {
    setStockTarget(v)
    setStockAmount('')
    setStockNote('')
    setStockDialogOpen(true)
  }

  const handleStockSave = async () => {
    if (!stockTarget) return
    const amt = Number(stockAmount)
    if (!Number.isInteger(amt) || amt === 0) {
      toast.error('Jumlah harus integer non-zero (positif untuk tambah, negatif untuk kurangi)')
      return
    }
    setSaving(true)
    try {
      await api.addStock(stockTarget.id, amt, stockNote)
      toast.success('Stok diperbarui')
      setStockDialogOpen(false)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah stok')
    } finally {
      setSaving(false)
    }
  }

  const openHistory = async (v: VariantRow) => {
    setHistoryTarget(v)
    setHistoryDialogOpen(true)
    try {
      const res = await api.variantHistory(v.id)
      setStockHistory(res.history)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat riwayat')
    }
  }

  if (!admin) {
    return (
      <AdminLayout title="Variant">
        <div className="text-center py-12">Mengarahkan ke login...</div>
      </AdminLayout>
    )
  }

  const foods = variants.filter((v) => v.type === 'FOOD')
  const drinks = variants.filter((v) => v.type === 'DRINK')

  return (
    <AdminLayout title="Manajemen Variant" activeTab="variants">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Manajemen Variant</h1>
          <p className="text-sm text-muted-foreground">Kelola stok makanan &amp; minuman</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
          <VariantColumn
            title="Makanan"
            icon={<Utensils className="w-5 h-5 text-amber-600" />}
            accent="amber"
            variants={foods}
            loading={loading}
            onAdd={() => openAdd('FOOD')}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onStock={openStock}
            onHistory={openHistory}
          />
          <VariantColumn
            title="Minuman"
            icon={<CupSoda className="w-5 h-5 text-cyan-600" />}
            accent="cyan"
            variants={drinks}
            loading={loading}
            onAdd={() => openAdd('DRINK')}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onStock={openStock}
            onHistory={openHistory}
          />
        </div>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Variant' : 'Tambah Variant'}</DialogTitle>
            <DialogDescription>
              {editTarget ? 'Perbarui data variant' : 'Isi data variant baru'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Variant <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama variant"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as 'FOOD' | 'DRINK' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FOOD">Makanan</SelectItem>
                  <SelectItem value="DRINK">Minuman</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editTarget && (
              <div className="space-y-2">
                <Label>Stok Awal</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            )}
            {editTarget && (
              <div className="space-y-2">
                <Label>Stok (ubah untuk set ulang stok)</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })}
                  min={0}
                />
                <p className="text-xs text-muted-foreground">Untuk tambah/kurangi stok dengan catatan, gunakan tombol "Stok" pada card.</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <Label>Status Aktif</Label>
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

      {/* Add stock dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Stok: {stockTarget?.name}</DialogTitle>
            <DialogDescription>
              Masukkan jumlah perubahan stok. Positif untuk menambah, negatif untuk mengurangi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Jumlah Perubahan</Label>
              <Input
                type="number"
                value={stockAmount}
                onChange={(e) => setStockAmount(e.target.value)}
                placeholder="Contoh: 10 atau -5"
              />
              {stockTarget && stockAmount && !Number.isNaN(Number(stockAmount)) && (
                <p className="text-xs text-muted-foreground">
                  Preview: {stockTarget.stock} → <strong className="text-foreground">{Math.max(0, stockTarget.stock + Number(stockAmount))}</strong>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Input
                value={stockNote}
                onChange={(e) => setStockNote(e.target.value)}
                placeholder="Catatan perubahan"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialogOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleStockSave} disabled={saving} className="brand-gradient text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="w-4 h-4" />
              Riwayat Stok: {historyTarget?.name}
            </DialogTitle>
            <DialogDescription>Semua perubahan stok variant ini</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto scroll-area-custom">
            {stockHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Belum ada riwayat</p>
            ) : (
              <ul className="space-y-2">
                {stockHistory.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-2 p-2 border rounded-md text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn(
                          'text-[10px]',
                          h.changeType === 'ADD' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                          h.changeType === 'REDUCE' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                          h.changeType === 'SET' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                          h.changeType === 'PICKUP_DECREMENT' && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                        )}>
                          {h.changeType}
                        </Badge>
                        <span className="font-medium">{h.oldStock} → {h.newStock}</span>
                        <span className={cn('text-xs', h.amount > 0 ? 'text-emerald-600' : 'text-red-600')}>
                          ({h.amount > 0 ? '+' : ''}{h.amount})
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {h.note || '-'} · oleh {h.changedBy} · {formatTimestamp(h.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Variant</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Semua riwayat stok &amp; pengambilan variant ini akan ikut terhapus.
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

function VariantColumn({
  title, icon, accent, variants, loading, onAdd, onEdit, onDelete, onStock, onHistory,
}: {
  title: string
  icon: React.ReactNode
  accent: 'amber' | 'cyan'
  variants: VariantRow[]
  loading: boolean
  onAdd: () => void
  onEdit: (v: VariantRow) => void
  onDelete: (v: VariantRow) => void
  onStock: (v: VariantRow) => void
  onHistory: (v: VariantRow) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          {icon}
          {title} ({variants.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1" /> Tambah
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Memuat...</div>
        ) : variants.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            <Package className="w-8 h-8 mx-auto mb-1 opacity-40" />
            Belum ada variant
          </div>
        ) : (
          variants.map((v) => {
            const pct = v.initialStock > 0 ? (v.stock / v.initialStock) * 100 : 0
            const isLow = v.stock <= 5 && v.stock > 0
            const isOut = v.stock <= 0
            return (
              <div key={v.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{v.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Stok: {v.stock}/{v.initialStock} · Diambil {v.takenCount || 0}x
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {isOut && <Badge variant="destructive" className="text-[10px]">Habis</Badge>}
                    {isLow && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px]">Menipis</Badge>}
                    {!v.active && <Badge variant="secondary" className="text-[10px]">Nonaktif</Badge>}
                  </div>
                </div>
                <div className={cn('h-1.5 rounded-full bg-muted overflow-hidden')}>
                  <div
                    className={cn('h-full', accent === 'amber' ? 'bg-amber-500' : 'bg-cyan-500')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onStock(v)}>
                    <Package className="w-3.5 h-3.5 mr-1" />
                    Stok
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onHistory(v)}>
                    <HistoryIcon className="w-3.5 h-3.5 mr-1" />
                    Riwayat
                  </Button>
                  <Button variant="ghost" size="sm" className="icon-btn h-8" onClick={() => onEdit(v)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="icon-btn h-8 text-destructive" onClick={() => onDelete(v)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
