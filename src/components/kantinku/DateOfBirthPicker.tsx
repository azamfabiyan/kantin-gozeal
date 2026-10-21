'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useCallback, useMemo } from 'react'
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
  const maxDays = useMemo(
    () => (month ? getDaysInMonth(effectiveYear, effectiveMonth) : 31),
    [month, effectiveYear, effectiveMonth],
  )

  const buildDateString = useCallback(
    (d: number, m: number, y: number): string => {
      if (d && m && y) return `${y}-${pad2(m)}-${pad2(d)}`
      return ''
    },
    [],
  )

  const handleDayChange = useCallback(
    (val: string) => {
      const d = Number(val)
      if (!d) return
      const safeDay = Math.min(d, maxDays)
      onChange(buildDateString(safeDay, month, year))
    },
    [maxDays, month, year, onChange, buildDateString],
  )

  const handleMonthChange = useCallback(
    (val: string) => {
      const m = Number(val)
      if (!m) return
      const days = getDaysInMonth(year || currentYear, m)
      const safeDay = day > days ? days : (day || 0)
      onChange(buildDateString(safeDay, m, year))
    },
    [day, year, onChange, buildDateString],
  )

  const handleYearChange = useCallback(
    (val: string) => {
      const y = Number(val)
      if (!y) return
      const m = month || 1
      const days = getDaysInMonth(y, m)
      const safeDay = day > days ? days : (day || 0)
      onChange(buildDateString(safeDay, month, y))
    },
    [day, month, onChange, buildDateString],
  )

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

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="grid grid-cols-3 gap-2">
        <Select value={day ? String(day) : ''} onValueChange={handleDayChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tanggal" />
          </SelectTrigger>
          <SelectContent className="max-h-[60vh]">
            {days.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month ? String(month) : ''} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Bulan" />
          </SelectTrigger>
          <SelectContent className="max-h-[60vh]">
            {MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year ? String(year) : ''} onValueChange={handleYearChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tahun" />
          </SelectTrigger>
          <SelectContent className="max-h-[60vh]">
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {allSelected ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          ✓ Tanggal terpilih: {formatDateOfBirth(value)}
          {month === 2 && day === 29 && !isLeapYear(year) ? (
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
