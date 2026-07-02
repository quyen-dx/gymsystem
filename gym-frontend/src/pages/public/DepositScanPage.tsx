import { Button, Card, Result, Skeleton, Tag } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getManualQrDepositInfo } from '../../services/walletService'

type ManualQrInfo = {
  txnRef: string
  amount: number
  status: string
  method: string
  createdAt: string
  scannedAt?: string | null
  scanCount?: number
  demoOnly?: boolean
}

function formatVND(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

export default function DepositScanPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const txnRef = searchParams.get('txnRef') || ''
  const error = searchParams.get('error')
  const [info, setInfo] = useState<ManualQrInfo | null>(null)
  const [loading, setLoading] = useState(Boolean(txnRef))
  const [loadError, setLoadError] = useState('')

  const depositUrl = useMemo(() => {
    if (!info) return '/deposit'
    return `/deposit?method=manual&txnRef=${encodeURIComponent(info.txnRef)}&amount=${encodeURIComponent(String(info.amount))}`
  }, [info])

  useEffect(() => {
    if (!txnRef || error) {
      setLoading(false)
      return
    }

    getManualQrDepositInfo(txnRef)
      .then((res) => setInfo(res.data.data))
      .catch((err) => setLoadError(err?.response?.data?.message || 'Không tìm thấy thông tin QR'))
      .finally(() => setLoading(false))
  }, [txnRef, error])

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)] px-4 py-10">
        <div className="mx-auto max-w-xl">
          <Card>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        </div>
      </div>
    )
  }

  if (error || loadError || !info) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)] px-4 py-10">
        <div className="mx-auto max-w-xl">
          <Result
            status="warning"
            title="Không mở được QR nạp tiền"
            subTitle={loadError || 'Mã QR không tồn tại hoặc đã hết hiệu lực.'}
            extra={<Button type="primary" onClick={() => navigate('/')}>Về GymPro</Button>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] px-4 py-10 text-[var(--theme-text)]">
      <div className="mx-auto max-w-xl">
        <Card>
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--theme-muted)]">GymPro QR</p>
              <h1 className="mt-2 text-2xl font-bold text-[var(--theme-text)]">Thông tin nạp tiền</h1>
              <p className="mt-1 text-sm text-[var(--theme-muted)]">
                QR nội bộ demo đã được mở. QR này không thực hiện giao dịch ngân hàng thật.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--theme-muted)]">Mã giao dịch</span>
                <span className="text-sm font-semibold text-[var(--theme-text)]">{info.txnRef}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--theme-muted)]">Số tiền</span>
                <span className="text-base font-bold text-[var(--theme-accent)]">{formatVND(info.amount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--theme-muted)]">Trạng thái</span>
                <Tag color={info.status === 'PAID' ? 'success' : info.status === 'FAILED' ? 'error' : 'processing'}>{info.status}</Tag>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--theme-muted)]">Đã quét</span>
                <span className="text-sm font-semibold text-[var(--theme-text)]">{info.scannedAt ? new Date(info.scannedAt).toLocaleString() : 'Vừa mở'}</span>
              </div>
            </div>

            {user ? (
              <Button type="primary" size="large" block onClick={() => navigate(depositUrl)}>
                Mở trong tài khoản GymPro
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-elevated)] px-3 py-2 text-sm text-[var(--theme-muted)]">
                  Trình duyệt này chưa đăng nhập GymPro. Đăng nhập xong bạn có thể mở lại thông tin nạp tiền.
                </p>
                <Link to={`/login?redirect=${encodeURIComponent(depositUrl)}`}>
                  <Button type="primary" size="large" block>
                    Đăng nhập GymPro
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
