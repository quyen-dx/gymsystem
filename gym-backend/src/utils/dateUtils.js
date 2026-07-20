const MS_PER_DAY = 24 * 60 * 60 * 1000

export const startOfDayVN = () => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

export const startOfTodayVN = startOfDayVN

export const endOfDayVN = (date) => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export const startOfDay = (date, timezone = 'Asia/Ho_Chi_Minh') => {
  const d = new Date(date)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = +parts.find((p) => p.type === 'year').value
  const m = +parts.find((p) => p.type === 'month').value - 1
  const day = +parts.find((p) => p.type === 'day').value
  return new Date(y, m, day)
}

export const endOfDay = (date, timezone = 'Asia/Ho_Chi_Minh') => {
  const start = startOfDay(date, timezone)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setMilliseconds(end.getMilliseconds() - 1)
  return end
}

export const diffInDays = (startDate, endDate) => {
  const start = startOfDay(new Date(startDate))
  const end = startOfDay(new Date(endDate))
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
}

export const calculateRemainingDays = (endDate) => {
  const end = endOfDayVN(endDate)
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / MS_PER_DAY))
}

export const calcMembershipEndDate = ({ baseDate, durationDays }) => {
  const end = new Date(baseDate)
  end.setDate(end.getDate() + Number(durationDays))
  return endOfDayVN(end)
}

export default {
  startOfDayVN,
  endOfDayVN,
  startOfDay,
  endOfDay,
  diffInDays,
  calculateRemainingDays,
  calcMembershipEndDate,
}
