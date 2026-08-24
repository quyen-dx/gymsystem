import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Grid, Modal, Select, Table, Tag, Tooltip, Typography, message } from 'antd'
import { CardCvcElement, CardExpiryElement, CardNumberElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useWallet } from '../../../context/WalletProvider'
import { confirmStripeCardPayment, createStripePaymentIntent, createVnpayDeposit, getDepositPayments, getStripeExchangeRate } from '../../../services/walletService'
import PolicyConsentCard from '../../../components/wallet/PolicyConsentCard'
import { acceptMultiplePolicyConsent } from '../../../utils/policyConsent'
import { PRESET_AMOUNTS } from '../../../types/member/wallet'

const { Text } = Typography
const { useBreakpoint } = Grid
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

const DEPOSIT_BONUS_TIERS = [
  { threshold: 70000000, rate: 0.03 },
  { threshold: 15000000, rate: 0.02 },
]
const USD_PRESET_AMOUNTS = [5, 10, 20, 50]
const FALLBACK_USD_TO_VND_RATE = 25000
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
  planId?: { _id?: string; nameVi?: string; nameEn?: string; durationDays?: number } | string | null
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
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function getTransactionType(payment: DepositPayment) {
  const purpose = payment.metadata?.purpose
  if (purpose === 'PLAN_PURCHASE') return 'Thanh toán gói tập'
  if (purpose === 'PT_BOOKING_PAYMENT') return 'Thanh toán lịch PT'
  return 'Nạp tiền vào ví'
}

function getChargedAmount(payment: DepositPayment) {
  const remainingAmount = Number(payment.metadata?.remainingAmount)
  return Number.isFinite(remainingAmount) && remainingAmount > 0
    ? remainingAmount
    : Number(payment.amount || 0)
}

function getPaymentMethodInfo(payment: DepositPayment) {
  const purpose = payment.metadata?.purpose
  const walletUsed = Number(payment.metadata?.walletUsed || 0)
  const vnpayAmount = Number(payment.metadata?.remainingAmount || 0)
  const method = String(payment.method || payment.paymentMethod || '').toUpperCase()

  if (purpose !== 'WALLET_DEPOSIT' && walletUsed > 0 && vnpayAmount > 0) {
    return {
      label: 'Ví GymPro + VNPay',
      detail: `Ví ${formatVND(walletUsed)} · VNPay ${formatVND(vnpayAmount)}`,
    }
  }
  if (method === 'WALLET' || (purpose === 'PLAN_PURCHASE' && walletUsed > 0)) {
    return { label: 'Ví GymPro' }
  }
  if (method === 'STRIPE') return { label: 'Thẻ quốc tế' }
  return { label: formatMethod(method) }
}

function getDepositCredit(amount: number) {
  const bonusRate = DEPOSIT_BONUS_TIERS.find((tier) => amount >= tier.threshold)?.rate || 0
  const bonus = Math.round(amount * bonusRate)
  return { bonus, total: amount + bonus }
}

function normalizeStatus(status?: string) {
  return String(status || '').toUpperCase()
}

function formatMethod(method?: string) {
  const m = String(method || '').toUpperCase()
  if (m === 'VNPAY') return 'VNPay'
  if (m === 'INTERNATIONAL_CARD') return 'Thẻ quốc tế'
  if (m === 'MANUAL_QR') return 'Chuyển khoản'
  return m || 'VNPay'
}

