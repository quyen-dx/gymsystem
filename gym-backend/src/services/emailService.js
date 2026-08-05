import nodemailer from 'nodemailer'

let cachedSiteName = null
let siteNameCacheTime = 0
const SITE_NAME_CACHE_TTL = 60000

const getSiteName = async () => {
  if (cachedSiteName && Date.now() - siteNameCacheTime < SITE_NAME_CACHE_TTL) {
    return cachedSiteName
  }
  try {
    const { getSystemSettingsValue } = await import('./systemSettingsService.js')
    const settings = await getSystemSettingsValue()
    cachedSiteName = settings?.general?.siteName || 'GymPro'
  } catch {
    cachedSiteName = 'GymPro'
  }
  siteNameCacheTime = Date.now()
  return cachedSiteName
}

const createTransporter = () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const smtpHost = process.env.SMTP_HOST
    if (smtpHost) {
      return nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    }
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

export const getEmailTransportSummary = () => {
  const emailUserExists = !!process.env.EMAIL_USER
  const emailPassExists = !!process.env.EMAIL_PASS
  if (!emailUserExists || !emailPassExists) {
    return {
      EMAIL_USER_exists: emailUserExists,
      EMAIL_PASS_exists: emailPassExists,
      transportType: 'mock (jsonTransport)',
      host: null,
      service: null,
      port: null,
      secure: null,
      authUser: null,
    }
  }
  const smtpHost = process.env.SMTP_HOST
  if (smtpHost) {
    return {
      EMAIL_USER_exists: true,
      EMAIL_PASS_exists: true,
      transportType: 'smtp',
      host: smtpHost,
      service: null,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      authUser: process.env.EMAIL_USER,
    }
  }
  return {
    EMAIL_USER_exists: true,
    EMAIL_PASS_exists: true,
    transportType: 'service',
    host: null,
    service: process.env.EMAIL_SERVICE || 'gmail',
    port: null,
    secure: null,
    authUser: process.env.EMAIL_USER,
  }
}

export const sendMailWithLog = async (mailOptions) => {
  console.log('[EmailService] Sending email...', {
    to: mailOptions.to,
    subject: mailOptions.subject,
  })
  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('[EmailService] sendMail OK', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    })
    return info
  } catch (err) {
    console.error('[EmailService] sendMail FAILED', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      errCode: err.code,
      errCommand: err.command,
      errResponse: err.response,
      errResponseCode: err.responseCode,
    })
    console.error('[EmailService] sendMail stack:', err?.stack || err)
    throw err
  }
}

const logTransportStartup = () => {
  const summary = getEmailTransportSummary()
  console.log('[EmailService] Transport config:', summary)
  if (summary.transportType === 'mock (jsonTransport)') {
    console.warn(
      '[EmailService] WARNING: EMAIL_USER/EMAIL_PASS missing -> using jsonTransport, emails will NOT be sent!'
    )
  }
  transporter
    .verify()
    .then(() => {
      console.log('[EmailService] SMTP verify success (transport=' + summary.transportType + ')')
    })
    .catch((err) => {
      console.error('[EmailService] SMTP verify failed:', err?.message || err)
      console.error('[EmailService] SMTP verify stack:', err?.stack || err)
    })
}

logTransportStartup()

