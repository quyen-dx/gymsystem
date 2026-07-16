import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'

type Props = {
  planName?: string | null
  featureLabel: string
}

export default function MembershipRequired({ planName, featureLabel }: Props) {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-2xl rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--gs-primary)]">
        {planName ? 'GÓI TẬP KHÔNG PHÙ HỢP' : 'CẦN GÓI TẬP'}
      </p>
      <h1 className="mt-3 text-2xl font-bold text-[var(--gs-text)]">
        {planName
          ? `Gói "${planName}" không bao gồm quyền lợi này`
          : `Bạn cần có gói tập để ${featureLabel}`}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--gs-text-muted)]">
        {planName
          ? `Vui lòng chọn gói tập có quyền lợi phù hợp để ${featureLabel}`
          : `Vui lòng đăng ký gói tập để sử dụng tính năng ${featureLabel}`}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button type="primary" onClick={() => navigate('/plans')}>Xem gói tập</Button>
        <Button onClick={() => navigate('/my-membership')}>Gói của tôi</Button>
      </div>
    </div>
  )
}