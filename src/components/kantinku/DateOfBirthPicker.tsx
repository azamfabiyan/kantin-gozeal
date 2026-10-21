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
  // Fully controlled - derive day/month/year from value prop
  const parsed = useMemo(() => parseDateOfBirth(value), [value])
  const day = parsed?.day ? String(parsed.day) : ''
  const month = parsed?.month ? String(parsed.month) : ''
  const year = parsed?.year ? String(parsed.year) : ''

  const effectiveYear = year ? Number(year) : currentYear
  const effectiveMonth = month ? Number(month) : 1
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

  // Helper to emit new value to parent
  const emitChange = (newDay: string, newMonth: string, newYear: string) => {
    if (newDay && newMonth && newYear) {
      onChange(`${newYear}-${pad2(Number(newMonth))}-${pad2(Number(newDay))}`)
    } else {
      onChange('')
    }
  }

  // Handlers - simple, just emit
  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    emitChange(e.target.value, month, year)
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value
    // Validate day against new month
    const daysInM = getDaysInMonth(year ? Number(year) : currentYear, Number(newMonth))
    const effectiveDay = day && Number(day) > daysInM ? String(daysInM) : day
    emitChange(effectiveDay, newMonth, year)
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = e.target.value
    // Validate day against new year
    const m = month ? Number(month) : 1
    const daysInY = getDaysInMonth(Number(newYear), m)
    const effectiveDay = day && Number(day) > daysInY ? String(daysInY) : day
    emitChange(effectiveDay, month, newYear)
  }

  const selectClass = cn(
    'flex h-11 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-base',
    'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
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
          value={day}
          onChange={handleDayChange}
          className={selectClass}
          aria-label="Tanggal"
        >
          <option value="">Tanggal</option>
          {days.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Month */}
        <select
          value={month}
          onChange={handleMonthChange}
          className={selectClass}
          aria-label="Bulan"
        >
          <option value="">Bulan</option>
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* Year */}
        <select
          value={year}
          onChange={handleYearChange}
          className={selectClass}
          aria-label="Tahun"
        >
          <option value="">Tahun</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {allSelected ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          ✓ Tanggal terpilih: {formatDateOfBirth(value)}
          {month === '2' && day === '29' && !isLeapYear(Number(year)) ? (
            <span className="ml-1 text-amber-600">(Bukan tahun kabisat)</span>
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
