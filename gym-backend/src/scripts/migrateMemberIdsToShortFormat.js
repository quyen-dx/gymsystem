import User from '../models/User.js'
import connectDB from '../config/db.js'

const extractMemberNumber = (memberCode) => {
  const match = String(memberCode || '').trim().match(/^GP0*(\d+)$/i)
  return match ? Number.parseInt(match[1], 10) : null
}

async function migrateMemberIdsToShortFormat() {
  await connectDB()

  const users = await User.find({})
    .sort({ createdAt: 1, _id: 1 })
    .select('_id memberCode memberNumber name email createdAt')
    .lean()

  console.log(`Found ${users.length} users\n`)

  const planned = []
  const usedNumbers = new Set()
  let nextNumber = 1

  for (const user of users) {
    const existingNumber = Number(user.memberNumber) || extractMemberNumber(user.memberCode)
    let memberNumber = existingNumber && existingNumber > 0 ? existingNumber : null

    if (!memberNumber || usedNumbers.has(memberNumber)) {
      while (usedNumbers.has(nextNumber)) nextNumber += 1
      memberNumber = nextNumber
    }

    usedNumbers.add(memberNumber)
    planned.push({
      user,
      memberNumber,
      memberCode: `GP${memberNumber}`,
    })
  }

  const ids = planned.map((item) => item.user._id)
  await User.updateMany({ _id: { $in: ids } }, { $unset: { memberCode: '', memberNumber: '' } })
  console.log('Phase 1: cleared memberCode/memberNumber to avoid unique index conflicts\n')

  for (const item of planned) {
    await User.updateOne(
      { _id: item.user._id },
      { $set: { memberCode: item.memberCode, memberNumber: item.memberNumber } },
    )
    console.log(`${item.user.memberCode || '(empty)'} -> ${item.memberCode} | ${item.user.name || item.user.email || item.user._id}`)
  }

  console.log(`\nUpdated ${planned.length} users successfully`)
  process.exit(0)
}

migrateMemberIdsToShortFormat().catch((error) => {
  console.error(error)
  process.exit(1)
})
