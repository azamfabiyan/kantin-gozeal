// Shared types for Kantin Gozeal

export type VariantType = 'FOOD' | 'DRINK'

export interface AdminInfo {
  id: string
  username: string
  name: string
}

export interface EmployeeInfo {
  id: string
  code: string
  name: string
  dateOfBirth: string | null
  active?: boolean
}

export interface VariantInfo {
  id: string
  name: string
  type: VariantType
  stock: number
  initialStock: number
  active: boolean
  createdAt: string
}

export interface PickupInfo {
  id: string
  employeeId: string
  variantId: string
  type: VariantType
  period: string
  timestamp: string
  employee?: { id: string; name: string; code: string }
  variant?: { id: string; name: string; type: VariantType }
}

export interface VariantWithStatus extends VariantInfo {
  taken: boolean
  takenCount: number
  status: 'available' | 'taken' | 'out_of_stock'
}

export interface DashboardStats {
  totalEmployees: number
  pickupsThisPeriod: number
  employeesWithoutPickup: number
  lowStockCount: number
  activePeriod: string
  recentPickups: PickupInfo[]
  foodStock: VariantInfo[]
  drinkStock: VariantInfo[]
  periodTrend: { period: string; food: number; drink: number }[]
  periodDistribution: { type: VariantType; count: number }[]
}

export interface StockHistoryInfo {
  id: string
  variantId: string
  changeType: 'ADD' | 'REDUCE' | 'SET' | 'PICKUP_DECREMENT'
  amount: number
  oldStock: number
  newStock: number
  note: string | null
  changedBy: string
  createdAt: string
  variant?: { id: string; name: string; type: VariantType }
}

export interface PeriodInfo {
  currentPeriod: string
  startedAt: string
  resetBy: string | null
}

export interface EmployeeWithPickups extends EmployeeInfo {
  foodPickups: number
  drinkPickups: number
  totalPickups: number
  createdAt: string
}

export interface ReportFilters {
  period?: string
  type?: VariantType
  employeeId?: string
  variantId?: string
}

export interface ReportData {
  summary: {
    totalPickups: number
    foodPickups: number
    drinkPickups: number
    uniqueEmployees: number
  }
  rows: PickupInfo[]
}
