import { Button, Card, Result, Skeleton, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { memberService } from '../../services/memberService'

type PaymentInfo = {
  paymentId: string
  status: string
  amount: number
  bankInfo: {
    bankName: string
    accountName: string
    accountNumber: string
  }
  transferContent: string
}

const formatVND = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

export default function BankTransferPage() {
  const { paymentId = '' } = useParams()
  const navigate = useNavigate()
  const [info, setInfo] = useState<PaymentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    memberService.getOfflinePlanPayment(paymentId)
      .then((res) => setInfo(res.data?.data))
      .catch((err) => setError(err?.response?.data?.message || 'Không tìm thấy giao dịch'))
      .finally(() => setLoading(false))
  }, [paymentId])

  const handleConfirm = async () => {
    if (!paymentId) return
    setConfirming(true)
    try {
      const res = await memberService.confirmOfflinePlanPayment(paymentId)
      setInfo((current) => current ? { ...current, status: res.data?.data?.status || 'PAID' } : current)
      message.success('Đã xác nhận chuyển khoản')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể xác nhận chuyển khoản')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef5f2] px-4 py-6">
        <div className="mx-auto max-w-md"><Card><Skeleton active paragraph={{ rows: 8 }} /></Card></div>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-[#eef5f2] px-4 py-6">
        <div className="mx-auto max-w-md">
          <Result status="warning" title="Không mở được giao dịch" subTitle={error} extra={<Button onClick={() => navigate('/')}>Về GymPro</Button>} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#eef5f2] px-4 py-6 text-[#10251f]">
      <div className="mx-auto max-w-md">
        <div className="mb-4 rounded-lg bg-[#007a3d] px-5 py-4 text-white shadow">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">GymPro</p>
          <h1 className="mt-1 text-xl font-bold">Xác nhận chuyển khoản</h1>
        </div>

        <Card className="!rounded-lg !border-0 !bg-white shadow">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-[#6b7f77]">Tên ngân hàng</p>
              <div className="mt-1 rounded-lg border border-[#d7e6df] px-4 py-3 font-semibold">{info.bankInfo.bankName}</div>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6b7f77]">Chủ tài khoản</p>
              <div className="mt-1 rounded-lg border border-[#d7e6df] px-4 py-3 font-semibold">{info.bankInfo.accountName}</div>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6b7f77]">Số tài khoản</p>
              <div className="mt-1 rounded-lg border border-[#d7e6df] px-4 py-3 font-semibold">{info.bankInfo.accountNumber}</div>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6b7f77]">Số tiền</p>
              <div className="mt-1 rounded-lg border border-[#d7e6df] px-4 py-3 text-xl font-bold text-[#007a3d]">{formatVND(info.amount)}</div>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6b7f77]">Nội dung chuyển khoản</p>
              <div className="mt-1 rounded-lg border border-[#d7e6df] px-4 py-3 font-semibold">{info.transferContent}</div>
            </div>

            <div className="rounded-lg border border-[#f1d18a] bg-[#fff8e6] px-4 py-3 text-xs text-[#7a5a10]">
              Sau khi đã chuyển khoản, bấm xác nhận để nhân viên kích hoạt hoặc gia hạn gói tại quầy.
            </div>

            {info.status === 'PAID' ? (
              <Result status="success" title="Đã xác nhận chuyển khoản" subTitle={<Tag color="success">PAID</Tag>} />
            ) : (
              <Button type="primary" block size="large" loading={confirming} onClick={handleConfirm} className="!h-12 !bg-[#007a3d]">
                Xác nhận chuyển khoản
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
