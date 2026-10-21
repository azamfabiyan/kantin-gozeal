import { PrismaClient } from '@prisma/client'

// Detect if we should use Turso (cloud) or local SQLite
const dbUrl = process.env.DATABASE_URL || ''
const useTurso = dbUrl.startsWith('libsql://')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  if (useTurso && process.env.DATABASE_AUTH_TOKEN) {
    // Dynamic import for Turso adapter (only loads in production)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSQL } = require('@prisma/adapter-libsql')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client')
    const libsql = createClient({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }
  // Use local SQLite (sandbox/dev)
  return new PrismaClient()
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
