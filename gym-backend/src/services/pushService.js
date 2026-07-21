import admin from 'firebase-admin'
import PushToken from '../models/PushToken.js'

let fcm = null

export const initPushService = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8'),
      )
      if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
      }
      fcm = admin.messaging()
    } catch (err) {
      console.warn('[PushService] Firebase init failed, push disabled:', err.message)
    }
  } else {
    console.log('[PushService] FIREBASE_SERVICE_ACCOUNT not set, push disabled')
  }
}

export const getMessaging = () => fcm

export const sendPushNotification = async (userId, { title, body, data = {}, icon, badge }) => {
  if (!fcm) return { sent: 0, failed: 0, skipped: 0 }

  const tokens = await PushToken.getActiveTokensForUser(userId)
  if (!tokens.length) return { sent: 0, failed: 0, skipped: 0 }

  const messageBase = {
    notification: {
      title: title || '',
      body: body || '',
    },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    ),
  }

  if (icon) messageBase.notification.icon = icon
  if (badge) messageBase.notification.badge = String(badge)

  const results = { sent: 0, failed: 0, skipped: 0 }

  const sendResults = await Promise.allSettled(
    tokens.map(async (t) => {
      try {
        await fcm.send({ ...messageBase, token: t.token })
        await PushToken.findByIdAndUpdate(t._id, { lastUsedAt: new Date() })
        return true
      } catch (err) {
        if (err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token') {
          await PushToken.deactivateToken(t.token)
        }
        throw err
      }
    }),
  )

  for (const r of sendResults) {
    if (r.status === 'fulfilled' && r.value) {
      results.sent++
    } else if (r.status === 'rejected') {
      results.failed++
    }
  }

  return results
}
