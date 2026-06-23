import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Select, Table, Tag, Typography, message } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useWallet } from '../../../context/WalletProvider'
import { createManualQrDeposit, createVnpayDeposit, getDepositPayments } from '../../../services/walletService'
import { PRESET_AMOUNTS } from '../../../types/member/wallet'

const { Text } = Typography

const DEPOSIT_BONUS_TIERS = [
  { threshold: 70000000, rate: 0.03 },
  { threshold: 15000000, rate: 0.02 },
]

type DepositPayment = {
  _id: string
  txnRef?: string
  amount: number
  status: 'PENDING' | 'PAID' | 'FAILED' | string
  method?: string
  paymentMethod?: string
  createdAt: string
  paidAt?: string | null
  metadata?: Record<string, any>
}

type PendingQrPayment = {
  type: 'vnpay' | 'manual'
  paymentId: string
  txnRef: string
  paymentUrl?: string
  manualUrl?: string
  qrDataUrl: string
  amount: number
  status: string
  method?: string
  note?: string
  qrLabel?: string
  expiresAt?: string
}

function formatVND(amount: number) {
  return new Intl.NumberFormat(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

function getDepositCredit(amount: number) {
  const bonusRate = DEPOSIT_BONUS_TIERS.find((tier) => amount >= tier.threshold)?.rate || 0
  const bonus = Math.round(amount * bonusRate)
  return { bonus, total: amount + bonus }
}

function normalizeStatus(status?: string) {
  return String(status || '').toUpperCase()
}

export default function DepositPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { wallet, refreshWallet } = useWallet()
  const [amount, setAmount] = useState(PRESET_AMOUNTS[1])
  const [customInput, setCustomInput] = useState('')
  const [payments, setPayments] = useState<DepositPayment[]>([])
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'PENDING' | 'PAID' | 'FAILED'>('all')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'manual'>('vnpay')
  const [pendingPayment, setPendingPayment] = useState<PendingQrPayment | null>(null)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const amountError = useMemo(() => {
    if (amount < 10000) return t('deposit.min_amount')
    if (amount > 100000000) return t('deposit.max_amount')
    return null
  }, [amount, t])

  const depositCredit = useMemo(() => getDepositCredit(amount), [amount])

  const filteredPayments = useMemo(() => {
    if (paymentFilter === 'all') return payments
    return payments.filter((payment) => normalizeStatus(payment.status) === paymentFilter)
  }, [paymentFilter, payments])

  const refreshPayments = () => {
    setHistoryLoading(true)
    return getDepositPayments()
      .then((res) => {
        const nextPayments = res.data.data || []
        setPayments(nextPayments)
        return nextPayments as DepositPayment[]
      })
      .catch(() => message.error('Không thể tải lịch sử nạp tiền'))
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => {
    refreshPayments()
  }, [])

  useEffect(() => {
    const method = searchParams.get('method')
    const txnRef = searchParams.get('txnRef')
    const amountParam = Number(searchParams.get('amount') || 0)
    if (method !== 'manual' || !txnRef) return

    setPaymentMethod('manual')
    if (amountParam > 0) setAmount(amountParam)

    getDepositPayments()
      .then((res) => {
        const nextPayments = res.data.data || []
        setPayments(nextPayments)
        const payment = nextPayments.find((item: DepositPayment) => item.txnRef === txnRef)
        if (payment) {
          setPendingPayment({
            type: 'manual',
            paymentId: payment._id,
            txnRef,
            qrDataUrl: payment.metadata?.qrDataUrl || '',
            manualUrl: payment.metadata?.manualUrl,
            amount: payment.amount,
            status: payment.status,
            method: payment.method || payment.paymentMethod || 'MANUAL_QR',
            note: 'Thông tin nạp đã được tự fill từ QR nội bộ. Đây là demo, không trừ tiền ngân hàng thật.',
          })
        }
      })
      .catch(() => {})
  }, [searchParams])

  useEffect(() => {
    if (!pendingPayment?.txnRef) return

    const intervalId = window.setInterval(() => {
      getDepositPayments()
        .then((res) => {
          const nextPayments = res.data.data || []
          setPayments(nextPayments)
          const current = nextPayments.find((payment: DepositPayment) => payment.txnRef === pendingPayment.txnRef)
          const status = normalizeStatus(current?.status)

          if (status === 'PAID') {
            message.success(pendingPayment.type === 'vnpay' ? 'Thanh toán demo thành công' : 'Nạp tiền demo thành công')
            setPendingPayment(null)
            refreshWallet()
          }

          if (status === 'FAILED') {
            message.error('Thanh toán VNPAY thất bại hoặc đã bị hủy')
            setPendingPayment(null)
          }
        })
        .catch(() => {})
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [pendingPayment?.txnRef, pendingPayment?.type, refreshWallet])

  useEffect(() => {
    const result = searchParams.get('payment')
    if (!result) return

    if (result === 'success') {
      message.success('Nạp tiền qua VNPAY thành công')
      refreshWallet()
    } else {
      message.error('Thanh toán VNPAY thất bại hoặc đã bị hủy')
    }

    refreshPayments()
    setSearchParams({}, { replace: true })
  }, [refreshWallet, searchParams, setSearchParams])

  const handlePresetClick = (val: number) => {
    setAmount(val)
    setCustomInput('')
  }

  const handleCustomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/\D/g, '')
    setCustomInput(raw)
    if (raw) setAmount(Number(raw))
  }

  const handlePayWithVnpay = async () => {
    if (amountError) return
    setLoading(true)
    try {
      const vnpayRes = await createVnpayDeposit({ amount })
      const vnpayPayment = vnpayRes.data?.data
      if (!vnpayPayment?.paymentUrl) throw new Error('Missing VNPAY payment URL')

      const manualRes = await createManualQrDeposit({ amount })
      const manualPayment = manualRes.data?.data
      if (!manualPayment?.qrDataUrl || !manualPayment?.manualUrl) throw new Error('Missing manual QR data')

      setPendingPayment({
        ...manualPayment,
        type: 'vnpay',
        paymentUrl: vnpayPayment.paymentUrl,
        method: 'VNPAY + MANUAL_QR',
        note: 'QR đang hiển thị là QR demo ngân hàng để mở form chuyển khoản mô phỏng. Nút VNPAY bên dưới vẫn mở trang thanh toán Sandbox.',
        qrLabel: 'QR demo ngân hàng',
      })
      refreshPayments()
      message.success('Đã tạo QR demo và link VNPAY')
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tạo giao dịch VNPAY')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateManualQr = async () => {
    if (amountError) return
    setLoading(true)
    try {
      const res = await createManualQrDeposit({ amount })
      const nextPayment = res.data?.data
      if (!nextPayment?.qrDataUrl) throw new Error('Missing manual QR data')
      setPendingPayment({ ...nextPayment, type: 'manual', qrLabel: 'QR demo ngân hàng' })
      refreshPayments()
      message.success('Đã tạo QR thủ công demo')
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tạo QR thủ công')
    } finally {
      setLoading(false)
    }
  }

  const renderStatus = (status: string) => {
    const normalized = normalizeStatus(status)
    const color = normalized === 'PAID' ? 'success' : normalized === 'FAILED' ? 'error' : 'processing'
    return <Tag color={color}>{normalized}</Tag>
  }

  const handleDownloadQr = () => {
    if (!pendingPayment?.qrDataUrl) return
    const link = document.createElement('a')
    link.href = pendingPayment.qrDataUrl
    link.download = `${pendingPayment.txnRef || 'gympro-qr'}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <MemberLayout>
      <div className="member-page">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[var(--theme-text)]">{t('deposit.title')}</h1>
            {wallet && (
              <p className="mt-1 text-sm text-[var(--theme-muted)]">
                {t('deposit.current_balance')}{' '}
                <span className="font-semibold text-[var(--theme-accent)]">{formatVND(wallet.balance)}</span>
              </p>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_0.9fr]">
            <Card>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--theme-elevated)] p-1">
                  <button
                    onClick={() => {
                      setPaymentMethod('vnpay')
                      setPendingPayment(null)
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      paymentMethod === 'vnpay'
                        ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]'
                        : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    VNPAY Sandbox
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('manual')
                      setPendingPayment(null)
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      paymentMethod === 'manual'
                        ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]'
                        : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    QR thủ công demo
                  </button>
                </div>

                <div className="space-y-3">
                  <Text className="block text-sm font-medium text-[var(--theme-text)]">{t('deposit.select_amount')}</Text>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PRESET_AMOUNTS.map((val) => (
                      <button
                        key={val}
                        onClick={() => handlePresetClick(val)}
                        className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-all ${
                          amount === val && !customInput
                            ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                            : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-muted)] hover:border-[var(--theme-accent-border)]'
                        }`}
                      >
                        {formatVND(val)}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customInput}
                      onChange={handleCustomChange}
                      placeholder={t('deposit.placeholder_custom')}
                      className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 py-2.5 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-placeholder)] outline-none transition-colors focus:border-[var(--theme-accent)]"
                    />
                    {customInput && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--theme-muted)]">
                        {formatVND(amount)}
                      </span>
                    )}
                  </div>
                  {amountError && <p className="text-xs text-[#ef4444]">{amountError}</p>}
                </div>

                <Button
                  type="primary"
                  size="large"
                  block
                  loading={loading}
                  disabled={!!amountError}
                  onClick={paymentMethod === 'vnpay' ? handlePayWithVnpay : handleCreateManualQr}
                  className="!h-11 !bg-[var(--theme-button-bg)] !text-[var(--theme-button-text)] !font-semibold !shadow-none hover:!bg-[var(--theme-accent-hover)]"
                >
                  {paymentMethod === 'vnpay' ? 'Tạo QR demo + link VNPAY' : 'Tạo QR thủ công demo'}
                </Button>
                {paymentMethod === 'manual' && (
                  <p className="rounded-lg border border-[var(--theme-accent-border)] bg-[var(--theme-accent-muted)] px-3 py-2 text-xs text-[var(--theme-accent)]">
                    QR thủ công là link nội bộ GymPro để tự fill thông tin nạp tiền, không phải QR ngân hàng và không trừ tiền thật.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              {pendingPayment ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-semibold text-[var(--theme-text)]">
                      {pendingPayment.qrLabel || (pendingPayment.type === 'vnpay' ? 'QR demo ngân hàng' : 'Quét QR thủ công demo')}
                    </p>
                    <p className="mt-1 text-xs text-[var(--theme-muted)]">
                      {pendingPayment.type === 'vnpay'
                        ? 'Quét QR để mở form ngân hàng mô phỏng đã fill sẵn. Nút VNPAY bên dưới vẫn mở trang Sandbox.'
                        : 'Quét bằng camera để mở form ngân hàng mô phỏng đã fill sẵn.'}
                    </p>
                  </div>
                  {pendingPayment.qrDataUrl && (
                    <div className="flex justify-center rounded-xl border border-[var(--theme-border)] bg-white p-4">
                      <img src={pendingPayment.qrDataUrl} alt={pendingPayment.type === 'vnpay' ? 'VNPAY QR' : 'Manual deposit QR'} className="h-64 w-64" />
                    </div>
                  )}
                  <div className="space-y-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--theme-muted)]">Mã giao dịch</span>
                      <span className="text-sm font-semibold text-[var(--theme-text)]">{pendingPayment.txnRef}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--theme-muted)]">{t('deposit.deposit_amount')}</span>
                      <span className="text-sm font-semibold text-[var(--theme-text)]">{formatVND(pendingPayment.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--theme-muted)]">{t('deposit.table_status')}</span>
                      {renderStatus(pendingPayment.status)}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--theme-muted)]">Phương thức</span>
                      <span className="text-sm font-semibold text-[var(--theme-text)]">
                        {pendingPayment.method || (pendingPayment.type === 'vnpay' ? 'VNPAY + MANUAL_QR' : 'MANUAL_QR')}
                      </span>
                    </div>
                  </div>
                  {pendingPayment.note && (
                    <p className="rounded-lg border border-[var(--theme-accent-border)] bg-[var(--theme-accent-muted)] px-3 py-2 text-xs text-[var(--theme-accent)]">
                      {pendingPayment.note}
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button onClick={handleDownloadQr}>
                      Tải mã QR
                    </Button>
                    <Button onClick={() => pendingPayment.manualUrl && window.open(pendingPayment.manualUrl, '_blank', 'noopener,noreferrer')}>
                      Mở ngân hàng demo
                    </Button>
                    {pendingPayment.paymentUrl && (
                      <Button onClick={() => pendingPayment.paymentUrl && window.open(pendingPayment.paymentUrl, '_blank', 'noopener,noreferrer')}>
                        Mở trang VNPAY
                      </Button>
                    )}
                    <Button onClick={() => setPendingPayment(null)}>
                      Tạo mã khác
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[var(--theme-muted)]">{t('deposit.deposit_amount')}</span>
                    <span className="text-base font-semibold text-[var(--theme-text)]">{formatVND(amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[var(--theme-muted)]">{t('deposit.bonus_amount')}</span>
                    <span className="text-base font-semibold text-[var(--theme-accent)]">+{formatVND(depositCredit.bonus)}</span>
                  </div>
                  <div className="border-t border-[var(--theme-border)] pt-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--theme-muted)]">{t('deposit.total_credit')}</span>
                      <span className="text-lg font-bold text-[var(--theme-accent)]">{formatVND(depositCredit.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-10">
            <Card
              title={t('deposit.transaction_history')}
              extra={(
                <Select
                  value={paymentFilter}
                  onChange={setPaymentFilter}
                  className="min-w-40"
                  options={[
                    { label: 'Tất cả', value: 'all' },
                    { label: 'PENDING', value: 'PENDING' },
                    { label: 'PAID', value: 'PAID' },
                    { label: 'FAILED', value: 'FAILED' },
                  ]}
                />
              )}
            >
              <Table
                rowKey="_id"
                loading={historyLoading}
                dataSource={filteredPayments}
                columns={[
                  { title: t('deposit.table_time'), dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => new Date(value).toLocaleString() },
                  { title: 'Mã giao dịch', dataIndex: 'txnRef', key: 'txnRef' },
                  {
                    title: t('deposit.table_amount'),
                    dataIndex: 'amount',
                    key: 'amount',
                    render: (value: number) => formatVND(value),
                  },
                  {
                    title: 'Phương thức',
                    key: 'method',
                    render: (_: unknown, record: DepositPayment) => record.method || record.paymentMethod || 'VNPAY',
                  },
                  { title: t('deposit.table_status'), dataIndex: 'status', key: 'status', render: renderStatus },
                ]}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 760 }}
              />
            </Card>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
