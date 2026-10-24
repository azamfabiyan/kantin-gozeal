'use client'

import { useEffect } from 'react'
import { useRouter, useAdmin, useEmployee } from '@/stores/router'
import { EmployeeLogin } from '@/components/kantinku/EmployeeLogin'
import { EmployeeDashboard } from '@/components/kantinku/EmployeeDashboard'
import { EmployeeHistory } from '@/components/kantinku/EmployeeHistory'
import { AdminLogin } from '@/components/kantinku/AdminLogin'
import { AdminDashboard } from '@/components/kantinku/AdminDashboard'
import { AdminEmployees } from '@/components/kantinku/AdminEmployees'
import { AdminVariants } from '@/components/kantinku/AdminVariants'
import { AdminReports } from '@/components/kantinku/AdminReports'
import TVDashboard from '@/components/kantinku/TVDashboard'

export default function Home() {
  const route = useRouter((s) => s.route)
  const init = useRouter((s) => s.init)
  const hydrateAdmin = useAdmin((s) => s.hydrate)
  const hydrateEmployee = useEmployee((s) => s.hydrate)

  useEffect(() => {
    hydrateAdmin()
    hydrateEmployee()
    const cleanup = init()
    return cleanup
  }, [init, hydrateAdmin, hydrateEmployee])

  return <>{renderRoute(route)}</>
}

function renderRoute(route: string) {
  switch (route) {
    case 'karyawan/login':
      return <EmployeeLogin />
    case 'karyawan/dashboard':
      return <EmployeeDashboard />
    case 'karyawan/history':
      return <EmployeeHistory />
    case 'admin/login':
      return <AdminLogin />
    case 'admin/dashboard':
      return <AdminDashboard />
    case 'admin/employees':
      return <AdminEmployees />
    case 'admin/variants':
      return <AdminVariants />
    case 'admin/reports':
      return <AdminReports />
    case 'tv':
      return <TVDashboard />
    default:
      return <EmployeeLogin />
  }
}
