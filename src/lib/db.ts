import { PrismaClient } from '@prisma/client'

// Detect if we should use Turso (cloud) or local SQLite
// Use Turso if DATABASE_URL starts with "libsql://"
const dbUrl = process.env.DATABASE_URL || ''
const useTurso = dbUrl.startsWith('libsql://')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  if (useTurso) {
    // Use Turso adapter for cloud database (Vercel production)
    const { PrismaLibSQL } = require('@prisma/adapter-libsql')
    const { createClient } = require('@libsql/client')
    const libsql = createClient({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter, log: ['error', 'warn'] })
  }
  // Use local SQLite (sandbox/dev)
  return new PrismaClient({ log: ['error', 'warn'] })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
