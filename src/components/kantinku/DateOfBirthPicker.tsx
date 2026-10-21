'use client'

import { Label } from '@/components/ui/label'
import { useState, useMemo } from 'react'
import { getDaysInMonth, isLeapYear, parseDateOfBirth } from '@/lib/auth-client'
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
  // Local state - initialized once from value prop via useState initializer
  // User selects each field independently, then we emit combined value
  const [day, setDay] = useState<string>(() => {
    const p = parseDateOfBirth(value)
    return p?.day ? String(p.day) : ''
  })
  const [month, setMonth] = useState<string>(() => {
    const p = parseDateOfBirth(value)
    return p?.month ? String(p.month) : ''
  })
  const [year, setYear] = useState<string>(() => {
    const p = parseDateOfBirth(value)
    return p?.year ? String(p.year) : ''
  })

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

  // Emit combined value to parent only when all 3 fields are selected
  const emitIfComplete = (d: string, m: string, y: string) => {
    if (d && m && y) {
      onChange(`${y}-${pad2(Number(m))}-${pad2(Number(d))}`)
    } else {
      onChange('') // not complete yet
    }
  }

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDay = e.target.value
    setDay(newDay)
    emitIfComplete(newDay, month, year)
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value
    setMonth(newMonth)
    // Validate day against new month
    const daysInM = getDaysInMonth(year ? Number(year) : currentYear, Number(newMonth))
    let effectiveDay = day
    if (day && Number(day) > daysInM) {
      effectiveDay = String(daysInM)
      setDay(effectiveDay)
    }
    emitIfComplete(effectiveDay, newMonth, year)
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = e.target.value
    setYear(newYear)
    // Validate day against new year
    const m = month ? Number(month) : 1
    const daysInY = getDaysInMonth(Number(newYear), m)
    let effectiveDay = day
    if (day && Number(day) > daysInY) {
      effectiveDay = String(daysInY)
      setDay(effectiveDay)
    }
    emitIfComplete(effectiveDay, month, newYear)
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
          ✓ Tanggal terpilih: {day} {MONTHS[Number(month) - 1]} {year}
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
