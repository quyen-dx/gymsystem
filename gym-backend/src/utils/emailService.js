import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Tạo OTP 6 chữ số
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Gửi email OTP quên mật khẩu
export const sendOTPEmail = async (toEmail, otp, userName) => {
  const mailOptions = {
    from: `"GymSystem" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: '🔐 Mã OTP đặt lại mật khẩu - GymSystem',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #3B82F6; text-align: center;">GymSystem</h2>
        <p>Xin chào <strong>${userName}</strong>,</p>
        <p>Bạn đã yêu cầu đặt lại mật khẩu. Đây là mã OTP của bạn:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3B82F6; background: #EFF6FF; padding: 12px 24px; border-radius: 8px;">
            ${otp}
          </span>
        </div>
        <p style="color: #666;">⏳ Mã OTP có hiệu lực trong <strong>10 phút</strong>.</p>
        <p style="color: #666;">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">GymSystem — Hệ thống quản lý phòng gym</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};