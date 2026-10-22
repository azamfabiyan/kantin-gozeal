import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL || ''
const tursoToken = process.env.DATABASE_AUTH_TOKEN || ''
const useTurso = dbUrl.startsWith('libsql://') && tursoToken

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let db: PrismaClient

if (useTurso) {
  // Production: Turso with adapter
  try {
    const { createClient } = require('@libsql/client')
    const { PrismaLibSql } = require('@prisma/adapter-libsql')
    const libsql = createClient({
      url: dbUrl,
      authToken: tursoToken,
    })
    const adapter = new PrismaLibSql(libsql)
    db = globalForPrisma.prisma ?? new PrismaClient({ adapter })
  } catch (e) {
    console.error('[db.ts] Turso adapter failed:', e instanceof Error ? e.message : String(e))
    // Fallback: try direct SQLite (won't work on Vercel but prevents crash)
    db = globalForPrisma.prisma ?? new PrismaClient()
  }
} else {
  // Dev: local SQLite
  db = globalForPrisma.prisma ?? new PrismaClient()
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export { db }
