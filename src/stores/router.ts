import { create } from 'zustand'
import type { AdminInfo, EmployeeInfo } from '@/lib/types'

// ===== Hash router =====
type RouterState = {
  route: string
  setRoute: (route: string) => void
  init: () => () => void
}

function parseHash(): string {
  if (typeof window === 'undefined') return 'karyawan/login'
  const hash = window.location.hash.replace(/^#\/?/, '')
  const valid = [
    'karyawan/login', 'karyawan/dashboard', 'karyawan/history',
    'admin/login', 'admin/dashboard', 'admin/employees', 'admin/variants', 'admin/reports',
    'scan', 'picker', 'tv',
  ]
  if (valid.includes(hash)) return hash
  return 'karyawan/login'
}

export const useRouter = create<RouterState>((set) => ({
  route: typeof window !== 'undefined' ? parseHash() : 'karyawan/login',
  setRoute: (route) => {
    if (typeof window !== 'undefined') {
      window.location.hash = `/${route}`
    }
    set({ route })
  },
  init: () => {
    if (typeof window === 'undefined') return () => {}
    const handler = () => set({ route: parseHash() })
    window.addEventListener('hashchange', handler)
    if (!window.location.hash) {
      window.location.hash = '/karyawan/login'
    }
    set({ route: parseHash() })
    return () => window.removeEventListener('hashchange', handler)
  },
}))

// ===== Admin auth =====
type AdminState = {
  isAuthenticated: boolean
  admin: AdminInfo | null
  setAdmin: (admin: AdminInfo, token: string) => void
  logout: () => void
  hydrate: () => void
}

export const useAdmin = create<AdminState>((set) => ({
  isAuthenticated: false,
  admin: null,
  setAdmin: (admin, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('kantin_admin_token', token)
      localStorage.setItem('kantin_admin', JSON.stringify(admin))
    }
    set({ isAuthenticated: true, admin })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kantin_admin_token')
      localStorage.removeItem('kantin_admin')
    }
    set({ isAuthenticated: false, admin: null })
  },
  hydrate: () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('kantin_admin_token')
    const adminStr = localStorage.getItem('kantin_admin')
    if (token && adminStr) {
      try {
        const admin = JSON.parse(adminStr) as AdminInfo
        set({ isAuthenticated: true, admin })
      } catch {
        localStorage.removeItem('kantin_admin_token')
        localStorage.removeItem('kantin_admin')
      }
    }
  },
}))

// ===== Employee auth =====
type EmployeeState = {
  isAuthenticated: boolean
  employee: EmployeeInfo | null
  setEmployee: (employee: EmployeeInfo, token: string) => void
  logout: () => void
  hydrate: () => void
}

export const useEmployee = create<EmployeeState>((set) => ({
  isAuthenticated: false,
  employee: null,
  setEmployee: (employee, token) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('kantin_employee_token', token)
      sessionStorage.setItem('kantin_employee', JSON.stringify(employee))
    }
    set({ isAuthenticated: true, employee })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kantin_employee_token')
      sessionStorage.removeItem('kantin_employee')
    }
    set({ isAuthenticated: false, employee: null })
  },
  hydrate: () => {
    if (typeof window === 'undefined') return
    const token = sessionStorage.getItem('kantin_employee_token')
    const empStr = sessionStorage.getItem('kantin_employee')
    if (token && empStr) {
      try {
        const employee = JSON.parse(empStr) as EmployeeInfo
        set({ isAuthenticated: true, employee })
      } catch {
        sessionStorage.removeItem('kantin_employee_token')
        sessionStorage.removeItem('kantin_employee')
      }
    }
  },
}))
