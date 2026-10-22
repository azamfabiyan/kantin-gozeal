import { db, isTurso, turso, toBool, genId } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import type { PrismaClient } from '@prisma/client'

// ===== Admin hardcoded credentials =====
export const ADMIN_USERNAME = 'gozealkantin'
export const ADMIN_PASSWORD = 'Gozeal2012'
export const ADMIN_NAME = 'Administrator Kantin Gozeal'

const SESSION_SECRET = process.env.SESSION_SECRET || 'kantin-gozeal-session-secret-2012-very-long'
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ===== HMAC-SHA256 session token (pure crypto, no DB) =====
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

// ===== Admin auth (token only, no DB) =====
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

// ===== Employee auth (token only, no DB) =====
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

// ===== DB-backed admin functions =====

interface AdminRow {
  id: string
  username: string
  passwordHash: string
  name: string
}

async function findAdminByUsername(username: string): Promise<AdminRow | null> {
  if (isTurso && turso) {
    const r = await turso.execute({ sql: 'SELECT id, username, passwordHash, name FROM Admin WHERE username = ?', args: [username] })
    if (r.rows.length === 0) return null
    const row = r.rows[0]
    return {
      id: String(row.id),
      username: String(row.username),
      passwordHash: String(row.passwordHash),
      name: String(row.name),
    }
  }
  const admin = await (db as PrismaClient).admin.findUnique({ where: { username } })
  if (!admin) return null
  return { id: admin.id, username: admin.username, passwordHash: admin.passwordHash, name: admin.name }
}

async function findAdminById(id: string): Promise<AdminRow | null> {
  if (isTurso && turso) {
    const r = await turso.execute({ sql: 'SELECT id, username, passwordHash, name FROM Admin WHERE id = ?', args: [id] })
    if (r.rows.length === 0) return null
    const row = r.rows[0]
    return {
      id: String(row.id),
      username: String(row.username),
      passwordHash: String(row.passwordHash),
      name: String(row.name),
    }
  }
  const admin = await (db as PrismaClient).admin.findUnique({ where: { id } })
  if (!admin) return null
  return { id: admin.id, username: admin.username, passwordHash: admin.passwordHash, name: admin.name }
}

export async function ensureAdminExists(): Promise<void> {
  try {
    if (isTurso && turso) {
      const r = await turso.execute('SELECT COUNT(*) as cnt FROM Admin')
      const cnt = Number((r.rows[0] as { cnt: number | bigint }).cnt)
      if (cnt > 0) return
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
      await turso.execute({
        sql: 'INSERT INTO Admin (id, username, passwordHash, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [genId(), ADMIN_USERNAME, passwordHash, ADMIN_NAME, new Date().toISOString(), new Date().toISOString()],
      })
      return
    }
    const existing = await (db as PrismaClient).admin.findFirst()
    if (existing) return
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
    await (db as PrismaClient).admin.create({
      data: { username: ADMIN_USERNAME, passwordHash, name: ADMIN_NAME },
    })
  } catch (e) {
    // If DB fails (e.g., Turso connection issue), skip - hardcoded credentials will be used
    console.error('[ensureAdminExists] DB error:', e instanceof Error ? e.message : String(e))
  }
}

