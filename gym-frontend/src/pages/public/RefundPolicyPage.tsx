import { Link } from 'react-router-dom'
import MemberLayout from '../../components/layout/header/MemberLayout'

const sections = [
  {
    title: '1. Điều Kiện Hoàn Tiền',
    items: [
      'Yêu cầu hoàn tiền phải được gửi trong vòng 7 ngày kể từ ngày đăng ký.',
      'Gói tập chưa được sử dụng quá 30% tổng số buổi.',
      'Hội viên chưa tham gia bất kỳ buổi tập nào với huấn luyện viên cá nhân.',
    ],
  },
  {
    title: '2. Quy Trình Hoàn Tiền',
    items: [
      'Gửi yêu cầu hoàn tiền qua form trực tuyến hoặc liên hệ bộ phận CSKH.',
      'Đội ngũ hỗ trợ sẽ xử lý yêu cầu trong vòng 3-5 ngày làm việc.',
      'Số tiền hoàn sẽ được chuyển vào tài khoản gốc trong vòng 7-10 ngày.',
    ],
  },
  {
    title: '3. Phí Hoàn Tiền',
    items: [
      'Phí hoàn tiền là 10% giá trị gói tập còn lại.',
      'Phí xử lý hồ sơ là 50.000 VNĐ.',
      'Phí hoàn tiền sẽ được khấu trừ trực tiếp vào số tiền hoàn trả.',
      'Trong một số trường hợp đặc biệt, phí hoàn tiền có thể được miễn giảm.',
    ],
  },
  {
    title: '4. Trường Hợp Ngoại Lệ',
    items: [
      'Hoàn tiền do lý do sức khỏe (có giấy xác nhận của bác sĩ).',
      'Hoàn tiền khi trung tâm ngừng cung cấp dịch vụ.',
      'Các trường hợp bất khả kháng khác theo quy định của pháp luật.',
    ],
  },
  {
    title: '5. Liên Hệ Hỗ Trợ',
    items: [
      'Hotline: 1900 xxx xxx (8:00 - 22:00 hàng ngày)',
      'Email: support@gymsystem.vn',
    ],
  },
]

export default function RefundPolicyPage() {

  return (
    <MemberLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/deposit"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
        >
          &larr; {'Quay lại'}
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-[var(--theme-text)]">{'Chính Sách Hoàn Tiền'}</h1>
        <p className="mb-8 text-sm leading-6 text-[var(--theme-muted)]">{'Chính sách hoàn tiền của trung tâm thể hình.'}</p>

        <div className="space-y-6">
          {sections.map((section, idx) => (
            <div key={idx} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--theme-text)]">{section.title}</h2>
              <ul className="m-0 space-y-2 pl-5 text-sm leading-6 text-[var(--theme-text)]">
                {section.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </MemberLayout>
  )
}
