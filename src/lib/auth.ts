import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// ===== Admin hardcoded credentials =====
export const ADMIN_USERNAME = 'gozealkantin'
export const ADMIN_PASSWORD = 'Gozeal2012'
export const ADMIN_NAME = 'Administrator Kantin Gozeal'

const SESSION_SECRET = process.env.SESSION_SECRET || 'kantin-gozeal-session-secret-2012-very-long'
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ===== HMAC-SHA256 session token =====
function signToken(payload: string, expiresAt: number): string {
  const data = `${payload}.${expiresAt}`
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex')
  return `${data}.${sig}`
}

function verifyToken(token: string): { payload: string; expiresAt: number } | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [payload, expiresStr, sig] = parts
  const expiresAt = Number(expiresStr)
  if (!expiresAt || Number.isNaN(expiresAt)) return null
  if (Date.now() > expiresAt) return null
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(`${payload}.${expiresAt}`).digest('hex')
  if (sig !== expectedSig) return null
  return { payload, expiresAt }
}

// ===== Admin auth =====
export function createAdminToken(adminId: string): string {
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS
  return signToken(`admin:${adminId}`, expiresAt)
}

export function verifyAdminToken(token: string): { adminId: string } | null {
  const result = verifyToken(token)
  if (!result) return null
  const [prefix, adminId] = result.payload.split(':')
  if (prefix !== 'admin' || !adminId) return null
  return { adminId }
}

export async function ensureAdminExists(): Promise<void> {
  try {
    const existing = await db.admin.findFirst()
    if (existing) return
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
    await db.admin.create({
      data: {
        username: ADMIN_USERNAME,
        passwordHash,
        name: ADMIN_NAME,
      },
    })
  } catch (e) {
    // If DB fails (e.g., Turso connection issue), skip - hardcoded credentials will be used
    console.error('[ensureAdminExists] DB error:', e instanceof Error ? e.message : String(e))
  }
}

export async function authenticateAdmin(username: string, password: string): Promise<{ token: string; admin: { id: string; username: string; name: string } } | null> {
  // Try DB first
  try {
    await ensureAdminExists()
    const admin = await db.admin.findUnique({ where: { username } })
    if (admin) {
      const ok = await bcrypt.compare(password, admin.passwordHash)
      if (ok) {
        const token = createAdminToken(admin.id)
        return { token, admin: { id: admin.id, username: admin.username, name: admin.name } }
      }
    }
  } catch (e) {
    console.error('[authenticateAdmin] DB error, using hardcoded:', e instanceof Error ? e.message : String(e))
  }
  
  // Fallback: hardcoded credentials (if DB fails or admin not found)
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = createAdminToken('hardcoded-admin-id')
    return { token, admin: { id: 'hardcoded-admin-id', username: ADMIN_USERNAME, name: ADMIN_NAME } }
  }
  
  return null
}

export async function getAdminFromRequest(req: Request): Promise<{ id: string; username: string; name: string } | null> {
  const token = req.headers.get('x-admin-token') || ''
  const decoded = verifyAdminToken(token)
  if (!decoded) return null
  const admin = await db.admin.findUnique({ where: { id: decoded.adminId } })
  if (!admin) return null
  return { id: admin.id, username: admin.username, name: admin.name }
}

// ===== Employee auth =====
export function createEmployeeToken(employeeId: string): string {
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS
  return signToken(`employee:${employeeId}`, expiresAt)
}

export function verifyEmployeeToken(token: string): { employeeId: string } | null {
  const result = verifyToken(token)
  if (!result) return null
  const [prefix, employeeId] = result.payload.split(':')
  if (prefix !== 'employee' || !employeeId) return null
  return { employeeId }
}

export async function getEmployeeFromRequest(req: Request): Promise<{ id: string; code: string; name: string; dateOfBirth: string | null } | null> {
  const token = req.headers.get('x-employee-token') || ''
  const decoded = verifyEmployeeToken(token)
  if (!decoded) return null
  const emp = await db.employee.findUnique({ where: { id: decoded.employeeId } })
  if (!emp || !emp.active) return null
  return { id: emp.id, code: emp.code, name: emp.name, dateOfBirth: emp.dateOfBirth }
}