export async function authenticateAdmin(
  username: string,
  password: string,
): Promise<{ token: string; admin: { id: string; username: string; name: string } } | null> {
  // Try DB first
  try {
    await ensureAdminExists()
    const admin = await findAdminByUsername(username)
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

export async function getAdminFromRequest(
  req: Request,
): Promise<{ id: string; username: string; name: string } | null> {
  const token = req.headers.get('x-admin-token') || ''
  const decoded = verifyAdminToken(token)
  if (!decoded) return null
  // Allow hardcoded admin id (when DB is unavailable)
  if (decoded.adminId === 'hardcoded-admin-id') {
    return { id: 'hardcoded-admin-id', username: ADMIN_USERNAME, name: ADMIN_NAME }
  }
  try {
    const admin = await findAdminById(decoded.adminId)
    if (!admin) return null
    return { id: admin.id, username: admin.username, name: admin.name }
  } catch (e) {
    console.error('[getAdminFromRequest] DB error:', e instanceof Error ? e.message : String(e))
    return null
  }
}

// ===== DB-backed employee functions =====

interface EmployeeRow {
  id: string
  code: string
  name: string
  dateOfBirth: string | null
  active: boolean
}

export async function findEmployeeById(id: string): Promise<EmployeeRow | null> {
  if (isTurso && turso) {
    const r = await turso.execute({
      sql: 'SELECT id, code, name, dateOfBirth, active FROM Employee WHERE id = ?',
      args: [id],
    })
    if (r.rows.length === 0) return null
    const row = r.rows[0]
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      dateOfBirth: row.dateOfBirth === null || row.dateOfBirth === undefined ? null : String(row.dateOfBirth),
      active: toBool(row.active),
    }
  }
  const emp = await (db as PrismaClient).employee.findUnique({ where: { id } })
  if (!emp) return null
  return { id: emp.id, code: emp.code, name: emp.name, dateOfBirth: emp.dateOfBirth, active: emp.active }
}

export async function getEmployeeFromRequest(
  req: Request,
): Promise<{ id: string; code: string; name: string; dateOfBirth: string | null } | null> {
  const token = req.headers.get('x-employee-token') || ''
  const decoded = verifyEmployeeToken(token)
  if (!decoded) return null
  try {
    const emp = await findEmployeeById(decoded.employeeId)
    if (!emp || !emp.active) return null
    return { id: emp.id, code: emp.code, name: emp.name, dateOfBirth: emp.dateOfBirth }
  } catch (e) {
    console.error('[getEmployeeFromRequest] DB error:', e instanceof Error ? e.message : String(e))
    return null
  }
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
  try {
    if (isTurso && turso) {
      const r = await turso.execute('SELECT currentPeriod FROM PeriodSetting ORDER BY startedAt DESC LIMIT 1')
      if (r.rows.length > 0) return String((r.rows[0] as { currentPeriod: string }).currentPeriod)
      // Auto-create current period
      const current = getCurrentPeriod()
      await turso.execute({
        sql: 'INSERT INTO PeriodSetting (id, currentPeriod, startedAt, resetBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [genId(), current, new Date().toISOString(), 'system', new Date().toISOString(), new Date().toISOString()],
      })
      return current
    }
    const setting = await (db as PrismaClient).periodSetting.findFirst({ orderBy: { startedAt: 'desc' } })
    if (setting) return setting.currentPeriod
    const current = getCurrentPeriod()
    await (db as PrismaClient).periodSetting.create({ data: { currentPeriod: current, resetBy: 'system' } })
    return current
  } catch (e) {
    console.error('[getActivePeriod] DB error, falling back to current month:', e instanceof Error ? e.message : String(e))
    return getCurrentPeriod()
  }
}

export async function resetCurrentPeriod(resetBy: string): Promise<void> {
  const current = getCurrentPeriod()
  const nowIso = new Date().toISOString()

  if (isTurso && turso) {
    // Upsert period setting
    const existing = await turso.execute({ sql: 'SELECT id FROM PeriodSetting WHERE currentPeriod = ?', args: [current] })
    if (existing.rows.length > 0) {
      await turso.execute({
        sql: 'UPDATE PeriodSetting SET startedAt = ?, resetBy = ?, updatedAt = ? WHERE currentPeriod = ?',
        args: [nowIso, resetBy, nowIso, current],
      })
    } else {
      await turso.execute({
        sql: 'INSERT INTO PeriodSetting (id, currentPeriod, startedAt, resetBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [genId(), current, nowIso, resetBy, nowIso, nowIso],
      })
    }

    // Delete all pickups for this period
    await turso.execute({ sql: 'DELETE FROM Pickup WHERE period = ?', args: [current] })

    // Reset variant stocks and record history
    const variantsR = await turso.execute('SELECT id, stock, initialStock FROM Variant')
    for (const row of variantsR.rows) {
      const vId = String(row.id)
      const stock = Number(row.stock)
      const initialStock = Number(row.initialStock)
      await turso.execute({ sql: 'UPDATE Variant SET stock = ?, updatedAt = ? WHERE id = ?', args: [initialStock, nowIso, vId] })
      await turso.execute({
        sql: 'INSERT INTO StockHistory (id, variantId, changeType, amount, oldStock, newStock, note, changedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [genId(), vId, 'SET', initialStock - stock, stock, initialStock, `Reset periode ${current}`, resetBy, nowIso],
      })
    }

    // Reset all EmployeeBalance to 1 (fresh start, pickup records deleted)
    await turso.execute('UPDATE EmployeeBalance SET balance = 1, updatedAt = ?', [nowIso])

    // Ensure balances exist for every active employee × variant
    const employeesR = await turso.execute('SELECT id FROM Employee WHERE active = 1')
    for (const eRow of employeesR.rows) {
      const eId = String(eRow.id)
      for (const vRow of variantsR.rows) {
        const vId = String(vRow.id)
        const exists = await turso.execute({
          sql: 'SELECT id FROM EmployeeBalance WHERE employeeId = ? AND variantId = ?',
          args: [eId, vId],
        })
        if (exists.rows.length === 0) {
          await turso.execute({
            sql: 'INSERT INTO EmployeeBalance (id, employeeId, variantId, balance, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)',
            args: [genId(), eId, vId, nowIso, nowIso],
          })
        }
      }
    }
    return
  }

  await (db as PrismaClient).periodSetting.upsert({
    where: { currentPeriod: current },
    update: { startedAt: new Date(), resetBy, updatedAt: new Date() },
    create: { currentPeriod: current, resetBy },
  })
  await (db as PrismaClient).pickup.deleteMany({ where: { period: current } })
  const variants = await (db as PrismaClient).variant.findMany()
  for (const v of variants) {
    await (db as PrismaClient).variant.update({ where: { id: v.id }, data: { stock: v.initialStock } })
    await (db as PrismaClient).stockHistory.create({
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
  const employees = await (db as PrismaClient).employee.findMany({ where: { active: true } })
  for (const emp of employees) {
    for (const v of variants) {
      await (db as PrismaClient).employeeBalance.upsert({
        where: { employeeId_variantId: { employeeId: emp.id, variantId: v.id } },
        update: { balance: 1 },
        create: { employeeId: emp.id, variantId: v.id, balance: 1 },
      })
    }
  }
}

export async function startNewPeriod(resetBy: string): Promise<string> {
  const nowIso = new Date().toISOString()

  if (isTurso && turso) {
    // Get current active period from DB
    const r = await turso.execute('SELECT currentPeriod FROM PeriodSetting ORDER BY createdAt DESC LIMIT 1')
    const currentActivePeriod = r.rows.length > 0 ? String((r.rows[0] as { currentPeriod: string }).currentPeriod) : getCurrentPeriod()

    // Calculate NEXT period from current active period
    const [y, m] = currentActivePeriod.split('-').map(Number)
    const nextDate = new Date(y, m, 1) // month is 0-based, so m = next month
    const nextPeriod = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

    // Upsert new period setting
    const existing = await turso.execute({ sql: 'SELECT id FROM PeriodSetting WHERE currentPeriod = ?', args: [nextPeriod] })
    if (existing.rows.length > 0) {
      await turso.execute({
        sql: 'UPDATE PeriodSetting SET startedAt = ?, resetBy = ?, updatedAt = ?, createdAt = ? WHERE currentPeriod = ?',
        args: [nowIso, resetBy, nowIso, nowIso, nextPeriod],
      })
    } else {
      await turso.execute({
        sql: 'INSERT INTO PeriodSetting (id, currentPeriod, startedAt, resetBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [genId(), nextPeriod, nowIso, resetBy, nowIso, nowIso],
      })
    }

    // Reset variant stocks to initialStock for new period
    const variantsR = await turso.execute('SELECT id, stock, initialStock FROM Variant')
    for (const row of variantsR.rows) {
      const vId = String(row.id)
      const stock = Number(row.stock)
      const initialStock = Number(row.initialStock)
      await turso.execute({ sql: 'UPDATE Variant SET stock = ?, updatedAt = ? WHERE id = ?', args: [initialStock, nowIso, vId] })
      await turso.execute({
        sql: 'INSERT INTO StockHistory (id, variantId, changeType, amount, oldStock, newStock, note, changedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [genId(), vId, 'SET', initialStock - stock, stock, initialStock, `Mulai periode baru ${nextPeriod}`, resetBy, nowIso],
      })
    }

    // CARRY-OVER: Add +1 balance to all employees × variants (saldo menumpuk ke periode baru)
    const employeesR = await turso.execute('SELECT id FROM Employee WHERE active = 1')
    for (const eRow of employeesR.rows) {
      const eId = String(eRow.id)
      for (const vRow of variantsR.rows) {
        const vId = String(vRow.id)
        const exists = await turso.execute({
          sql: 'SELECT id, balance FROM EmployeeBalance WHERE employeeId = ? AND variantId = ?',
          args: [eId, vId],
        })
        if (exists.rows.length > 0) {
          const curBalance = Number((exists.rows[0] as { balance: number | bigint }).balance)
          await turso.execute({
            sql: 'UPDATE EmployeeBalance SET balance = ?, updatedAt = ? WHERE id = ?',
            args: [curBalance + 1, nowIso, String((exists.rows[0] as { id: string }).id)],
          })
        } else {
          await turso.execute({
            sql: 'INSERT INTO EmployeeBalance (id, employeeId, variantId, balance, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)',
            args: [genId(), eId, vId, nowIso, nowIso],
          })
        }
      }
    }
    return nextPeriod
  }

  // Prisma (local dev) mode
  const currentSetting = await (db as PrismaClient).periodSetting.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  const currentActivePeriod = currentSetting?.currentPeriod || getCurrentPeriod()

  const [y, m] = currentActivePeriod.split('-').map(Number)
  const nextDate = new Date(y, m, 1)
  const nextPeriod = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

  await (db as PrismaClient).periodSetting.upsert({
    where: { currentPeriod: nextPeriod },
    update: { startedAt: new Date(), resetBy, updatedAt: new Date() },
    create: { currentPeriod: nextPeriod, resetBy },
  })

  const variants = await (db as PrismaClient).variant.findMany()
  for (const v of variants) {
    await (db as PrismaClient).variant.update({ where: { id: v.id }, data: { stock: v.initialStock } })
    await (db as PrismaClient).stockHistory.create({
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
  const employees = await (db as PrismaClient).employee.findMany({ where: { active: true } })
  for (const emp of employees) {
    for (const v of variants) {
      await (db as PrismaClient).employeeBalance.upsert({
        where: { employeeId_variantId: { employeeId: emp.id, variantId: v.id } },
        update: { balance: { increment: 1 } },
        create: { employeeId: emp.id, variantId: v.id, balance: 1 },
      })
    }
  }
  return nextPeriod
}

// ===== Date helpers (shared, pure functions) =====
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
