import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'
import {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_NAME,
} from '../src/lib/auth'

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const existing = await db.admin.findUnique({ where: { username: ADMIN_USERNAME } })
  if (existing) {
    await db.admin.update({
      where: { id: existing.id },
      data: { passwordHash, name: ADMIN_NAME },
    })
    console.log(`✓ Admin credentials updated for "${ADMIN_USERNAME}" (id: ${existing.id})`)
  } else {
    const admin = await db.admin.create({
      data: {
        username: ADMIN_USERNAME,
        passwordHash,
        name: ADMIN_NAME,
      },
    })
    console.log(`✓ Admin created: "${ADMIN_USERNAME}" (id: ${admin.id})`)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('✗ Failed to update admin credentials:', e)
  process.exit(1)
})
