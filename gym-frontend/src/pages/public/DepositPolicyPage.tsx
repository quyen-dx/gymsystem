import { Link } from 'react-router-dom'
import MemberLayout from '../../components/layout/header/MemberLayout'

const sections = [
  {
    title: '1. Điều Kiện Đặt Cọc',
    items: [
      'Khách hàng có thể đặt cọc để giữ chỗ đăng ký gói tập.',
      'Số tiền đặt cọc tối thiểu là 20% giá trị gói tập.',
      'Thời gian giữ chỗ tối đa là 30 ngày kể từ ngày đặt cọc.',
    ],
  },
  {
    title: '2. Quy Trình Đặt Cọc',
    desc: 'Quy trình đặt cọc bao gồm các bước sau:',
    items: [
      'Chọn gói tập mong muốn và tiến hành đặt cọc.',
      'Hệ thống sẽ gửi xác nhận qua email và SMS.',
      'Đến trung tâm để hoàn tất thủ tục đăng ký.',
    ],
  },
  {
    title: '3. Chính Sách Hủy Cọc',
    desc: 'Khách hàng có quyền hủy cọc trong các trường hợp:',
    items: [
      'Hủy cọc trong vòng 7 ngày: được hoàn lại 100% tiền cọc.',
      'Hủy cọc sau 7 ngày: được hoàn lại 70% tiền cọc.',
      'Hủy cọc do lý do sức khỏe: hoàn lại 100% tiền cọc (có giấy tờ y tế).',
    ],
  },
  {
    title: '4. Chuyển Nhượng Cọc',
    desc: 'Khách hàng có thể chuyển nhượng cọc cho người khác:',
    items: [
      'Được chuyển nhượng miễn phí nếu thông báo trước 3 ngày.',
      'Người nhận chuyển nhượng phải đáp ứng điều kiện đăng ký gói tập.',
      'Chuyển nhượng chỉ được thực hiện một lần cho mỗi cọc.',
    ],
  },
  {
    title: '5. Liên Hệ Hỗ Trợ',
    desc: 'Mọi thắc mắc về chính sách đặt cọc, vui lòng liên hệ:',
    items: [
      'Hotline: 1900 xxx xxx (8:00 - 22:00 hàng ngày)',
      'Email: support@gymsystem.vn',
      'Địa chỉ: Tầng 1, Tòa nhà ABC, 123 Đường XYZ, Quận 1, TP. Hồ Chí Minh',
    ],
  },
]

export default function DepositPolicyPage() {

  return (
    <MemberLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/deposit"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
        >
          &larr; {'Quay lại'}
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-[var(--theme-text)]">{'Chính Sách Đặt Cọc'}</h1>
        <p className="mb-8 text-sm leading-6 text-[var(--theme-muted)]">{'Chính sách đặt cọc của trung tâm thể hình.'}</p>

        <div className="space-y-6">
          {sections.map((section, idx) => (
            <div key={idx} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--theme-text)]">{section.title}</h2>
              {section.desc && (
                <p className="mb-3 text-sm leading-6 text-[var(--theme-text)]">{section.desc}</p>
              )}
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
