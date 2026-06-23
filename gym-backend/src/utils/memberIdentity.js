export const extractMemberNumber = (memberCode) => {
  const match = String(memberCode || '').trim().match(/^GP0*(\d+)$/i)
  return match ? Number.parseInt(match[1], 10) : null
}

export const formatMemberCode = (memberNumber) => {
  const number = Number(memberNumber)
  return Number.isInteger(number) && number > 0 ? `GP${number}` : null
}

export const normalizeUserMemberIdentity = (user) => {
  if (!user) return user
  const target = user.toObject ? user.toObject() : { ...user }
  const memberNumber = Number(target.memberNumber) || extractMemberNumber(target.memberCode)
  const memberCode = formatMemberCode(memberNumber)
  if (memberNumber) target.memberNumber = memberNumber
  if (memberCode) target.memberCode = memberCode
  return target
}

export const normalizeUserArrayMemberIdentity = (users = []) =>
  users.map((user) => normalizeUserMemberIdentity(user))
