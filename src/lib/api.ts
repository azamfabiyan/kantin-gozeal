// Client-side API helpers for Kantin Gozeal

import type {
  AdminInfo,
  DashboardStats,
  EmployeeInfo,
  EmployeeWithPickups,
  PeriodInfo,
  PickupInfo,
  ReportData,
  ReportFilters,
  StockHistoryInfo,
  VariantInfo,
  VariantWithStatus,
} from '@/lib/types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data as T
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('kantin_admin_token')
}

export function getEmployeeToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('kantin_employee_token')
}

// ===== Auth =====
export const api = {
  // Admin
  adminLogin: (username: string, password: string) =>
    request<{ token: string; admin: AdminInfo }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  adminMe: () =>
    request<{ admin: AdminInfo }>('/api/auth/me', {
      headers: { 'x-admin-token': getAdminToken() || '' },
    }),

  adminLogout: () =>
    request<{ ok: true }>('/api/auth/logout', {
      method: 'POST',
      headers: { 'x-admin-token': getAdminToken() || '' },
    }),

  // Employee
  employeeLogin: (name: string, dateOfBirth: string) =>
    request<{ token: string; employee: EmployeeInfo }>('/api/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ name, dateOfBirth }),
    }),

  employeeMe: () =>
    request<{ employee: EmployeeInfo }>('/api/auth/employee/me', {
      headers: { 'x-employee-token': getEmployeeToken() || '' },
    }),

  employeeLogout: () =>
    request<{ ok: true }>('/api/auth/employee/logout', {
      method: 'POST',
      headers: { 'x-employee-token': getEmployeeToken() || '' },
    }),

  // Employees
  listEmployees: () =>
    request<{ employees: EmployeeWithPickups[]; activePeriod: string }>('/api/employees', {
      headers: { 'x-admin-token': getAdminToken() || '' },
    }),

  listEmployeesPublic: () =>
    request<{ employees: EmployeeInfo[] }>('/api/employees-public'),

  createEmployee: (data: { name: string; dateOfBirth: string | null; active: boolean }) =>
    request<{ employee: EmployeeInfo }>('/api/employees', {
      method: 'POST',
      headers: { 'x-admin-token': getAdminToken() || '' },
      body: JSON.stringify(data),
    }),

  updateEmployee: (id: string, data: { name: string; dateOfBirth: string | null; active: boolean }) =>
    request<{ employee: EmployeeInfo }>(`/api/employees/${id}`, {
      method: 'PUT',
      headers: { 'x-admin-token': getAdminToken() || '' },
      body: JSON.stringify(data),
    }),

  deleteEmployee: (id: string) =>
    request<{ ok: true }>(`/api/employees/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': getAdminToken() || '' },
    }),

  // Variants
  listVariants: () =>
    request<{ variants: VariantInfo[]; activePeriod: string }>('/api/variants', {
      headers: { 'x-admin-token': getAdminToken() || '' },
    }),

  createVariant: (data: { name: string; type: 'FOOD' | 'DRINK'; stock: number; active: boolean }) =>
    request<{ variant: VariantInfo }>('/api/variants', {
      method: 'POST',
      headers: { 'x-admin-token': getAdminToken() || '' },
      body: JSON.stringify(data),
    }),

  updateVariant: (id: string, data: Partial<{ name: string; type: 'FOOD' | 'DRINK'; stock: number; active: boolean }>) =>
    request<{ variant: VariantInfo }>(`/api/variants/${id}`, {
      method: 'PUT',
      headers: { 'x-admin-token': getAdminToken() || '' },
      body: JSON.stringify(data),
    }),

  deleteVariant: (id: string) =>
    request<{ ok: true }>(`/api/variants/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': getAdminToken() || '' },
    }),

  addStock: (id: string, amount: number, note: string) =>
    request<{ variant: VariantInfo }>(`/api/variants/${id}/add-stock`, {
      method: 'POST',
      headers: { 'x-admin-token': getAdminToken() || '' },
      body: JSON.stringify({ amount, note }),
    }),

  applyQuota: (id: string) =>
    request<{ ok: boolean; message: string; variant: string; quota: number; employeesUpdated: number }>(`/api/variants/${id}/apply-quota`, {
      method: 'POST',
      headers: { 'x-admin-token': getAdminToken() || '' },
    }),

  variantHistory: (id: string) =>
    request<{ history: StockHistoryInfo[] }>(`/api/variants/${id}/history`, {
      headers: { 'x-admin-token': getAdminToken() || '' },
    }),

  // Pickups
  createPickup: (employeeId: string, variantId: string) =>
    request<{ pickup: PickupInfo }>('/api/pickups', {
      method: 'POST',
      headers: { 'x-employee-token': getEmployeeToken() || '' },
      body: JSON.stringify({ employeeId, variantId }),
    }),

  // Scan (employee dashboard data)
  getScan: (employeeId: string) =>
    request<{
      employee: EmployeeInfo
      activePeriod: string
      foodVariants: VariantWithStatus[]
      drinkVariants: VariantWithStatus[]
      history: PickupInfo[]
      foodTaken: number
      drinkTaken: number
    }>(`/api/scan?employeeId=${employeeId}`),

  // Dashboard
  getDashboard: () =>
    request<{ stats: DashboardStats }>('/api/dashboard', {
      headers: { 'x-admin-token': getAdminToken() || '' },
    }),

  // Period
  getCurrentPeriod: () =>
    request<{ period: PeriodInfo }>('/api/period/current'),

  resetPeriod: (mode: 'current' | 'next') =>
    request<{ period: string }>('/api/period/reset', {
      method: 'POST',
      headers: { 'x-admin-token': getAdminToken() || '' },
      body: JSON.stringify({ mode }),
    }),

  setPeriod: (period: string) =>
    request<{ period: string; message: string }>('/api/period/set', {
      method: 'POST',
      headers: { 'x-admin-token': getAdminToken() || '' },
      body: JSON.stringify({ period }),
    }),

  // Reports
  getReports: (filters: ReportFilters) => {
    const params = new URLSearchParams()
    if (filters.period) params.set('period', filters.period)
    if (filters.type) params.set('type', filters.type)
    if (filters.employeeId) params.set('employeeId', filters.employeeId)
    if (filters.variantId) params.set('variantId', filters.variantId)
    return request<{ report: ReportData }>(`/api/reports?${params.toString()}`, {
      headers: { 'x-admin-token': getAdminToken() || '' },
    })
  },

  exportReports: (filters: ReportFilters) => {
    const params = new URLSearchParams()
    if (filters.period) params.set('period', filters.period)
    if (filters.type) params.set('type', filters.type)
    if (filters.employeeId) params.set('employeeId', filters.employeeId)
    if (filters.variantId) params.set('variantId', filters.variantId)
    return request<{ csv: string }>(`/api/reports/export?${params.toString()}`, {
      headers: { 'x-admin-token': getAdminToken() || '' },
    })
  },

  // Employee history (all periods)
  employeeHistory: (employeeId: string) =>
    request<{ history: PickupInfo[] }>(`/api/pickups?employeeId=${employeeId}`, {
      headers: { 'x-employee-token': getEmployeeToken() || '' },
    }),
}

export type Api = typeof api
