'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter, useEmployee } from '@/stores/router'
import { api } from '@/lib/api'
import { DateOfBirthPicker } from './DateOfBirthPicker'
import { EmployeeLayout } from './EmployeeLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, User, Shield } from 'lucide-react'
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
      toast.success(`Selamat datang, ${res.employee.name}!`)
      setRoute('karyawan/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <EmployeeLayout title="Login Karyawan">
      <div className="flex flex-col items-center justify-center min-h-[70vh] py-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700/40">
              <User className="w-8 h-8 text-slate-700 dark:text-slate-300" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">Login Karyawan</h1>
            <p className="text-sm text-muted-foreground">
              Masuk dengan nama lengkap dan tanggal lahir untuk mengambil jatah makanan &amp; minuman
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Masuk ke Akun</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="emp-name" className="text-sm font-medium">
                    Nama Lengkap <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="emp-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: BAYU"
                    autoComplete="off"
                    disabled={loading}
                  />
                </div>
                <DateOfBirthPicker
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  required
                  description="Pilih tanggal, bulan, dan tahun lahir Anda"
                />
                <Button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-900"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {loading ? 'Memproses...' : 'Masuk'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center">
            <button
              onClick={() => setRoute('admin/login')}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </button>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  )
}
