import passport from 'passport'
import { Strategy as FacebookStrategy } from 'passport-facebook'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { getBackendUrl } from './appUrls.js'
import User from '../models/User.js'
import { normalizeEmail } from '../utils/identifier.js'

const firstProfilePhoto = (profile) =>
  profile.photos?.find((photo) => photo?.value)?.value || ''

const backfillSocialProfile = async (user, { provider, fullName, email, avatar, googleId, facebookId, facebookProfileUrl }) => {
  let changed = false
  const displayName = String(fullName || '').trim()

  if (provider && user.provider !== provider) {
    user.provider = provider
    changed = true
  }
  if (!user.isVerified) {
    user.isVerified = true
    changed = true
  }
  if (displayName && !String(user.fullName || '').trim()) {
    user.fullName = displayName
    changed = true
  }
  if (displayName && !String(user.name || '').trim()) {
    user.name = displayName
    changed = true
  }
  if (email && !user.email) {
    user.email = email
    changed = true
  }
  if (avatar && !String(user.avatar || '').trim()) {
    user.avatar = avatar
    changed = true
  }
  if (facebookId && user.facebookId !== facebookId) {
    user.facebookId = facebookId
    changed = true
  }
  if (facebookProfileUrl && user.facebookProfileUrl !== facebookProfileUrl) {
    user.facebookProfileUrl = facebookProfileUrl
    changed = true
  }
  if (googleId && user.googleId !== googleId) {
    user.googleId = googleId
    changed = true
  }

  if (changed) await user.save({ validateBeforeSave: false })
  return user
}

export const isGoogleOAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
)

export const isFacebookOAuthConfigured = Boolean(
  process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET,
)

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id)
    done(null, user || null)
  } catch (error) {
    done(error, null)
  }
})

if (isGoogleOAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${getBackendUrl()}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = normalizeEmail(profile.emails?.[0]?.value || '')
          const name = profile.displayName?.trim() || profile.name?.givenName || 'Người dùng Google'
          const avatar = firstProfilePhoto(profile)

          if (!email) {
            return done(new Error('Không lấy được email từ Google'), null)
          }

          const googleId = profile.id

          let user = await User.findOne({
            $or: [
              { googleId },
              ...(email ? [{ email }] : []),
            ],
          })

          if (!user) {
            user = await User.create({
              name,
              fullName: name,
              email,
              avatar,
              googleId,
              provider: 'google',
              isVerified: true,
              role: 'member',
            })
          } else {
            user = await backfillSocialProfile(user, {
              provider: 'google',
              fullName: name,
              email,
              avatar,
              googleId,
            })
          }

          return done(null, user, { profile })
        } catch (error) {
          return done(error, null)
        }
      },
    ),
  )
}

if (isFacebookOAuthConfigured) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${getBackendUrl()}/api/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'name', 'emails', 'photos', 'profileUrl'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const name = profile.displayName?.trim() ||
            `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() ||
            'Người dùng Facebook'
          const email = normalizeEmail(profile.emails?.[0]?.value || '')
          const avatar = firstProfilePhoto(profile)

          const facebookId = profile.id
          const facebookProfileUrl = profile.profileUrl

          let user = await User.findOne({
            $or: [
              { facebookId },
              ...(email ? [{ email }] : []),
            ],
          })

          if (!user) {
            user = await User.create({
              name,
              fullName: name,
              ...(email ? { email } : {}),
              avatar,
              facebookId,
              facebookProfileUrl,
              provider: 'facebook',
              isVerified: true,
              role: 'member',
            })
          } else {
            user = await backfillSocialProfile(user, {
              provider: 'facebook',
              fullName: name,
              email,
              avatar,
              facebookId,
              facebookProfileUrl,
            })
          }

          return done(null, user, { profile })
        } catch (error) {
          return done(error, null)
        }
      },
    ),
  )
}

export default passport
