'use client'

import Image from 'next/image'
import { useRouter } from '@/stores/router'
import type { ReactNode } from 'react'

interface EmployeeLayoutProps {
  children: ReactNode
  title?: string
  showBackToLogin?: boolean
}

export function EmployeeLayout({ children, title, showBackToLogin }: EmployeeLayoutProps) {
  const setRoute = useRouter((s) => s.setRoute)
  const year = new Date().getFullYear()

  return (
    <div className="app-shell min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30">
      <header className="brand-gradient-employee text-white shadow-md safe-area-top">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-white rounded-md p-1 flex items-center">
              <Image src="/gozeal-logo.png" alt="Kantin Gozeal" width={56} height={40} priority />
            </div>
            {title && (
              <span className="text-sm sm:text-base font-semibold hidden xs:inline sm:inline">
                {title}
              </span>
            )}
          </div>
          {showBackToLogin && (
            <button
              onClick={() => setRoute('karyawan/login')}
              className="text-xs sm:text-sm bg-white/20 hover:bg-white/30 transition-colors rounded-md px-3 py-1.5 font-medium"
            >
              Kembali ke Login
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>
      <footer className="app-footer text-center text-xs text-muted-foreground py-3 px-3 safe-area-bottom">
        © {year} Kantin Gozeal · Sistem Manajemen Jatah Makanan &amp; Minuman Karyawan
      </footer>
    </div>
  )
}
