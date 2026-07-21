const formatVnPhone = (phone) => {
  if (!phone) return ''
  const cleaned = phone.replace(/[\s.()-]/g, '')
  if (cleaned.startsWith('+84')) return '0' + cleaned.slice(3)
  if (cleaned.startsWith('84') && cleaned.length >= 10) return '0' + cleaned.slice(2)
  return cleaned
}

export const sendOtpSms = async ({ phone, otp }) => {
  const message = `[GymPro] Ma OTP cua ban la ${otp}. Hieu luc 5 phut.`
  const toNumber = formatVnPhone(phone)

  if (!process.env.SPEEDSMS_TOKEN) {
    console.log(`SMS mock -> ${toNumber}: ${message}`)
    return true
  }

  try {
    const res = await fetch('https://api.speedsms.vn/index.php/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(process.env.SPEEDSMS_TOKEN + ':x').toString('base64'),
      },
      body: JSON.stringify({
        to: [toNumber],
        content: message,
        sms_type: 4,
      }),
    })

    const data = await res.json()

    if (data.status !== 'success') {
      throw new Error(data.message || 'Gửi SMS thất bại')
    }

    return true
  } catch (err) {
    console.error('[SMSService] sendOtpSms failed:', err.message)
    return false
  }
}

export const sendNotificationSms = async ({ phone, content }) => {
  if (!phone || !content) return false
  const toNumber = formatVnPhone(phone)

  const message = `[GymPro] ${content}`.slice(0, 160)

  if (!process.env.SPEEDSMS_TOKEN) {
    console.log(`SMS mock -> ${toNumber}: ${message}`)
    return true
  }

  try {
    const res = await fetch('https://api.speedsms.vn/index.php/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(process.env.SPEEDSMS_TOKEN + ':x').toString('base64'),
      },
      body: JSON.stringify({
        to: [toNumber],
        content: message,
        sms_type: 4,
      }),
    })

    const data = await res.json()
    return data.status === 'success'
  } catch (err) {
    console.error('[SMSService] sendNotificationSms failed:', err.message)
    return false
  }
}
