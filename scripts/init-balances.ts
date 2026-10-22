// Script to initialize EmployeeBalance for all employees × variants
// Balance = 1 per variant (jatah awal), dikurangi pickup yang sudah ada di periode ini
import { db } from '../src/lib/db'

async function main() {
  const employees = await db.employee.findMany({ where: { active: true } })
  const variants = await db.variant.findMany({ where: { active: true } })
  
  // Get current period
  let periodSetting = await db.periodSetting.findFirst({ orderBy: { createdAt: 'desc' } })
  const currentPeriod = periodSetting?.currentPeriod || new Date().toISOString().slice(0, 7)
  
  console.log(`Initializing balances for ${employees.length} employees × ${variants.length} variants`)
  console.log(`Current period: ${currentPeriod}`)
  
  let created = 0
  let skipped = 0
  
  for (const emp of employees) {
    for (const v of variants) {
      // Check if balance already exists
      const existing = await db.employeeBalance.findUnique({
        where: {
          employeeId_variantId: {
            employeeId: emp.id,
            variantId: v.id,
          },
        },
      })
      if (existing) {
        skipped++
        continue
      }
      
      // Count pickups for this employee × variant in current period
      const pickupCount = await db.pickup.count({
        where: {
          employeeId: emp.id,
          variantId: v.id,
          period: currentPeriod,
        },
      })
      
      // Balance = 1 (jatah awal) - pickup yang sudah ada
      const balance = Math.max(0, 1 - pickupCount)
      
      await db.employeeBalance.create({
        data: {
          employeeId: emp.id,
          variantId: v.id,
          balance,
        },
      })
      created++
    }
  }
  
  console.log(`✅ Created ${created} balance records`)
  console.log(`⏭️  Skipped ${skipped} (already existed)`)
  
  // Verify
  const totalBalances = await db.employeeBalance.count()
  const totalWithBalance = await db.employeeBalance.count({ where: { balance: { gt: 0 } } })
  console.log(`\nTotal balance records: ${totalBalances}`)
  console.log(`Records with balance > 0: ${totalWithBalance}`)
  
  await db.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