export const sendOtpEmail = async ({ toEmail, otp, purpose }) => {
  const purposeText =
    purpose === 'register' ? 'xác minh đăng ký tài khoản' : 'xác minh quên mật khẩu'

  const info = await sendMailWithLog({
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
  const info = await sendMailWithLog({
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
  const info = await sendMailWithLog({
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

export const sendRenewalSuccessEmail = async ({ toEmail, userName, planName, endDate, periodIndex }) => {
  const siteName = await getSiteName()
  const info = await sendMailWithLog({
    from: `"${siteName}" <${process.env.EMAIL_USER || 'no-reply@' + siteName.toLowerCase() + '.local'}>`,
    to: toEmail,
    subject: `Gia hạn gói tập thành công - ${siteName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">${siteName}</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">Gia hạn gói tập thành công 🎉</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Chào <strong>${userName}</strong>,<br/><br/>
          Gói tập <strong>${planName}</strong> của bạn đã được gia hạn thành công.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
          ${periodIndex ? `<p style="margin: 0 0 4px; color: #166534;"><strong>Đợt ${periodIndex}:</strong> ${new Date(endDate).toLocaleDateString('vi-VN')}</p>` : `<p style="margin: 0 0 4px; color: #166534;"><strong>Ngày hết hạn:</strong> ${new Date(endDate).toLocaleDateString('vi-VN')}</p>`}
          <p style="margin: 0; color: #166534;">Gói tập của bạn đang hoạt động, bạn có thể sử dụng ngay toàn bộ quyền lợi.</p>
        </div>
        <p style="color: #4b5563; line-height: 1.7; margin: 0;">Tiếp tục tập luyện và đạt được mục tiêu của bạn cùng ${siteName}!</p>
      </div>
    `,
  })

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email Renewal Success mock:', info.message)
  }

  return info
}

export const sendRenewalReminderEmail = async ({ toEmail, userName, planName, endDate, daysLeft }) => {
  const info = await sendMailWithLog({
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

export const sendPeriodCompletedEmail = async ({ toEmail, userName, planName, periodIndex, endDate }) => {
  const siteName = await getSiteName()
  const info = await sendMailWithLog({
    from: `"${siteName}" <${process.env.EMAIL_USER || 'no-reply@' + siteName.toLowerCase() + '.local'}>`,
    to: toEmail,
    subject: `Đợt ${periodIndex} gói ${planName} đã kết thúc - ${siteName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">${siteName}</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">Đợt tập đã kết thúc</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Chào <strong>${userName}</strong>,<br/><br/>
          Đợt <strong>${periodIndex}</strong> gói <strong>${planName}</strong> đã kết thúc vào ngày <strong>${new Date(endDate).toLocaleDateString('vi-VN')}</strong>.
        </p>
        <p style="color: #4b5563; line-height: 1.7; margin: 0;">Nếu bạn đã gia hạn, thời hạn gói tập của bạn đã được kéo dài tương ứng và bạn có thể tiếp tục sử dụng dịch vụ.</p>
      </div>
    `,
  })
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email Period Completed mock:', info.message)
  }
  return info
}

export const sendPeriodActivatedEmail = async ({ toEmail, userName, planName, periodIndex, startDate, endDate }) => {
  const siteName = await getSiteName()
  const info = await sendMailWithLog({
    from: `"${siteName}" <${process.env.EMAIL_USER || 'no-reply@' + siteName.toLowerCase() + '.local'}>`,
    to: toEmail,
    subject: `Đợt ${periodIndex} gói ${planName} đã bắt đầu - ${siteName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">${siteName}</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">Kỳ gia hạn mới đã bắt đầu</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Chào <strong>${userName}</strong>,<br/><br/>
          Đợt <strong>${periodIndex}</strong> gói <strong>${planName}</strong> đã bắt đầu.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0 0 4px; color: #166534;"><strong>Ngày bắt đầu:</strong> ${new Date(startDate).toLocaleDateString('vi-VN')}</p>
          <p style="margin: 0; color: #166534;"><strong>Ngày kết thúc:</strong> ${new Date(endDate).toLocaleDateString('vi-VN')}</p>
        </div>
        <p style="color: #4b5563; line-height: 1.7; margin: 0;">Chúc bạn tập luyện hiệu quả cùng ${siteName}!</p>
      </div>
    `,
  })
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email Period Activated mock:', info.message)
  }
  return info
}

export const sendCancelRenewalEmail = async ({ toEmail, userName, planName, days, refundAmount }) => {
  const siteName = await getSiteName()
  const info = await sendMailWithLog({
    from: `"${siteName}" <${process.env.EMAIL_USER || 'no-reply@' + siteName.toLowerCase() + '.local'}>`,
    to: toEmail,
    subject: `Đã hủy gia hạn gói ${planName} - ${siteName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">${siteName}</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">Đã hủy gia hạn gói tập</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Chào <strong>${userName}</strong>,<br/><br/>
          Lần gia hạn <strong>+${days} ngày</strong> gói <strong>${planName}</strong> đã được hủy thành công.
        </p>
        ${refundAmount > 0 ? `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0; color: #166534;"><strong>Số tiền hoàn vào ví:</strong> ${refundAmount.toLocaleString('vi-VN')}đ</p>
        </div>
        ` : `
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b;">Gia hạn đã được hủy (không hoàn tiền).</p>
        </div>
        `}
        <p style="color: #4b5563; line-height: 1.7; margin: 0;">Nếu có thắc mắc, vui lòng liên hệ với nhân viên ${siteName}.</p>
      </div>
    `,
  })
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email Cancel Renewal mock:', info.message)
  }
  return info
}

export const sendRefundRequestSubmittedEmail = async ({ toEmail, userName, planName, periodDetail, isFullCancel }) => {
  const siteName = await getSiteName()
  const info = await sendMailWithLog({
    from: `"${siteName}" <${process.env.EMAIL_USER || 'no-reply@' + siteName.toLowerCase() + '.local'}>`,
    to: toEmail,
    subject: `Yêu cầu hủy${isFullCancel ? ' gói' : ' gia hạn'} đã được gửi - ${siteName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">${siteName}</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">Yêu cầu hủy đã được gửi</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Chào <strong>${userName}</strong>,<br/><br/>
          Yêu cầu hủy${isFullCancel ? ' gói tập' : ' gia hạn'} <strong>${planName}</strong> đã được gửi đến nhân viên.
        </p>
        ${periodDetail ? `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0; color: #374151;">${periodDetail}</p>
        </div>
        ` : ''}
        <p style="color: #4b5563; line-height: 1.7; margin: 0;">Nhân viên sẽ kiểm tra và phản hồi trong thời gian sớm nhất. Sau khi xác nhận, bạn sẽ nhận được thông báo kết quả qua email.</p>
      </div>
    `,
  })
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email Refund Request Submitted mock:', info.message)
  }
  return info
}

export const sendRefundRequestProcessedEmail = async ({ toEmail, userName, planName, status, refundAmount, reason, isFullCancel, staffName, staffNote }) => {
  const siteName = await getSiteName()
  const isApproved = status === 'approved' || status === 'REFUNDED' || status === 'APPROVED'
  const processedDate = new Date().toLocaleDateString('vi-VN')
  const info = await sendMailWithLog({
    from: `"${siteName}" <${process.env.EMAIL_USER || 'no-reply@' + siteName.toLowerCase() + '.local'}>`,
    to: toEmail,
    subject: `${isApproved ? 'Đã xác nhận' : 'Từ chối'} yêu cầu hủy${isFullCancel ? ' gói' : ' gia hạn'} - ${siteName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px;">${siteName}</p>
        <h1 style="font-size: 24px; margin: 0 0 12px; color: #111827;">${isApproved ? 'Nhân viên đã xác nhận hủy' : 'Yêu cầu hủy bị từ chối'}</h1>
        <p style="color: #374151; line-height: 1.7; margin: 0 0 20px;">
          Chào <strong>${userName}</strong>,<br/><br/>
          Yêu cầu hủy${isFullCancel ? ' gói tập' : ' gia hạn'} <strong>${planName}</strong> của bạn đã được nhân viên <strong>${isApproved ? 'xác nhận' : 'từ chối'}</strong>.
        </p>
        ${staffName ? `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0 0 4px; color: #374151;"><strong>Nhân viên xử lý:</strong> ${staffName}</p>
          <p style="margin: 0 0 4px; color: #374151;"><strong>Ngày xử lý:</strong> ${processedDate}</p>
          ${staffNote ? `<p style="margin: 0; color: #374151;"><strong>Ghi chú:</strong> ${staffNote}</p>` : ''}
        </div>
        ` : ''}
        ${isApproved && refundAmount > 0 ? `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0; color: #166534; font-size: 16px; font-weight: 600;">Đã hoàn tiền vào ví: ${refundAmount.toLocaleString('vi-VN')}đ</p>
        </div>
        ` : isApproved ? `
        <div style="background: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0; color: #9a3412;">Đã hủy thành công (không hoàn tiền do đã sử dụng quyền lợi hoặc quá thời hạn).</p>
        </div>
        ` : ''}
        ${!isApproved && reason ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b;"><strong>Lý do từ chối:</strong> ${reason}</p>
        </div>
        ` : ''}
        <p style="color: #4b5563; line-height: 1.7; margin: 0;">Nếu có thắc mắc, vui lòng liên hệ với nhân viên ${siteName}.</p>
      </div>
    `,
  })
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email Refund Request Processed mock:', info.message)
  }
  return info
}
