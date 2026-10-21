'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter, useAdmin } from '@/stores/router'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Lock, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export function AdminLogin() {
  const setRoute = useRouter((s) => s.setRoute)
  const setAdmin = useAdmin((s) => s.setAdmin)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error('Username dan password wajib diisi')
      return
    }
    setLoading(true)
    try {
      const res = await api.adminLogin(username.trim(), password)
      setAdmin(res.admin, res.token)
      toast.success(`Selamat datang, ${res.admin.name}!`)
      setRoute('admin/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
      <header className="brand-gradient text-white shadow-md safe-area-top">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
          <div className="bg-white rounded-md p-1 flex items-center">
            <Image src="/gozeal-logo.png" alt="Kantin Gozeal" width={80} height={18} priority />
          </div>
          <span className="text-sm sm:text-base font-semibold">Login Admin</span>
        </div>
      </header>
      <main className="flex-1 w-full max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-10">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40">
              <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">Login Administrator</h1>
            <p className="text-sm text-muted-foreground">
              Masuk ke panel admin Kantin Gozeal
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Masuk ke Akun Admin</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="admin-user" className="text-sm font-medium">
                    Username <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="admin-user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username admin"
                    autoComplete="off"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-pass" className="text-sm font-medium">
                    Password <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="admin-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password admin"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full brand-gradient text-white" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {loading ? 'Memproses...' : 'Masuk'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center">
            <button
              onClick={() => setRoute('karyawan/login')}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Login Karyawan
            </button>
          </div>
        </div>
      </main>
      <footer className="app-footer text-center text-xs text-muted-foreground py-3 px-3 safe-area-bottom">
        © {new Date().getFullYear()} Kantin Gozeal · Sistem Manajemen Jatah Makanan &amp; Minuman Karyawan
      </footer>
    </div>
  )
}
