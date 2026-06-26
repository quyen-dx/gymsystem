import { Button, Card, Result, Skeleton, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { getManualQrDepositInfo, simulateManualQrPayment } from '../../services/walletService'
import BankTransferSimulator, { SIMULATED_BANK_ACCOUNT } from './BankTransferSimulator'

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
      .catch((err) => setLoadError(err?.response?.data?.message || 'Không tìm thấy giao dịch'))
      .finally(() => setLoading(false))
  }, [txnRef, error])

  const handleDemoPay = async () => {
    if (!info?.txnRef) return
    setPaying(true)
    try {
      const res = await simulateManualQrPayment(info.txnRef)
      setPaid(true)
      setInfo((current) => current ? { ...current, status: 'PAID' } : current)
      message.success(`Thanh toán thành công. Ví nhận ${formatVND(res.data?.data?.creditedAmount || info.amount)}.`)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể xác nhận thanh toán')
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
            title="Không mở được giao dịch"
            subTitle={loadError || 'Mã giao dịch không tồn tại.'}
            extra={<Button type="primary" onClick={() => navigate('/')}>Về GymPro</Button>}
          />
        </div>
      </div>
    )
  }

  return (
    <BankTransferSimulator
      amount={info.amount}
      transferContent={info.txnRef}
      status={paid ? 'PAID' : info.status}
      confirming={paying}
      recipientBankName={SIMULATED_BANK_ACCOUNT.bankName}
      recipientAccountName={SIMULATED_BANK_ACCOUNT.accountName}
      recipientAccountNumber={SIMULATED_BANK_ACCOUNT.accountNumber}
      warningText="Đây là trang xác nhận thanh toán nội bộ của GymPro, không phải ứng dụng ngân hàng NCB."
      successTitle="Thanh toán thành công"
      successSubtitle="GymPro đã cập nhật số dư ví."
      onConfirm={handleDemoPay}
    />
  )
}
