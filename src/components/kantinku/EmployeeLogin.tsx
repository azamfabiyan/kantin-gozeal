'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter, useEmployee } from '@/stores/router'
import { api } from '@/lib/api'
import { DateOfBirthPicker } from './DateOfBirthPicker'
import { EmployeeLayout } from './EmployeeLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, User, Shield, Info, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export function EmployeeLogin() {
  const setRoute = useRouter((s) => s.setRoute)
  const setEmployee = useEmployee((s) => s.setEmployee)
  const [name, setName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Nama lengkap wajib diisi')
      return
    }
    if (!dateOfBirth) {
      toast.error('Tanggal lahir wajib diisi')
      return
    }
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

  return (
    <EmployeeLayout title="Login Karyawan">
      <div className="flex flex-col items-center justify-center min-h-[65vh] py-4">
        <div className="w-full max-w-sm space-y-4">
          {/* Logo + Title - compact */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700/40">
              <User className="w-7 h-7 text-slate-700 dark:text-slate-300" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold">Login Karyawan</h1>
            <p className="text-xs sm:text-sm text-muted-foreground px-2">
              Masuk dengan nama lengkap dan tanggal lahir
            </p>
          </div>

          {/* Login Card - compact */}
          <Card>
            <CardContent className="pt-4 p-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="emp-name" className="text-xs sm:text-sm font-medium">
                    Nama Lengkap <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="emp-name"
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
                <Button
                  type="submit"
                  className="w-full h-11 brand-gradient text-white"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {loading ? 'Memproses...' : 'Masuk'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Info box - login pertama */}
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/50 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Informasi Login:</p>
              <ul className="space-y-0.5">
                <li className="flex items-start gap-1">
                  <span className="text-muted-foreground">1.</span>
                  <span>Login pertama: tanggal lahir Anda akan disimpan otomatis</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-muted-foreground">2.</span>
                  <span>Login berikutnya: gunakan tanggal lahir yang sama</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-muted-foreground">3.</span>
                  <span>Jika lupa tanggal lahir, hubungi admin</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Admin link - compact */}
          <div className="text-center">
            <button
              onClick={() => setRoute('admin/login')}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted/50"
            >
              <Shield className="w-3.5 h-3.5" />
              Login Admin
            </button>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  )
}
