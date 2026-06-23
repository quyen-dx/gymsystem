import { Button, Card, Result, Skeleton, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { getManualQrDepositInfo, simulateManualQrPayment } from '../../services/walletService'

type ManualQrInfo = {
  txnRef: string
  amount: number
  status: string
  method: string
  scannedAt?: string | null
  scanCount?: number
}

function formatVND(amount: number) {
  return new Intl.NumberFormat(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

export default function BankTransferDemoPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const txnRef = searchParams.get('txnRef') || ''
  const error = searchParams.get('error')
  const [info, setInfo] = useState<ManualQrInfo | null>(null)
  const [loading, setLoading] = useState(Boolean(txnRef))
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!txnRef || error) {
      setLoading(false)
      return
    }

    getManualQrDepositInfo(txnRef)
      .then((res) => {
        setInfo(res.data.data)
        setPaid(res.data.data?.status === 'PAID')
      })
      .catch((err) => setLoadError(err?.response?.data?.message || 'Không tìm thấy giao dịch demo'))
      .finally(() => setLoading(false))
  }, [txnRef, error])

  const handleDemoPay = async () => {
    if (!info?.txnRef) return
    setPaying(true)
    try {
      const res = await simulateManualQrPayment(info.txnRef)
      setPaid(true)
      setInfo((current) => current ? { ...current, status: 'PAID' } : current)
      message.success(`Thanh toán demo thành công. Ví nhận ${formatVND(res.data?.data?.creditedAmount || info.amount)}.`)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể xác nhận thanh toán demo')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f6f4] px-4 py-6">
        <div className="mx-auto max-w-md">
          <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
        </div>
      </div>
    )
  }

  if (error || loadError || !info) {
    return (
      <div className="min-h-screen bg-[#f2f6f4] px-4 py-6">
        <div className="mx-auto max-w-md">
          <Result
            status="warning"
            title="Không mở được giao dịch demo"
            subTitle={loadError || 'Mã giao dịch không tồn tại.'}
            extra={<Button type="primary" onClick={() => navigate('/')}>Về GymPro</Button>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#eef5f2] px-4 py-6 text-[#10251f]">
      <div className="mx-auto max-w-md">
        <div className="mb-4 rounded-2xl bg-[#007a3d] px-5 py-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">DEMO BANK</p>
              <h1 className="mt-1 text-xl font-bold">Chuyển khoản</h1>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">MÔ PHỎNG</span>
          </div>
        </div>

        <Card className="!rounded-2xl !border-0 !bg-white !text-[#10251f] shadow-md">
          <div className="space-y-5">
            <div className="rounded-xl border border-[#d7e6df] bg-[#f8fbfa] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#587067]">Tài khoản nguồn</p>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#10251f]">NGUYEN VAN A</p>
                  <p className="text-sm text-[#6b7f77]">**** 2486</p>
                </div>
                <Tag color="green">DEMO</Tag>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-[#6b7f77]">Ngân hàng nhận</p>
                <div className="mt-1 rounded-xl border border-[#d7e6df] bg-white px-4 py-3 font-semibold text-[#10251f]">NCB</div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7f77]">Số thẻ</p>
                <div className="mt-1 rounded-xl border border-[#d7e6df] bg-white px-4 py-3 font-semibold text-[#10251f]">9704198526191432198</div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7f77]">Tên chủ thẻ</p>
                <div className="mt-1 rounded-xl border border-[#d7e6df] bg-white px-4 py-3 font-semibold text-[#10251f]">NGUYEN VAN A</div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7f77]">Số tiền</p>
                <div className="mt-1 rounded-xl border border-[#d7e6df] bg-white px-4 py-3 text-xl font-bold text-[#007a3d]">{formatVND(info.amount)}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7f77]">Nội dung chuyển khoản</p>
                <div className="mt-1 rounded-xl border border-[#d7e6df] bg-white px-4 py-3 font-semibold text-[#10251f]">{info.txnRef}</div>
              </div>
            </div>

            <div className="rounded-xl border border-[#f1d18a] bg-[#fff8e6] px-4 py-3 text-xs text-[#7a5a10]">
              Đây là giao diện mô phỏng để demo luồng QR. Không kết nối ngân hàng thật và không tạo giao dịch tiền thật.
            </div>

            {paid || info.status === 'PAID' ? (
              <div className="space-y-3">
                <Result status="success" title="Thanh toán demo thành công" subTitle="GymPro đã cộng tiền vào ví demo." />
                <Button type="primary" block size="large" onClick={() => navigate(`/deposit?payment=success&txnRef=${encodeURIComponent(info.txnRef)}`)}>
                  Quay về ví GymPro
                </Button>
              </div>
            ) : (
              <Button type="primary" block size="large" loading={paying} onClick={handleDemoPay} className="!h-12 !bg-[#007a3d]">
                Xác nhận chuyển khoản demo
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
