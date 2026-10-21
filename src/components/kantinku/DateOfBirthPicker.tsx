'use client'

import { Label } from '@/components/ui/label'
import { useMemo } from 'react'
import { getDaysInMonth, isLeapYear, parseDateOfBirth, formatDateOfBirth } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

interface DateOfBirthPickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  description?: string
  required?: boolean
  className?: string
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const currentYear = new Date().getFullYear()

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function DateOfBirthPicker({
  value,
  onChange,
  label = 'Tanggal Lahir',
  description,
  required,
  className,
}: DateOfBirthPickerProps) {
  const parsed = useMemo(() => parseDateOfBirth(value), [value])
  const day = parsed?.day || 0
  const month = parsed?.month || 0
  const year = parsed?.year || 0

  const effectiveYear = year || currentYear
  const effectiveMonth = month || 1
  const maxDays = month ? getDaysInMonth(effectiveYear, effectiveMonth) : 31

  const years = useMemo(() => {
    const arr: number[] = []
    for (let y = currentYear; y >= 1920; y--) arr.push(y)
    return arr
  }, [])

  const days = useMemo(() => {
    const arr: number[] = []
    for (let d = 1; d <= maxDays; d++) arr.push(d)
    return arr
  }, [maxDays])

  const allSelected = !!(day && month && year)

  const buildDateString = (d: number, m: number, y: number): string => {
    if (d && m && y) return `${y}-${pad2(m)}-${pad2(d)}`
    return ''
  }

  // Use native HTML select for maximum mobile compatibility
  const selectClass = cn(
    'flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base',
    'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns=' + "'http://www.w3.org/2000/svg'%20width='12'%20height='12'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='currentColor'%20stroke-width='2'%3E%3Cpath%20d='M6%209l6%206%206-6'/%3E%3C/svg%3E" + '")] bg-no-repeat bg-[right_0.75rem_center] pr-9',
  )

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="grid grid-cols-3 gap-2">
        {/* Day */}
        <select
          value={day || ''}
          onChange={(e) => {
            const d = Number(e.target.value)
            if (!d) return
            const safeDay = Math.min(d, maxDays)
            onChange(buildDateString(safeDay, month, year))
          }}
          className={selectClass}
          aria-label="Tanggal"
        >
          <option value="" disabled>Tanggal</option>
          {days.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Month */}
        <select
          value={month || ''}
          onChange={(e) => {
            const m = Number(e.target.value)
            if (!m) return
            const daysInM = getDaysInMonth(year || currentYear, m)
            const safeDay = day > daysInM ? daysInM : (day || 0)
            onChange(buildDateString(safeDay, m, year))
          }}
          className={selectClass}
          aria-label="Bulan"
        >
          <option value="" disabled>Bulan</option>
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* Year */}
        <select
          value={year || ''}
          onChange={(e) => {
            const y = Number(e.target.value)
            if (!y) return
            const m = month || 1
            const daysInY = getDaysInMonth(y, m)
            const safeDay = day > daysInY ? daysInY : (day || 0)
            onChange(buildDateString(safeDay, month, y))
          }}
          className={selectClass}
          aria-label="Tahun"
        >
          <option value="" disabled>Tahun</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {allSelected ? (
        <p className="text-xs text-slate-700 dark:text-slate-300">
          ✓ Tanggal terpilih: {formatDateOfBirth(value)}
          {month === 2 && day === 29 && !isLeapYear(year) ? (
            <span className="ml-1 text-slate-600">(Bukan tahun kabisat)</span>
          ) : null}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pilih tanggal, bulan, dan tahun lahir Anda
        </p>
      )}
    </div>
  )
}
