'use client'

import Image from 'next/image'
import { useRouter } from '@/stores/router'
import { api } from '@/lib/api'
import type { ReactNode } from 'react'
import { Home, LogOut } from 'lucide-react'
import { toast } from 'sonner'

interface AdminLayoutProps {
  children: ReactNode
  title: string
  activeTab?: 'dashboard' | 'employees' | 'variants' | 'reports'
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', route: 'admin/dashboard' },
  { id: 'employees', label: 'Karyawan', route: 'admin/employees' },
  { id: 'variants', label: 'Variant', route: 'admin/variants' },
  { id: 'reports', label: 'Laporan', route: 'admin/reports' },
] as const

export function AdminLayout({ children, title, activeTab }: AdminLayoutProps) {
  const setRoute = useRouter((s) => s.setRoute)
  const year = new Date().getFullYear()

  const handleLogout = async () => {
    try {
      await api.logout()
      toast.success('Anda telah keluar dari admin')
    } catch {}
    setRoute('karyawan/login')
  }

  const goHome = () => {
    setRoute('karyawan/login')
  }

  return (
    <div className="app-shell min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="brand-gradient text-white shadow-md safe-area-top sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white rounded-md p-1 flex items-center">
                <Image src="/gozeal-logo.png" alt="Kantin Gozeal" width={56} height={40} priority />
              </div>
              <span className="text-sm sm:text-base font-semibold hidden sm:inline">{title}</span>
            </div>
            {/* Action buttons - Beranda & Keluar */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={goHome}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md bg-white/15 hover:bg-white/25 transition-colors"
                title="Kembali ke halaman utama"
                aria-label="Beranda"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Beranda</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md bg-white/15 hover:bg-white/25 transition-colors"
                title="Keluar dari admin"
                aria-label="Keluar"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
          {/* Tabs - horizontal scroll on mobile */}
          <nav className="flex gap-1 overflow-x-auto scroll-area-custom pb-1" aria-label="Navigasi Admin">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoute(tab.route)}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-md whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>
      <footer className="app-footer text-center text-xs text-muted-foreground py-3 px-3 safe-area-bottom">
        © {year} Kantin Gozeal · Sistem Manajemen Jatah Makanan &amp; Minuman Karyawan
      </footer>
    </div>
  )
}
