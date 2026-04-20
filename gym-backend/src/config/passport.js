import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as FacebookStrategy } from 'passport-facebook'
import User from '../models/User.js'
import { normalizeEmail } from '../utils/identifier.js'

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
        callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = normalizeEmail(profile.emails?.[0]?.value || '')
          const name = profile.displayName?.trim() || 'Người dùng Google'

          if (!email) {
            return done(new Error('Không lấy được email từ Google'), null)
          }

          let user = await User.findOne({ email })

          if (!user) {
            user = await User.create({
              name,
              email,
              provider: 'google',
              isVerified: true,
              role: 'member',
            })
          } else if (user.provider !== 'google') {
            user.provider = 'google'
            user.isVerified = true
            await user.save({ validateBeforeSave: false })
          }

          return done(null, user)
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
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/facebook/callback`,
      profileFields: ['id', 'displayName', 'name'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const name = profile.displayName?.trim() || 
          `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() || 
          'Người dùng Facebook'

        const facebookId = profile.id

        // Tìm theo facebookId thay vì email
        let user = await User.findOne({ facebookId })

        if (!user) {
          user = await User.create({
            name,
            facebookId,
            provider: 'facebook',
            isVerified: true,
            role: 'member',
          })
        }

        return done(null, user)
      } catch (error) {
        return done(error, null)
      }
    },
  ),
)
}

export default passport