// ===== Period helpers =====
export function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getPreviousPeriods(count: number): string[] {
  const periods: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    periods.push(`${year}-${month}`)
  }
  return periods
}

export async function getActivePeriod(): Promise<string> {
  const setting = await db.periodSetting.findFirst({ orderBy: { startedAt: 'desc' } })
  if (setting) return setting.currentPeriod
  // Auto-create current period
  const current = getCurrentPeriod()
  await db.periodSetting.create({
    data: { currentPeriod: current, resetBy: 'system' },
  })
  return current
}

export async function resetCurrentPeriod(resetBy: string): Promise<void> {
  const current = getCurrentPeriod()
  await db.periodSetting.upsert({
    where: { currentPeriod: current },
    update: { startedAt: new Date(), resetBy, updatedAt: new Date() },
    create: { currentPeriod: current, resetBy },
  })
  // Delete all pickups for this period
  await db.pickup.deleteMany({ where: { period: current } })
  // Reset all variant stocks to initialStock
  const variants = await db.variant.findMany()
  for (const v of variants) {
    await db.variant.update({ where: { id: v.id }, data: { stock: v.initialStock } })
    await db.stockHistory.create({
      data: {
        variantId: v.id,
        changeType: 'SET',
        amount: v.initialStock - v.stock,
        oldStock: v.stock,
        newStock: v.initialStock,
        note: `Reset periode ${current}`,
        changedBy: resetBy,
      },
    })
  }
  // Reset all EmployeeBalance to 1 (fresh start, pickup records deleted)
  const employees = await db.employee.findMany({ where: { active: true } })
  for (const emp of employees) {
    for (const v of variants) {
      await db.employeeBalance.upsert({
        where: { employeeId_variantId: { employeeId: emp.id, variantId: v.id } },
        update: { balance: 1 },
        create: { employeeId: emp.id, variantId: v.id, balance: 1 },
      })
    }
  }
}

export async function startNewPeriod(resetBy: string): Promise<string> {
  // Get current active period from DB
  const currentSetting = await db.periodSetting.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  const currentActivePeriod = currentSetting?.currentPeriod || getCurrentPeriod()
  
  // Calculate NEXT period from current active period
  const [y, m] = currentActivePeriod.split('-').map(Number)
  const nextDate = new Date(y, m, 1) // month is 0-based, so m = next month
  const nextPeriod = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
  
  // Create new period setting (or upsert if somehow exists)
  await db.periodSetting.upsert({
    where: { currentPeriod: nextPeriod },
    update: { startedAt: new Date(), resetBy, updatedAt: new Date() },
    create: { currentPeriod: nextPeriod, resetBy },
  })
  
  // Reset variant stocks to initialStock for new period
  const variants = await db.variant.findMany()
  for (const v of variants) {
    await db.variant.update({ where: { id: v.id }, data: { stock: v.initialStock } })
    await db.stockHistory.create({
      data: {
        variantId: v.id,
        changeType: 'SET',
        amount: v.initialStock - v.stock,
        oldStock: v.stock,
        newStock: v.initialStock,
        note: `Mulai periode baru ${nextPeriod}`,
        changedBy: resetBy,
      },
    })
  }
  // CARRY-OVER: Add +1 balance to all employees × variants
  // Saldo yang tidak dipakai di periode lama menumpuk ke periode baru
  const employees = await db.employee.findMany({ where: { active: true } })
  for (const emp of employees) {
    for (const v of variants) {
      await db.employeeBalance.upsert({
        where: { employeeId_variantId: { employeeId: emp.id, variantId: v.id } },
        update: { balance: { increment: 1 } },
        create: { employeeId: emp.id, variantId: v.id, balance: 1 },
      })
    }
  }
  return nextPeriod
}

// ===== Date helpers (shared) =====
export function parseDateOfBirth(dob: string): { day: number; month: number; year: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

export function formatDateOfBirth(dob: string): string {
  const parsed = parseDateOfBirth(dob)
  if (!parsed) return dob
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return `${parsed.day} ${months[parsed.month - 1]} ${parsed.year}`
}

export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
