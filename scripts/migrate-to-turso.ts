// Migration script: SQLite → Turso (cloud SQLite)
// Run: bun run scripts/migrate-to-turso.ts
// 
// PREREQUISITE:
// 1. turso db create kantin-gozeal
// 2. turso db tokens create kantin-gozeal
// 3. Set DATABASE_URL and DATABASE_AUTH_TOKEN in .env

import { db } from '../src/lib/db'

async function main() {
  console.log('=== Migrate data to Turso ===')
  
  // Get all data from local SQLite
  const [employees, variants, pickups, balances, periodSettings, stockHistory, admins] = await Promise.all([
    db.employee.findMany(),
    db.variant.findMany(),
    db.pickup.findMany(),
    db.employeeBalance.findMany(),
    db.periodSetting.findMany(),
    db.stockHistory.findMany(),
    db.admin.findMany(),
  ])
  
  console.log(`Data to migrate:`)
  console.log(`  - ${employees.length} employees`)
  console.log(`  - ${variants.length} variants`)
  console.log(`  - ${pickups.length} pickups`)
  console.log(`  - ${balances.length} balances`)
  console.log(`  - ${periodSettings.length} period settings`)
  console.log(`  - ${stockHistory.length} stock history`)
  console.log(`  - ${admins.length} admins`)
  
  // Export to JSON for manual import if needed
  const fs = require('fs')
  const exportData = {
    employees, variants, pickups, balances, periodSettings, stockHistory, admins
  }
  fs.writeFileSync('/home/z/my-project/download/turso-migration-data.json', JSON.stringify(exportData, null, 2))
  console.log('\n✅ Data exported to download/turso-migration-data.json')
  console.log('   Use this file to import data to Turso after migration')
  
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
