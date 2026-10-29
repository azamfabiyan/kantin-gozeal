'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useRouter } from '@/stores/router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Search, Users, Loader2, User,
  CheckCircle2, Calendar
} from 'lucide-react'
import { toast } from 'sonner'

interface EmployeeListItem {
  id: string
  code: string
  name: string
  department: string | null
  pickupCount: number
  hasPickedUp: boolean
}

export default function PickerPage() {
  const { setRoute } = useRouter()
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listPublicEmployees()
      setEmployees(res.employees)
      setPeriod(res.period)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat daftar karyawan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = employees.filter(e => {
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  const handleSelectEmployee = (emp: EmployeeListItem) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('kantinku_selected_employee_id', emp.id)
      sessionStorage.setItem('kantinku_selected_employee_name', emp.name)
      sessionStorage.setItem('kantinku_selected_employee_code', emp.code)
    }
    setRoute('karyawan/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <header className="brand-gradient text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRoute('scan')}
              className="bg-white/15 hover:bg-white/25 text-white border-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Kembali
            </Button>
            <div>
              <h1 className="text-lg font-bold leading-tight">Pilih Karyawan</h1>
              <p className="text-[10px] text-blue-100 leading-tight flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" /> Periode: {period}
              </p>
            </div>
          </div>
          <Badge className="bg-white/20 text-white border-0">
            <Users className="w-3 h-3 mr-1" /> {employees.length} karyawan
          </Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama karyawan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{search ? 'Tidak ada karyawan yang cocok' : 'Belum ada karyawan'}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(emp => (
              <button
                key={emp.id}
                onClick={() => handleSelectEmployee(emp)}
                className="text-left p-4 bg-white border-2 border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  {emp.hasPickedUp ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" /> {emp.pickupCount} diambil
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Belum ambil</Badge>
                  )}
                </div>
                <p className="font-semibold text-slate-900 group-hover:text-blue-700">{emp.name}</p>
              </button>
            ))}
          </div>
        )}

        <Card className="mt-6 bg-blue-50/50 border-blue-100">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-start gap-2">
              <User className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <span>
                Pilih nama Anda dari daftar di atas untuk melihat sisa jatah makanan & minuman periode ini.
                Setiap variant hanya bisa diambil 1x per periode.
              </span>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
