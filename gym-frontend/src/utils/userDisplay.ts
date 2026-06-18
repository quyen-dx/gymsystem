type DisplayableUser = {
  fullName?: string | null
  displayName?: string | null
  name?: string | null
  email?: string | null
}

const clean = (value?: string | null) => String(value || '').trim()

export const getUserDisplayName = (user?: DisplayableUser | null, fallback = 'User') =>
  clean(user?.fullName) || clean(user?.displayName) || clean(user?.name) || fallback

export const getUserInitialName = (user?: DisplayableUser | null, fallback = 'U') =>
  getUserDisplayName(user, fallback)

export const getUserFirstName = (user?: DisplayableUser | null, fallback = 'User') => {
  const displayName = getUserDisplayName(user, fallback)
  return displayName.split(/\s+/).filter(Boolean).pop() || fallback
}
