// export const sendOtpSms = async ({ phone, otp }) => {
//   const message = `[GymSystem] Ma OTP cua ban la ${otp}. Hieu luc 5 phut.`

//   const toNumber = phone.startsWith('+84')
//     ? '0' + phone.slice(3)
//     : phone

//   if (!process.env.SPEEDSMS_TOKEN) {
//     console.log(`SMS OTP mock -> ${toNumber}: ${message}`)
//     return true
//   }

//   const res = await fetch('https://api.speedsms.vn/index.php/sms/send', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': 'Basic ' + Buffer.from(process.env.SPEEDSMS_TOKEN + ':x').toString('base64'),
//     },
//     body: JSON.stringify({
//       to: [toNumber],
//       content: message,
//       sms_type: 4,
//     }),
//   })

//   const data = await res.json()
//   console.log('SpeedSMS:', data)

//   if (data.status !== 'success') {
//     throw new Error(data.message || 'Gửi SMS thất bại')
//   }

//   return true
// }
export const sendOtpSms = async ({ phone, otp }) => {
  const message = `[GymSystem] Ma OTP cua ban la ${otp}. Hieu luc 5 phut.`

  const toNumber = phone.startsWith('+84')
    ? '0' + phone.slice(3)
    : phone

  console.log(`📱 SMS OTP -> ${toNumber}: ${message}`)
  return true
}