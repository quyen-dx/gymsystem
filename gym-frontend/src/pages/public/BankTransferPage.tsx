import { Button, Card, Result, Skeleton, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { memberService } from '../../services/memberService'
import BankTransferSimulator, { SIMULATED_BANK_ACCOUNT } from './BankTransferSimulator'

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
    <BankTransferSimulator
      amount={info.amount}
      transferContent={info.transferContent}
      status={info.status}
      confirming={confirming}
      recipientBankName={SIMULATED_BANK_ACCOUNT.bankName}
      recipientAccountName={SIMULATED_BANK_ACCOUNT.accountName}
      recipientAccountNumber={SIMULATED_BANK_ACCOUNT.accountNumber}
      warningText="Sau khi đã chuyển khoản, bấm xác nhận để nhân viên kích hoạt hoặc gia hạn gói tại quầy."
      successTitle="Đã xác nhận chuyển khoản"
      successSubtitle={<Tag color="success">PAID</Tag>}
      onConfirm={handleConfirm}
    />
  )
}
