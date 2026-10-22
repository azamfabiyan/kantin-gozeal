// Client-safe date helpers (no server imports)

export function parseDateOfBirth(dob: string): { day: number; month: number; year: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function formatDateOfBirth(dob: string | null | undefined): string {
  if (!dob) return '-'
  const parsed = parseDateOfBirth(dob)
  if (!parsed) return dob
  return `${parsed.day} ${INDONESIAN_MONTHS[parsed.month - 1]} ${parsed.year}`
}

export function formatTimestamp(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return String(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatPeriod(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period)
  if (!m) return period
  return `${INDONESIAN_MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

export function getDaysInMonth(year: number, month: number): number {
  // month is 1-based
  return new Date(year, month, 0).getDate()
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}
