// Setup Turso database: create tables + import data
// Run: TURSO_URL=libsql://... TURSO_TOKEN=eyJ... bun run scripts/setup-turso.ts

import { createClient } from '@libsql/client'

const TURSO_URL = process.env.TURSO_URL || ''
const TURSO_TOKEN = process.env.TURSO_TOKEN || ''

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('Set TURSO_URL and TURSO_TOKEN env vars')
  process.exit(1)
}

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })

// 31 employees
const EMPLOYEES = [
  'ADIS', 'ALDI KIPOY', 'ALDI NUR', 'ALIF', 'ANGGA', 'ANGGARA',
  'AZAM FABIYAN MUFAZAL HAQ', 'BAGAS', 'BAYU', 'BIYAN', 'DIMAS',
  'DITO', 'DZAKY', 'FERDI', 'FIKRI', 'GHIDAM', 'HILAL', 'ILHAM',
  'INDRA', 'KIPOY', 'LUKMAN', 'NADIA', 'NAYA', 'OVI', 'RAMA',
  'RIZKI', 'SAHRUL', 'SUHERYEDI', 'TOMI', 'VINO', 'YOGA', 'ZAKI',
]

// 10 variants
const FOOD_VARIANTS = ['AOKA', 'CHITATO', 'MIE ENAK', 'POP MIE', 'TARO', 'WAFLE']
const DRINK_VARIANTS = ['HYDROCOCO', 'MIZONE', 'NESCAFE', 'POCARI']

import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

async function main() {
  console.log('=== Setup Turso Database ===')
  console.log(`URL: ${TURSO_URL}`)

  // 1. Create tables
  console.log('\n--- Creating tables ---')
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS Admin (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS Employee (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      dateOfBirth TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS Variant (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      initialStock INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS Pickup (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      variantId TEXT NOT NULL,
      type TEXT NOT NULL,
      period TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (employeeId) REFERENCES Employee(id) ON DELETE CASCADE,
      FOREIGN KEY (variantId) REFERENCES Variant(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS EmployeeBalance (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      variantId TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (employeeId) REFERENCES Employee(id) ON DELETE CASCADE,
      FOREIGN KEY (variantId) REFERENCES Variant(id) ON DELETE CASCADE,
      UNIQUE(employeeId, variantId)
    )`,
    `CREATE TABLE IF NOT EXISTS PeriodSetting (
      id TEXT PRIMARY KEY,
      currentPeriod TEXT UNIQUE NOT NULL,
      startedAt TEXT NOT NULL,
      resetBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS StockHistory (
      id TEXT PRIMARY KEY,
      variantId TEXT NOT NULL,
      changeType TEXT NOT NULL,
      amount INTEGER NOT NULL,
      oldStock INTEGER NOT NULL,
      newStock INTEGER NOT NULL,
      note TEXT,
      changedBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (variantId) REFERENCES Variant(id) ON DELETE CASCADE
    )`,
  ]

  for (const sql of tables) {
    await client.execute(sql)
  }
  console.log('✅ All tables created')

  // 2. Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_pickup_emp_period ON Pickup(employeeId, period)',
    'CREATE INDEX IF NOT EXISTS idx_pickup_period ON Pickup(period)',
    'CREATE INDEX IF NOT EXISTS idx_balance_emp ON EmployeeBalance(employeeId)',
    'CREATE INDEX IF NOT EXISTS idx_balance_var ON EmployeeBalance(variantId)',
    'CREATE INDEX IF NOT EXISTS idx_stockhist_var ON StockHistory(variantId)',
    'CREATE INDEX IF NOT EXISTS idx_stockhist_created ON StockHistory(createdAt)',
  ]
  for (const sql of indexes) {
    await client.execute(sql)
  }
  console.log('✅ All indexes created')

  // 3. Insert Admin
  console.log('\n--- Inserting admin ---')
  const passwordHash = bcrypt.hashSync('Gozeal2012', 10)
  const now = new Date().toISOString()
  await client.execute({
    sql: `INSERT OR IGNORE INTO Admin (id, username, passwordHash, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [uuidv4(), 'gozealkantin', passwordHash, 'Administrator Kantin Gozeal', now, now],
  })
  console.log('✅ Admin created (gozealkantin)')

  // 4. Insert Employees
  console.log('\n--- Inserting employees ---')
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const code = `EMP${String(i + 1).padStart(3, '0')}`
    await client.execute({
      sql: `INSERT OR IGNORE INTO Employee (id, code, name, dateOfBirth, active, createdAt, updatedAt) VALUES (?, ?, ?, NULL, 1, ?, ?)`,
      args: [uuidv4(), code, EMPLOYEES[i], now, now],
    })
  }
  console.log(`✅ ${EMPLOYEES.length} employees created`)

  // 5. Insert Variants
  console.log('\n--- Inserting variants ---')
  const variantIds: { [key: string]: string } = {}
  for (const name of FOOD_VARIANTS) {
    const id = uuidv4()
    variantIds[name] = id
    await client.execute({
      sql: `INSERT OR IGNORE INTO Variant (id, name, type, stock, initialStock, active, createdAt, updatedAt) VALUES (?, ?, 'FOOD', 31, 31, 1, ?, ?)`,
      args: [id, name, now, now],
    })
  }
  for (const name of DRINK_VARIANTS) {
    const id = uuidv4()
    variantIds[name] = id
    await client.execute({
      sql: `INSERT OR IGNORE INTO Variant (id, name, type, stock, initialStock, active, createdAt, updatedAt) VALUES (?, ?, 'DRINK', 31, 31, 1, ?, ?)`,
      args: [id, name, now, now],
    })
  }
  console.log(`✅ ${FOOD_VARIANTS.length + DRINK_VARIANTS.length} variants created`)

  // 6. Insert PeriodSetting
  console.log('\n--- Inserting period ---')
  const period = now.slice(0, 7) // YYYY-MM
  await client.execute({
    sql: `INSERT OR IGNORE INTO PeriodSetting (id, currentPeriod, startedAt, resetBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [uuidv4(), period, now, 'system', now, now],
  })
  console.log(`✅ Period: ${period}`)

  // 7. Insert EmployeeBalance (1 per employee per variant)
  console.log('\n--- Inserting balances ---')
  const employees = await client.execute('SELECT id FROM Employee WHERE active = 1')
  const variants = await client.execute('SELECT id FROM Variant WHERE active = 1')
  
  let balanceCount = 0
  for (const emp of employees.rows) {
    for (const v of variants.rows) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO EmployeeBalance (id, employeeId, variantId, balance, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)`,
        args: [uuidv4(), emp.id as string, v.id as string, now, now],
      })
      balanceCount++
    }
  }
  console.log(`✅ ${balanceCount} balances created`)

  // 8. Verify
  console.log('\n=== VERIFICATION ===')
  const empCount = await client.execute('SELECT COUNT(*) as c FROM Employee')
  const varCount = await client.execute('SELECT COUNT(*) as c FROM Variant')
  const balCount = await client.execute('SELECT COUNT(*) as c FROM EmployeeBalance')
  const admCount = await client.execute('SELECT COUNT(*) as c FROM Admin')
  
  console.log(`Admin: ${admCount.rows[0].c}`)
  console.log(`Employees: ${empCount.rows[0].c}`)
  console.log(`Variants: ${varCount.rows[0].c}`)
  console.log(`Balances: ${balCount.rows[0].c}`)
  
  console.log('\n✅ Turso database setup complete!')
}

main().catch(e => { console.error(e); process.exit(1) })
