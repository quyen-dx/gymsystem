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
    from: `"GymPro" <${process.env.EMAIL_USER || 'no-reply@gympro.local'}>`,
    to: toEmail,
    subject: `Mã OTP ${purposeText} - GymPro`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">GymPro</p>
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
    from: `"GymPro" <${process.env.EMAIL_USER || 'no-reply@gympro.local'}>`,
    to: toEmail,
    subject: `Thông báo ngừng hợp tác - GymPro`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">GymPro</p>
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

export const sendPartnershipRequestEmail = async ({ toEmail, request }) => {
  const info = await transporter.sendMail({
    from: `"GymPro" <${process.env.EMAIL_USER || 'no-reply@gympro.local'}>`,
    to: toEmail,
    subject: `Yêu cầu hợp tác mới - ${request.brand_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">GymPro</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">Yêu cầu hợp tác thương hiệu mới</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Thương hiệu <strong>${request.brand_name}</strong> vừa gửi yêu cầu hợp tác trên hệ thống GymPro.
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 12px;">
          <p style="margin: 0 0 8px;"><strong>Lĩnh vực:</strong> ${request.category}</p>
          <p style="margin: 0 0 8px;"><strong>Người liên hệ:</strong> ${request.contact_name}</p>
          <p style="margin: 0 0 8px;"><strong>Số điện thoại:</strong> ${request.phone}</p>
          <p style="margin: 0 0 8px;"><strong>Email:</strong> ${request.email}</p>
          <p style="margin: 0 0 8px;"><strong>Website:</strong> ${request.website || 'Không cung cấp'}</p>
          <p style="margin: 0;"><strong>Mô tả:</strong> ${request.description || 'Không cung cấp'}</p>
        </div>
      </div>
    `,
  })

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email Partnership Request mock:', info.message)
  }

  return info
}

export const sendRenewalSuccessEmail = async ({ toEmail, userName, planName, endDate }) => {
  const info = await transporter.sendMail({
    from: `"GymPro" <${process.env.EMAIL_USER || 'no-reply@gympro.local'}>`,
    to: toEmail,
    subject: `Gia hạn gói tập thành công - GymPro`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">GymPro</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">Gia hạn gói tập thành công 🎉</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Chào <strong>${userName}</strong>,<br/><br/>
          Gói tập <strong>${planName}</strong> của bạn đã được gia hạn thành công.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0 0 4px; color: #166534;"><strong>Ngày hết hạn:</strong> ${new Date(endDate).toLocaleDateString('vi-VN')}</p>
        </div>
        <p style="color: #4b5563; line-height: 1.7; margin: 0;">Tiếp tục tập luyện và đạt được mục tiêu của bạn cùng GymPro!</p>
      </div>
    `,
  })

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email Renewal Success mock:', info.message)
  }

  return info
}

export const sendRenewalReminderEmail = async ({ toEmail, userName, planName, endDate, daysLeft }) => {
  const info = await transporter.sendMail({
    from: `"GymPro" <${process.env.EMAIL_USER || 'no-reply@gympro.local'}>`,
    to: toEmail,
    subject: `Gói tập sắp hết hạn - Còn ${daysLeft} ngày - GymPro`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">GymPro</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">Gói tập sắp hết hạn</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Chào <strong>${userName}</strong>,<br/><br/>
          Gói tập <strong>${planName}</strong> của bạn sẽ hết hạn sau <strong>${daysLeft} ngày</strong> (${new Date(endDate).toLocaleDateString('vi-VN')}).
        </p>
        <div style="background: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 12px; color: #9a3412; font-weight: 600;">Bạn có muốn gia hạn gói tập không?</p>
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/my-membership"
             style="display: inline-block; padding: 12px 28px; background: #ea580c; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600;">
            Gia hạn ngay
          </a>
        </div>
        <p style="color: #4b5563; line-height: 1.7; margin: 0;">Nếu không gia hạn, gói tập của bạn sẽ hết hạn và không thể tiếp tục sử dụng dịch vụ.</p>
      </div>
    `,
  })

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email Renewal Reminder mock:', info.message)
  }

  return info
}
