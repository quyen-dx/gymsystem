import nodemailer from 'nodemailer'

const createTransporter = () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  }

  return nodemailer.createTransport({
    jsonTransport: true,
  })
}

export const transporter = createTransporter()

export const sendOtpEmail = async ({ toEmail, otp, purpose }) => {
  const purposeText =
    purpose === 'register' ? 'xác minh đăng ký tài khoản' : 'xác minh quên mật khẩu'

  const info = await transporter.sendMail({
    from: `"GymSystem" <${process.env.EMAIL_USER || 'no-reply@gymsystem.local'}>`,
    to: toEmail,
    subject: `Mã OTP ${purposeText} - GymSystem`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">GymSystem</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">Mã OTP của bạn</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Bạn đang thực hiện thao tác <strong>${purposeText}</strong>. Vui lòng nhập mã OTP bên dưới để tiếp tục.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; padding: 16px 28px; background: #fff1ed; color: #9a3412; font-size: 32px; font-weight: 700; letter-spacing: 0.35em; border-radius: 14px;">
            ${otp}
          </span>
        </div>
        <p style="color: #4b5563; line-height: 1.7; margin: 0;">Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với người khác.</p>
      </div>
    `,
  })

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email OTP mock:', info.message)
  }

  return info
}

export const sendShopDeletionEmail = async ({ toEmail, shopName, reason }) => {
  const info = await transporter.sendMail({
    from: `"GymSystem" <${process.env.EMAIL_USER || 'no-reply@gymsystem.local'}>`,
    to: toEmail,
    subject: `Thông báo ngừng hợp tác - GymSystem`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">GymSystem</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">Thông báo ngừng hợp tác</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Chào bạn, chúng tôi rất tiếc phải thông báo rằng cửa hàng <strong>${shopName}</strong> của bạn đã bị gỡ khỏi hệ thống.
        </p>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #991b1b; font-weight: 600;">Lý do xóa:</p>
          <p style="margin: 8px 0 0; color: #b91c1c;">${reason}</p>
        </div>
        <p style="color: #4b5563; line-height: 1.7; margin: 0;">Nếu có thắc mắc, vui lòng liên hệ với ban quản trị.</p>
      </div>
    `,
  })

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email Shop Deletion mock:', info.message)
  }

  return info
}
