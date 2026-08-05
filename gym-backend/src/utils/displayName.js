const clean = (value) => (value === null || value === undefined ? '' : String(value).trim())

export const getDisplayName = (user, fallback = 'Không xác định') =>
  clean(user?.fullName) ||
  clean(user?.name) ||
  clean(user?.username) ||
  clean(user?.email) ||
  fallback

export default getDisplayName