function StripeCardDepositForm({
  amount,
  amountUsd,
  amountError,
  displayAmount,
  disabled = false,
  exchangeRate,
  onPaid,
  onBeforePay,
}: {
  amount: number
  amountUsd?: number
  amountError: string | null
  displayAmount: string
  disabled?: boolean
  exchangeRate?: number | null
  onPaid: () => void
  onBeforePay?: () => Promise<void>
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)

  const handlePay = async () => {
    if (!stripe || !elements || amountError || disabled) return

    const cardElement = elements.getElement(CardNumberElement)
    if (!cardElement) return

    setPaying(true)
    try {
      if (onBeforePay) await onBeforePay()
      const res = await createStripePaymentIntent(amountUsd ? { amountUsd } : { amount })
      const clientSecret = res.data.clientSecret
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      })

      if (result.error) {
        message.error(result.error.message || 'Thanh toán thất bại')
        return
      }

      if (result.paymentIntent?.status !== 'succeeded') {
        message.error('Thanh toán chưa hoàn tất, vui lòng thử lại')
        return
      }

      await confirmStripeCardPayment(result.paymentIntent.id)
      message.success('Thanh toán thành công')
      onPaid()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Xử lý thanh toán thất bại')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="space-y-4">
      {!stripePublishableKey && (
        <p className="rounded-lg border border-[#ef444433] bg-[#ef44440f] px-3 py-2 text-xs text-[#ef4444]">
          {'Thiếu khóa cấu hình thanh toán thẻ'}
        </p>
      )}
      <div className="space-y-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--theme-text)]">Số thẻ</span>
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 py-3">
            <CardNumberElement
              options={{
                showIcon: true,
                placeholder: '4242 4242 4242 4242',
                style: {
                  base: {
                    color: '#ffffff',
                    fontSize: '14px',
                    '::placeholder': { color: '#8b949e' },
                  },
                  invalid: { color: '#ef4444' },
                },
              }}
            />
          </div>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--theme-text)]">Ngày hết hạn</span>
            <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 py-3">
              <CardExpiryElement
                options={{
                  placeholder: '12/34',
                  style: {
                    base: {
                      color: '#ffffff',
                      fontSize: '14px',
                      '::placeholder': { color: '#8b949e' },
                    },
                    invalid: { color: '#ef4444' },
                  },
                }}
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--theme-text)]">Mã bảo mật</span>
            <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 py-3">
              <CardCvcElement
                options={{
                  placeholder: '123',
                  style: {
                    base: {
                      color: '#ffffff',
                      fontSize: '14px',
                      '::placeholder': { color: '#8b949e' },
                    },
                    invalid: { color: '#ef4444' },
                  },
                }}
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--theme-text)]">Mã bưu điện</span>
            <input
              value="10000"
              readOnly
              className="h-[46px] w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 text-sm text-[var(--theme-text)] outline-none"
            />
          </label>
        </div>
      </div>
      {exchangeRate && (
        <p className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-elevated)] px-3 py-2 text-xs text-[var(--theme-muted)]">
          {'Tỷ giá: 1 USD = ' + Math.round(exchangeRate).toLocaleString('vi-VN') + ' VND'}
        </p>
      )}
      <Button
        type="primary"
        size="large"
        block
        loading={paying}
        disabled={!stripe || !!amountError || disabled}
        onClick={handlePay}
        className="!h-11 !bg-[var(--theme-button-bg)] !text-[var(--theme-button-text)] !font-semibold !shadow-none hover:!bg-[var(--theme-accent-hover)]"
      >
        {'Thanh toán ' + displayAmount}
      </Button>
    </div>
  )
}

