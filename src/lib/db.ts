import { PrismaClient } from '@prisma/client'
import { createClient, type Client } from '@libsql/client'

const dbUrl = process.env.DATABASE_URL || ''
const tursoToken = process.env.DATABASE_AUTH_TOKEN || ''

// Turso mode is enabled when DATABASE_URL starts with libsql:// AND an auth token is set.
// Otherwise, fall back to Prisma with local SQLite (file:...).
export const isTurso = dbUrl.startsWith('libsql://') && !!tursoToken

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  turso: Client | undefined
}

// libsql client used in Turso mode (production on Vercel)
export const turso: Client | null = isTurso
  ? (globalForPrisma.turso ?? createClient({ url: dbUrl, authToken: tursoToken }))
  : null

if (isTurso && process.env.NODE_ENV !== 'production') {
  globalForPrisma.turso = turso ?? undefined
}

// Prisma client used in local dev mode (file: SQLite).
// In Turso mode we don't initialize Prisma at all to avoid Vercel connection errors.
export const db: PrismaClient = isTurso
  ? (null as unknown as PrismaClient)
  : (globalForPrisma.prisma ?? new PrismaClient())

if (!isTurso && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

// ===== Helpers for Turso raw SQL result coercion =====
// SQLite stores booleans as INTEGER (0/1) and dates as TEXT (ISO strings).

export function toBool(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'bigint') return v !== 0n
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true'
  return Boolean(v)
}

export function toInt(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

export function toStr(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback
  return String(v)
}

export function toISO(v: unknown): string {
  if (v === null || v === undefined) return new Date(0).toISOString()
  if (v instanceof Date) return v.toISOString()
  const s = String(v)
  // Prisma stores DateTime as ISO 8601 string in SQLite TEXT column.
  // If it's a valid date, normalize to ISO. Otherwise return as-is.
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString()
  return s
}

export function genId(): string {
  // Generate a unique ID using crypto.randomUUID() (UUID v4, 36 chars with dashes).
  // Works for any TEXT primary key column in SQLite/Turso.
  return crypto.randomUUID()
}
