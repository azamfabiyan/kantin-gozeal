import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL || ''
const useTurso = dbUrl.startsWith('libsql://')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// For Turso (production), we need to use the adapter
// For local SQLite (dev), we use Prisma directly
let db: PrismaClient

if (useTurso && process.env.DATABASE_AUTH_TOKEN) {
  // Production: Turso with adapter
  // Use require() which works in Vercel serverless
  try {
    const { createClient } = require('@libsql/client')
    const { PrismaLibSQL } = require('@prisma/adapter-libsql')
    const libsql = createClient({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })
    const adapter = new PrismaLibSQL(libsql)
    db = globalForPrisma.prisma ?? new PrismaClient({ adapter })
  } catch (e) {
    console.error('Failed to init Turso adapter:', e)
    // Fallback to local
    db = globalForPrisma.prisma ?? new PrismaClient()
  }
} else {
  // Dev: local SQLite
  db = globalForPrisma.prisma ?? new PrismaClient()
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export { db }
