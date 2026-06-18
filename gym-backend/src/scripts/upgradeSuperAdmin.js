import mongoose from 'mongoose'
import User from '../models/User.js'
import connectDB from '../config/db.js'

async function upgradeSuperAdmin() {
  await connectDB()

  const user = await User.findOne({ email: 'daoxuanquyen333@gmail.com' })

  if (!user) {
    console.log('❌ User daoxuanquyen333@gmail.com not found')
    process.exit(1)
  }

  console.log(`Found: ${user.name} (${user.email}) — current role: ${user.role}`)

  user.role = 'super_admin'
  await user.save()

  console.log(`✅ Upgraded to SUPER_ADMIN successfully`)
  console.log(`   Name:  ${user.name}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Role:  ${user.role}`)
  console.log(`   MemberCode: ${user.memberCode}`)

  process.exit(0)
}

upgradeSuperAdmin().catch((err) => {
  console.error(err)
  process.exit(1)
})