export default function DepositPage() {
  const screens = useBreakpoint()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { wallet, refreshWallet } = useWallet()
  const [amount, setAmount] = useState(PRESET_AMOUNTS[1])
  const [customInput, setCustomInput] = useState('')
  const [cardUsdAmount, setCardUsdAmount] = useState(10)
  const [customUsdInput, setCustomUsdInput] = useState('')
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [payments, setPayments] = useState<DepositPayment[]>([])
  const [selectedPayment, setSelectedPayment] = useState<DepositPayment | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'PENDING' | 'PAID' | 'FAILED'>('all')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'card'>('vnpay')
  const [pendingPayment, setPendingPayment] = useState<PendingQrPayment | null>(null)
  const notifiedFromUrl = useRef(false)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [tickedPolicies, setTickedPolicies] = useState<Record<string, { type: string; version: string }> | null>(null)
  const [consentSubmitted, setConsentSubmitted] = useState(false)
  const consentReady = tickedPolicies !== null && Object.keys(tickedPolicies).length > 0
  const showMobileQrActions = !screens.md

  const cardUsesUsd = paymentMethod === 'card'
  const effectiveAmount = useMemo(() => {
    if (!cardUsesUsd) return amount
    return Math.round(cardUsdAmount * (exchangeRate || FALLBACK_USD_TO_VND_RATE))
  }, [amount, cardUsesUsd, cardUsdAmount, exchangeRate])

  const amountError = useMemo(() => {
    if (cardUsesUsd && cardUsdAmount < 0.5) return 'Số tiền tối thiểu là 0.5 USD'
    if (effectiveAmount < 10000) return 'Số tiền tối thiểu là 10.000đ'
    if (effectiveAmount > 100000000) return 'Số tiền tối đa là 100.000.000đ'
    return null
  }, [cardUsesUsd, cardUsdAmount, effectiveAmount])

  const depositCredit = useMemo(() => getDepositCredit(effectiveAmount), [effectiveAmount])

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
      .catch(() => message.error('Không thể tải lịch sử giao dịch'))
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => {
    refreshPayments()
  }, [])

  useEffect(() => {
    getStripeExchangeRate()
      .then((res) => setExchangeRate(Number(res.data?.data?.rate) || FALLBACK_USD_TO_VND_RATE))
      .catch(() => setExchangeRate(FALLBACK_USD_TO_VND_RATE))
  }, [])

  useEffect(() => {
    const method = searchParams.get('method')
    const txnRef = searchParams.get('txnRef')
    const amountParam = Number(searchParams.get('amount') || 0)
    if (method !== 'manual' || !txnRef) return

    setPaymentMethod('vnpay')
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
            note: 'Vui lòng chuyển khoản đúng nội dung để hệ thống tự động cập nhật',
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
            if (!notifiedFromUrl.current) {
              message.success('Nạp tiền thành công')
            }
            setPendingPayment(null)
            refreshWallet()
          }

          if (status === 'FAILED') {
            if (!notifiedFromUrl.current) {
              message.error('Nạp tiền thất bại')
            }
            setPendingPayment(null)
          }
        })
        .catch(() => {})
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [pendingPayment?.txnRef, pendingPayment?.type, refreshWallet])

  const processedPaymentRef = useRef<string | null>(null)

  useEffect(() => {
    const result = searchParams.get('payment')
    const txnRef = searchParams.get('txnRef')
    if (!result) return
    if (processedPaymentRef.current === result) return
    processedPaymentRef.current = result

    if (result === 'success') {
      message.success('Nạp tiền VNPAY thành công')
      refreshWallet()
    } else {
      message.error('Nạp tiền VNPAY thất bại')
    }

    notifiedFromUrl.current = true

    if (txnRef) {
      getDepositPayments()
        .then((res) => {
          const data = res.data.data || []
          setPayments(data)
          const payment = data.find((p: DepositPayment) => p.txnRef === txnRef)
          if (payment) {
            setPendingPayment({
              type: 'vnpay',
              paymentId: payment._id,
              txnRef,
              qrDataUrl: '',
              amount: payment.amount,
              status: payment.status,
              method: 'VNPAY',
            })
          }
        })
        .catch(() => {})
    }

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

  const handleUsdPresetClick = (val: number) => {
    setCardUsdAmount(val)
    setCustomUsdInput('')
  }

  const handleUsdCustomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/[^\d.]/g, '')
    const normalized = raw.replace(/(\..*)\./g, '$1')
    setCustomUsdInput(normalized)
    if (normalized) setCardUsdAmount(Number(normalized))
  }

  const handlePayWithVnpay = async () => {
    if (!consentReady || amountError) return
    notifiedFromUrl.current = false
    setLoading(true)
    try {
      if (!consentSubmitted) {
        await acceptMultiplePolicyConsent(
          Object.values(tickedPolicies!).map((p) => ({
            policyType: p.type,
            policyVersion: p.version,
            context: 'deposit',
          })),
        )
        setConsentSubmitted(true)
      }
      const res = await createVnpayDeposit({ amount: effectiveAmount })
      const data = res.data?.data
      if (!data?.paymentUrl) throw new Error('Missing VNPAY payment URL')

      setPendingPayment({
        paymentId: data.paymentId,
        txnRef: data.txnRef,
        amount: data.amount,
        status: data.status,
        type: 'vnpay',
        method: 'VNPAY',
        paymentUrl: data.paymentUrl,
        qrDataUrl: data.qrDataUrl || '',
        qrLabel: 'Mã QR nạp tiền',
      })
      refreshPayments()
      message.success('Mã QR đã được tạo')
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Tạo mã QR thất bại')
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

  const handleOpenVnpayPage = async () => {
    if (!consentReady || amountError) return

    // Nếu đã có paymentUrl từ lần tạo QR trước thì dùng luôn, không tạo mới
    if (pendingPayment?.paymentUrl) {
      window.location.href = pendingPayment.paymentUrl
      return
    }

    const targetAmount = pendingPayment?.amount || effectiveAmount
    if (!targetAmount) return
    notifiedFromUrl.current = false
    setLoading(true)
    try {
      if (!consentSubmitted) {
        await acceptMultiplePolicyConsent(
          Object.values(tickedPolicies!).map((p) => ({
            policyType: p.type,
            policyVersion: p.version,
            context: 'deposit',
          })),
        )
        setConsentSubmitted(true)
      }
      const res = await createVnpayDeposit({ amount: targetAmount })
      const data = res.data?.data
      if (!data?.paymentUrl) throw new Error('Missing VNPAY payment URL')

      setPendingPayment({
        paymentId: data.paymentId,
        txnRef: data.txnRef,
        amount: data.amount,
        status: data.status,
        type: 'vnpay',
        method: 'VNPAY',
        paymentUrl: data.paymentUrl,
        qrDataUrl: data.qrDataUrl || '',
        qrLabel: '',
      })

      window.location.href = data.paymentUrl
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Mở VNPAY thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MemberLayout>
      <div className="member-page">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[var(--theme-text)]">Nạp tiền</h1>
              {wallet && (
                <p className="mt-1 text-sm text-[var(--theme-muted)]">
                  {'Số dư hiện tại: '}
                  <span className="font-semibold text-[var(--theme-accent)]">{formatVND(wallet.balance)}</span>
                </p>
              )}
            </div>
            <Button onClick={() => navigate('/payouts')}>Rút tiền</Button>
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_0.9fr]">
            <Card>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--theme-elevated)] p-1">
                  <button
                    onClick={() => {
                      setPaymentMethod('vnpay')
                      setPendingPayment(null)
                      setConsentSubmitted(false)
                      setTickedPolicies(null)
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      paymentMethod === 'vnpay'
                        ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]'
                        : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    Chuyển khoản
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('card')
                      setPendingPayment(null)
                      setConsentSubmitted(false)
                      setTickedPolicies(null)
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      paymentMethod === 'card'
                        ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]'
                        : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    Thẻ quốc tế
                  </button>
                </div>

                <div className="space-y-3">
                  <Text className="block text-sm font-medium text-[var(--theme-text)]">
                    {cardUsesUsd ? 'Chọn số tiền (USD)' : 'Chọn số tiền nạp'}
                  </Text>
                  {cardUsesUsd ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {USD_PRESET_AMOUNTS.map((val) => (
                          <button
                            key={val}
                            onClick={() => handleUsdPresetClick(val)}
                            className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-all ${
                              cardUsdAmount === val && !customUsdInput
                                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                                : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-muted)] hover:border-[var(--theme-accent-border)]'
                            }`}
                          >
                            {formatUSD(val)}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={customUsdInput}
                          onChange={handleUsdCustomChange}
                          placeholder={'Nhập số tiền USD...'}
                          className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 py-2.5 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-placeholder)] outline-none transition-colors focus:border-[var(--theme-accent)]"
                        />
                        {customUsdInput && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--theme-muted)]">
                            {formatUSD(cardUsdAmount)}
                          </span>
                        )}
                      </div>
                      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-3 text-xs text-[var(--theme-muted)]">
                        {exchangeRate
                          ? formatUSD(cardUsdAmount) + ' = ' + formatVND(effectiveAmount) + ' (Tỷ giá: 1 USD = ' + Math.round(exchangeRate).toLocaleString('vi-VN') + ' VND)'
                          : 'Đang tải tỷ giá...'}
                      </div>
                    </>
                  ) : (
                    <>
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
                          placeholder={'Nhập số tiền khác...'}
                          className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 py-2.5 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-placeholder)] outline-none transition-colors focus:border-[var(--theme-accent)]"
                        />
                        {customInput && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--theme-muted)]">
                            {formatVND(amount)}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  {amountError && <p className="text-xs text-[#ef4444]">{amountError}</p>}
                </div>

                <PolicyConsentCard
                  policies={[
                    { type: 'payment', label: 'Chính sách thanh toán' },
                    { type: 'refund', label: 'Chính sách hoàn tiền' },
                  ]}
                  context="deposit"
                  onTickedChange={(ticked) => {
                    setTickedPolicies(Object.keys(ticked).length > 0 ? ticked : null)
                  }}
                />

                {paymentMethod === 'vnpay' ? (
                  <Tooltip title={!consentReady ? 'Vui lòng đồng ý với chính sách trước khi nạp tiền' : undefined}>
                    <Button
                      type="primary"
                      size="large"
                      block
                      loading={loading}
                      disabled={!consentReady || !!amountError}
                      onClick={handlePayWithVnpay}
                      className="h-11 bg-[var(--theme-button-bg)] text-[var(--theme-button-text)] font-semibold shadow-none hover:bg-[var(--theme-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Tạo mã QR
                    </Button>
                  </Tooltip>
                ) : (
                  <Elements stripe={stripePromise}>
                    <StripeCardDepositForm
                      amount={effectiveAmount}
                      amountUsd={cardUsdAmount}
                      amountError={amountError}
                      disabled={!consentReady}
                      displayAmount={cardUsesUsd ? formatUSD(cardUsdAmount) : formatVND(effectiveAmount)}
                      exchangeRate={cardUsesUsd ? exchangeRate : null}
                      onBeforePay={async () => {
                        if (!consentSubmitted) {
                          await acceptMultiplePolicyConsent(
                            Object.values(tickedPolicies!).map((p) => ({
                              policyType: p.type,
                              policyVersion: p.version,
                              context: 'deposit',
                            })),
                          )
                          setConsentSubmitted(true)
                        }
                      }}
                      onPaid={() => {
                        refreshWallet()
                        refreshPayments()
                        window.setTimeout(() => {
                          refreshWallet()
                          refreshPayments()
                        }, 3000)
                      }}
                    />
                  </Elements>
                )}
              </div>
            </Card>

            <Card>
              {pendingPayment ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-semibold text-[var(--theme-text)]">
                      {pendingPayment.qrLabel || 'Mã QR nạp tiền'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--theme-muted)]">
                      {pendingPayment.type === 'vnpay'
                        ? 'Quét mã QR bằng ứng dụng ngân hàng để thanh toán'
                        : 'Quét mã QR để chuyển khoản ngân hàng'}
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
                      <span className="text-sm text-[var(--theme-muted)]">Số tiền nạp</span>
                      <span className="text-sm font-semibold text-[var(--theme-text)]">{formatVND(pendingPayment.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--theme-muted)]">Trạng thái</span>
                      {renderStatus(pendingPayment.status)}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--theme-muted)]">Phương thức</span>
                      <span className="text-sm font-semibold text-[var(--theme-text)]">
                        {formatMethod(pendingPayment.method || (pendingPayment.type === 'vnpay' ? 'VNPAY' : 'MANUAL_QR'))}
                      </span>
                    </div>
                  </div>
                  {pendingPayment.note && (
                    <p className="rounded-lg border border-[var(--theme-accent-border)] bg-[var(--theme-accent-muted)] px-3 py-2 text-xs text-[var(--theme-accent)]">
                      {pendingPayment.note}
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {showMobileQrActions && (
                      <>
                        <Button onClick={handleDownloadQr}>
                          Tải QR
                        </Button>
                        <Button onClick={() => pendingPayment.manualUrl && window.open(pendingPayment.manualUrl, '_blank', 'noopener,noreferrer')}>
                          Mở ngân hàng
                        </Button>
                      </>
                    )}
                    <Button loading={loading} onClick={handleOpenVnpayPage}>
                      Mở VNPAY
                    </Button>
                    <Button loading={loading} onClick={handlePayWithVnpay}>
                      Tạo mã QR khác
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[var(--theme-muted)]">Số tiền nạp</span>
                    <span className="text-base font-semibold text-[var(--theme-text)]">
                      {cardUsesUsd ? `${formatUSD(cardUsdAmount)} / ${formatVND(effectiveAmount)}` : formatVND(effectiveAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[var(--theme-muted)]">Tiền thưởng</span>
                    <span className="text-base font-semibold text-[var(--theme-accent)]">+{formatVND(depositCredit.bonus)}</span>
                  </div>
                  <div className="border-t border-[var(--theme-border)] pt-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--theme-muted)]">Tổng cộng</span>
                      <span className="text-lg font-bold text-[var(--theme-accent)]">{formatVND(depositCredit.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-10">
            <Card
              title="Lịch sử giao dịch"
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
                  {
                    title: 'Thao tác',
                    key: 'action',
                    render: (_: unknown, record: DepositPayment) => (
                      <Button type="link" size="small" onClick={() => setSelectedPayment(record)}>
                        Xem chi tiết
                      </Button>
                    ),
                  },
                  {
                    title: 'Loại giao dịch',
                    key: 'type',
                    render: (_: unknown, record: DepositPayment) => getTransactionType(record),
                  },
                  { title: 'Thời gian', dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => new Date(value).toLocaleString() },
                  { title: 'Mã giao dịch', dataIndex: 'txnRef', key: 'txnRef' },
                  {
                    title: 'Số tiền',
                    key: 'amount',
                    render: (_: unknown, record: DepositPayment) => formatVND(getChargedAmount(record)),
                  },
                  {
                    title: 'Phương thức',
                    key: 'method',
                    render: (_: unknown, record: DepositPayment) => {
                      const info = getPaymentMethodInfo(record)
                      return (
                        <div>
                          <div className="font-medium text-[var(--theme-text)]">{info.label}</div>
                          {info.detail && <div className="mt-0.5 text-xs text-[var(--theme-muted)]">{info.detail}</div>}
                        </div>
                      )
                    },
                  },
                  { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: renderStatus },
                ]}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 760 }}
              />
            </Card>

            <Modal
              title="Chi tiết giao dịch"
              open={Boolean(selectedPayment)}
              onCancel={() => setSelectedPayment(null)}
              footer={<Button onClick={() => setSelectedPayment(null)}>Đóng</Button>}
              width={640}
              destroyOnClose
            >
              {selectedPayment && (() => {
                const metadata = selectedPayment.metadata || {}
                const methodInfo = getPaymentMethodInfo(selectedPayment)
                const totalAmount = Number(metadata.totalAmount || selectedPayment.amount || 0)
                const walletUsed = Number(metadata.walletUsed || 0)
                const vnpayAmount = Number(metadata.remainingAmount || 0)
                const plan = typeof selectedPayment.planId === 'object' ? selectedPayment.planId : null
                const planName = metadata.planName || plan?.nameVi || plan?.nameEn
                const providerRef = metadata.vnpTransactionNo || metadata.vnpayReturn?.vnp_TransactionNo || metadata.vnpayIpn?.vnp_TransactionNo
                const bankCode = metadata.bankCode || metadata.vnpayReturn?.vnp_BankCode || metadata.vnpayIpn?.vnp_BankCode

                const Row = ({ label, children }: { label: string; children: ReactNode }) => (
                  <div className="flex items-start justify-between gap-5 py-2.5">
                    <span className="text-sm text-[var(--theme-muted)]">{label}</span>
                    <span className="max-w-[62%] break-all text-right text-sm font-medium text-[var(--theme-text)]">{children}</span>
                  </div>
                )

                return (
                  <div className="divide-y divide-[var(--theme-border)]">
                    <div className="pb-2">
                      <Row label="Loại giao dịch">{getTransactionType(selectedPayment)}</Row>
                      <Row label="Trạng thái">{renderStatus(selectedPayment.status)}</Row>
                      <Row label="Phương thức">{methodInfo.label}</Row>
                      <Row label="Mã giao dịch">{selectedPayment.txnRef || '—'}</Row>
                      <Row label="Thời điểm tạo">{new Date(selectedPayment.createdAt).toLocaleString('vi-VN')}</Row>
                      {selectedPayment.paidAt && <Row label="Thời điểm thanh toán">{new Date(selectedPayment.paidAt).toLocaleString('vi-VN')}</Row>}
                    </div>

                    <div className="py-2">
                      {totalAmount !== getChargedAmount(selectedPayment) && <Row label="Tổng giá trị">{formatVND(totalAmount)}</Row>}
                      {walletUsed > 0 && <Row label="Thanh toán từ ví">{formatVND(walletUsed)}</Row>}
                      {vnpayAmount > 0 && <Row label="Thanh toán qua VNPay">{formatVND(vnpayAmount)}</Row>}
                      <Row label={vnpayAmount > 0 ? 'Số tiền VNPay thực thu' : 'Số tiền'}>{formatVND(getChargedAmount(selectedPayment))}</Row>
                    </div>

                    {(planName || providerRef || bankCode) && (
                      <div className="pt-2">
                        {planName && <Row label="Gói tập">{planName}</Row>}
                        {providerRef && <Row label="Mã tham chiếu VNPay">{providerRef}</Row>}
                        {bankCode && <Row label="Ngân hàng">{bankCode}</Row>}
                      </div>
                    )}
                  </div>
                )
              })()}
            </Modal>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
