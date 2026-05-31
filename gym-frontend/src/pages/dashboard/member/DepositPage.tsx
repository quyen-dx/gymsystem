import { useEffect, useState, useMemo } from 'react'
import { Button, Card, Select, Skeleton, Table, Typography, message } from 'antd'
import { loadStripe } from '@stripe/stripe-js'
import type { StripeCardCvcElement, StripeCardExpiryElement, StripeCardNumberElement } from '@stripe/stripe-js'
import { CardCvcElement, CardExpiryElement, CardNumberElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import DepositQR from '../../../components/wallet/DepositQR'
import BankInfoCard from '../../../components/wallet/BankInfoCard'
import { useDeposit } from '../../../hooks/useDeposit'
import { useWallet } from '../../../context/WalletProvider'
import { createStripePaymentIntent, getStripeExchangeRate, getWalletTransactions } from '../../../services/walletService'
import { BANKS, PRESET_AMOUNTS } from '../../../types/member/wallet'
import type { BankOption } from '../../../types/member/wallet'

const { Text } = Typography
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null
const USD_PRESET_AMOUNTS = [5, 10, 20, 50]
const FALLBACK_USD_TO_VND_RATE = 25000
const DEPOSIT_BONUS_TIERS = [
  { threshold: 70000000, rate: 0.03 },
  { threshold: 15000000, rate: 0.02 },
]

const cardStyle = {
  style: {
    base: {
      color: '#ffffff',
      fontSize: '14px',
      '::placeholder': { color: '#6b7280' },
    },
    invalid: { color: '#ef4444' },
  },
}

function formatVND(amount: number) {
  return new Intl.NumberFormat(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
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

function getDepositCredit(amount: number) {
  const bonusRate = DEPOSIT_BONUS_TIERS.find((tier) => amount >= tier.threshold)?.rate || 0
  const bonus = Math.round(amount * bonusRate)
  return { bonus, total: amount + bonus }
}

const STEPS = [
  { step: 1, titleKey: 'deposit.step_1_title', descKey: 'deposit.step_1_desc' },
  { step: 2, titleKey: 'deposit.step_2_title', descKey: 'deposit.step_2_desc' },
  { step: 3, titleKey: 'deposit.step_3_title', descKey: 'deposit.step_3_desc' },
  { step: 4, titleKey: 'deposit.step_4_title', descKey: 'deposit.step_4_desc' },
]

function StripeCardForm({
  onPaid,
}: {
  onPaid: () => void
}) {
  const { t } = useTranslation()
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardNumber, setCardNumber] = useState<StripeCardNumberElement | null>(null)
  const [cardExpiry, setCardExpiry] = useState<StripeCardExpiryElement | null>(null)
  const [cardCvc, setCardCvc] = useState<StripeCardCvcElement | null>(null)
  const [usdAmount, setUsdAmount] = useState(10)
  const [customUsdInput, setCustomUsdInput] = useState('')
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const vndAmount = exchangeRate ? Math.round(usdAmount * exchangeRate) : null
  const cardCredit = vndAmount ? getDepositCredit(vndAmount) : null
  const usdAmountError = usdAmount < 0.5 ? t('deposit.card.min_usd') : null

  useEffect(() => {
    getStripeExchangeRate()
      .then((res) => setExchangeRate(Number(res.data.data.rate)))
      .catch(() => setExchangeRate(FALLBACK_USD_TO_VND_RATE))
  }, [])

  const handlePay = async () => {
    if (!stripe || !elements || usdAmountError) return

    const cardElement = elements.getElement(CardNumberElement)
    if (!cardElement) return

    setPaying(true)
    setError(null)

    try {
      const res = await createStripePaymentIntent({ amountUsd: usdAmount })
      const clientSecret = res.data.clientSecret
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      })

      if (result.error) {
        setError(result.error.message || t('deposit.card.payment_failed'))
        return
      }

      message.success(t('deposit.card.success'))
      onPaid()
    } catch (err: any) {
      setError(err?.response?.data?.message || t('deposit.card.process_failed'))
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
      <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5">
        <div className="space-y-3">
          <Text className="block text-sm font-medium text-[var(--theme-text)]">{t('deposit.card.select_usd_amount')}</Text>
          <div className="grid grid-cols-4 gap-2">
            {USD_PRESET_AMOUNTS.map((val) => (
              <button
                key={val}
                onClick={() => {
                  setUsdAmount(val)
                  setCustomUsdInput('')
                }}
                className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-all ${
                  usdAmount === val && !customUsdInput
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                    : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-muted)] hover:border-[var(--theme-accent-border)]'
                }`}
              >
                {formatUSD(val)}
              </button>
            ))}
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={customUsdInput}
            onChange={(event) => {
              const raw = event.target.value.replace(/[^\d.]/g, '')
              const normalized = raw.replace(/(\..*)\./g, '$1')
              setCustomUsdInput(normalized)
              if (normalized) setUsdAmount(Number(normalized))
            }}
            placeholder={t('deposit.card.placeholder_custom_usd')}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 py-2.5 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-placeholder)] outline-none transition-colors focus:border-[var(--theme-accent)]"
          />
          {vndAmount ? (
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--theme-muted)]">{t('deposit.card.charge_amount')}</span>
                <span className="text-base font-semibold text-[var(--theme-text)]">{formatUSD(usdAmount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--theme-muted)]">{t('deposit.card.deposit_amount')}</span>
                <span className="text-base font-semibold text-[var(--theme-text)]">{formatVND(vndAmount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--theme-muted)]">{t('deposit.bonus_amount')}</span>
                <span className="text-base font-semibold text-[var(--theme-accent)]">+{formatVND(cardCredit?.bonus || 0)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--theme-muted)]">{t('deposit.card.wallet_credit')}</span>
                <span className="text-lg font-bold text-[var(--theme-accent)]">{formatVND(cardCredit?.total || vndAmount)}</span>
              </div>
              <div className="mt-3 border-t border-[var(--theme-border)] pt-3 text-xs text-[var(--theme-muted)]">
                {t('deposit.card.exchange_rate', { rate: Math.round(exchangeRate || 0).toLocaleString('vi-VN') })}
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-[var(--theme-muted)]">{t('deposit.card.exchange_loading')}</p>
          )}
          {usdAmountError && <p className="text-xs text-[#ef4444]">{usdAmountError}</p>}
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5">
        <div className="mb-5">
          <p className="text-base font-semibold text-[var(--theme-text)]">{t('deposit.card.title')}</p>
          <p className="mt-1 text-xs text-[var(--theme-muted)]">{t('deposit.card.description')}</p>
        </div>

        <div className="space-y-4">
          {!stripePublishableKey && (
            <p className="rounded-lg border border-[#ef444433] bg-[#ef44440f] px-3 py-2 text-xs text-[#ef4444]">
              {t('deposit.card.missing_key')}
            </p>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--theme-text)]">{t('deposit.card.card_number')}</span>
            <div
              role="button"
              tabIndex={0}
              onClick={() => cardNumber?.focus()}
              onKeyDown={(event) => event.key === 'Enter' && cardNumber?.focus()}
              className="relative cursor-text rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 py-3 pr-36 transition-colors focus-within:border-[var(--theme-accent)]"
            >
              <CardNumberElement
                onReady={setCardNumber}
                options={{ ...cardStyle, showIcon: true, placeholder: t('deposit.card.card_number_placeholder') }}
              />
              <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <span className="rounded bg-[#0a4ea3] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">VISA</span>
                <span className="relative h-4 w-6 rounded bg-[#1f2937]">
                  <span className="absolute left-1 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-[#eb001b]" />
                  <span className="absolute right-1 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-[#f79e1b]" />
                </span>
                <span className="rounded bg-[#00a1df] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">AMEX</span>
                <span className="rounded bg-white px-1.5 py-0.5 text-[8px] font-bold leading-none text-[#f58220]">DISC</span>
              </div>
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--theme-text)]">{t('deposit.card.expiration_date')}</span>
              <div
                role="button"
                tabIndex={0}
                onClick={() => cardExpiry?.focus()}
                onKeyDown={(event) => event.key === 'Enter' && cardExpiry?.focus()}
                className="cursor-text rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 py-3 transition-colors focus-within:border-[var(--theme-accent)]"
              >
                <CardExpiryElement onReady={setCardExpiry} options={{ ...cardStyle, placeholder: t('deposit.card.expiration_placeholder') }} />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--theme-text)]">{t('deposit.card.security_code')}</span>
              <div
                role="button"
                tabIndex={0}
                onClick={() => cardCvc?.focus()}
                onKeyDown={(event) => event.key === 'Enter' && cardCvc?.focus()}
                className="cursor-text rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)] px-4 py-3 transition-colors focus-within:border-[var(--theme-accent)]"
              >
                <CardCvcElement onReady={setCardCvc} options={{ ...cardStyle, placeholder: t('deposit.card.cvc_placeholder') }} />
              </div>
            </label>
          </div>

          {error && <p className="text-xs text-[#ef4444]">{error}</p>}

          <Button
            type="primary"
            size="large"
            block
            loading={paying}
            disabled={!stripe || !!usdAmountError}
            onClick={handlePay}
            className="!h-11 !bg-[var(--theme-button-bg)] !text-[var(--theme-button-text)] !font-semibold !shadow-none hover:!bg-[var(--theme-accent-hover)]"
          >
            {t('deposit.card.pay_button', { amount: formatUSD(usdAmount) })}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function DepositPage() {
  const { t } = useTranslation()
  const { wallet } = useWallet()
  const {
    bankInfo,
    bankInfoLoading,
    selectedBank,
    setSelectedBank,
    deposit,
    depositLoading,
    confirmLoading,
    cancelLoading,
    fetchBankInfo,
    handleCreateDeposit,
    handleConfirmDeposit,
    handleCancelDeposit,
  } = useDeposit()
  const [tab, setTab] = useState<'qr' | 'manual' | 'card'>('qr')
  const [amount, setAmount] = useState(PRESET_AMOUNTS[1])
  const [customInput, setCustomInput] = useState('')
  const [transactions, setTransactions] = useState<any[]>([])
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'deposit' | 'spending'>('all')

  const bankMeta = useMemo(() => BANKS[selectedBank], [selectedBank])
  const amountError = useMemo(() => {
    if (amount < 10000) return t('deposit.min_amount')
    if (amount > 100000000) return t('deposit.max_amount')
    return null
  }, [amount, t])
  const filteredTransactions = useMemo(() => {
    if (transactionFilter === 'deposit') return transactions.filter((item) => item.amount > 0)
    if (transactionFilter === 'spending') return transactions.filter((item) => item.amount < 0)
    return transactions
  }, [transactionFilter, transactions])

  useEffect(() => {
    fetchBankInfo()
  }, [fetchBankInfo])

  useEffect(() => {
    getWalletTransactions()
      .then((res) => setTransactions(res.data.data))
      .catch(() => {})
  }, [])

  const handlePresetClick = (val: number) => {
    setAmount(val)
    setCustomInput('')
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    setCustomInput(raw)
    if (raw) setAmount(Number(raw))
  }

  const handleCreate = () => {
    if (amountError) return
    handleCreateDeposit(amount)
  }

  const handleCancel = async () => {
    await handleCancelDeposit()
    setAmount(PRESET_AMOUNTS[1])
    setCustomInput('')
  }

  const refreshTransactions = () => {
    getWalletTransactions()
      .then((res) => setTransactions(res.data.data))
      .catch(() => {})
  }

  const bankOptions: { key: BankOption; label: string; sub: string }[] = [
    { key: 'VCB', label: 'Vietcombank', sub: 'VCB' },
    { key: 'MB', label: 'MB Bank', sub: 'MB' },
    { key: 'TECHCOMBANK', label: 'Techcombank', sub: 'Techcombank' },
  ]

  const renderAmountSection = () => (
    <div className="space-y-3">
      <Text className="block text-sm font-medium text-[var(--theme-text)]">{t('deposit.select_amount')}</Text>
      <div className="grid grid-cols-4 gap-2">
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
            {val >= 1000000 ? `${val / 1000000}.000k` : `${val / 1000}k`}
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
      {amountError && (
        <p className="text-xs text-[#ef4444]">{amountError}</p>
      )}
      {!amountError && (
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-[var(--theme-muted)]">{t('deposit.deposit_amount')}</span>
            <span className="text-base font-semibold text-[var(--theme-text)]">{formatVND(amount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="text-sm text-[var(--theme-muted)]">{t('deposit.bonus_amount')}</span>
            <span className="text-base font-semibold text-[var(--theme-accent)]">+{formatVND(getDepositCredit(amount).bonus)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="text-sm text-[var(--theme-muted)]">{t('deposit.total_credit')}</span>
            <span className="text-lg font-bold text-[var(--theme-accent)]">{formatVND(getDepositCredit(amount).total)}</span>
          </div>
        </div>
      )}
    </div>
  )

  const renderBankSelector = () => (
    <div className="space-y-3">
      <Text className="block text-sm font-medium text-[var(--theme-text)]">{t('deposit.select_bank')}</Text>
      <div className="space-y-2">
        {bankOptions.map(({ key, label, sub }) => (
          <button
            key={key}
            onClick={() => setSelectedBank(key)}
            className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
              selectedBank === key
                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]'
                : 'border-[var(--theme-border)] bg-[var(--theme-card)] hover:border-[var(--theme-accent-border)]'
            }`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                selectedBank === key
                  ? 'border-[var(--theme-accent)] after:block after:size-2.5 after:rounded-full after:bg-[var(--theme-accent)]'
                  : 'border-[var(--theme-placeholder)]'
              }`}
            >
              <span className={selectedBank === key ? undefined : 'hidden'} />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--theme-text)]">{label}</p>
              <p className="text-xs text-[var(--theme-muted)]">{sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  const renderBankInfoSection = () => {
    if (!bankInfo) return null
    return (
      <div className="space-y-3">
        <Text className="block text-sm font-medium text-[var(--theme-text)]">{t('deposit.account_info')}</Text>
        <BankInfoCard
          bankInfo={bankInfo}
          bankMeta={bankMeta}
          transferContent={deposit?.transferContent ?? `NAPTIEN${(bankInfo.accountNumber).slice(-8)}`}
        />
      </div>
    )
  }

  const renderLeftColumn = () => {
    if (!deposit || !bankInfo) {
      return (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-[var(--theme-border)]">
          <div className="text-center">
            <svg className="mx-auto mb-3 size-12 text-[var(--theme-placeholder)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
            <p className="text-sm text-[var(--theme-muted)]">{t('deposit.placeholder_qr_empty')}</p>
          </div>
        </div>
      )
    }
    return (
      <DepositQR
        bankInfo={bankInfo}
        bankMeta={bankMeta}
        amount={amount}
        transferContent={deposit.transferContent}
        expiredAt={deposit.expiredAt}
        confirmLoading={confirmLoading}
        cancelLoading={cancelLoading}
        onConfirm={() => handleConfirmDeposit(amount)}
        onCancel={handleCancel}
      />
    )
  }

  const renderRightColumn = () => (
    <div className="space-y-6">
      {renderBankSelector()}
      {renderAmountSection()}
      <Button
        type="primary"
        size="large"
        block
        loading={depositLoading}
        disabled={!!amountError}
        onClick={handleCreate}
        className="!h-11 !bg-[var(--theme-button-bg)] !text-[var(--theme-button-text)] !font-semibold !shadow-none hover:!bg-[var(--theme-accent-hover)]"
      >
        {t('deposit.create_qr')}
      </Button>
      {renderBankInfoSection()}
      <div className="rounded-lg border border-[var(--theme-accent-border)] bg-[var(--theme-accent-muted)] px-4 py-3 text-xs text-[var(--theme-accent)]">
        {t('deposit.note_time')}
      </div>
    </div>
  )

  const renderManualTab = () => {
    if (bankInfoLoading) {
      return (
        <div className="space-y-3">
          <Skeleton active paragraph={{ rows: 2 }} />
        </div>
      )
    }
    if (!bankInfo) {
      return (
        <div className="rounded-lg border border-[#ef444433] bg-[#ef44440f] px-4 py-6 text-center text-sm text-[#ef4444]">
          {t('deposit.error_load_bank')}
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5">
          <BankInfoCard
            bankInfo={bankInfo}
            bankMeta={bankMeta}
            transferContent={`NAPTIEN${(bankInfo.accountNumber).slice(-8)}`}
            showWarning
          />
        </div>
      </div>
    )
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

          <div className="mb-6 rounded-xl border border-[var(--theme-accent-border)] bg-[var(--theme-accent-muted)] px-4 py-3 text-sm text-[var(--theme-accent)]">
            <span className="font-semibold">{t('deposit.bonus_title')}</span>{' '}
            {t('deposit.bonus_desc')}
          </div>

          <div className="mb-6 flex gap-1 rounded-xl bg-[var(--theme-elevated)] p-1">
            <button
              onClick={() => setTab('card')}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                tab === 'card'
                  ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)] shadow-sm'
                  : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
              }`}
            >
              {t('deposit.tab_card')}
            </button>
            <button
              onClick={() => setTab('qr')}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                tab === 'qr'
                  ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)] shadow-sm'
                  : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
              }`}
            >
              {t('deposit.tab_qr')}
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                tab === 'manual'
                  ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)] shadow-sm'
                  : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
              }`}
            >
              {t('deposit.tab_manual')}
            </button>
          </div>

          {bankInfoLoading ? (
            <div className="space-y-4">
              <Skeleton active paragraph={{ rows: 6 }} />
            </div>
          ) : tab === 'qr' ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>{renderLeftColumn()}</div>
              <div>{renderRightColumn()}</div>
            </div>
          ) : tab === 'card' ? (
            <Elements stripe={stripePromise} options={{ locale: i18n.language.startsWith('vi') ? 'vi' : 'en' }}>
              <StripeCardForm
                onPaid={() => {
                  refreshTransactions()
                  setTimeout(refreshTransactions, 3000)
                }}
              />
            </Elements>
          ) : (
            renderManualTab()
          )}

          <div className="mt-10">
            <h2 className="mb-4 text-base font-semibold text-[var(--theme-text)]">{t('deposit.guide_title')}</h2>
            <div className="space-y-3">
              {STEPS.map(({ step, titleKey, descKey }) => (
                <div key={step} className="flex gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--theme-active-bg)] text-sm font-bold text-[var(--theme-active-text)]">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--theme-text)]">{t(titleKey)}</p>
                    <p className="mt-0.5 text-xs text-[var(--theme-muted)]">{t(descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <Card
              title={t('deposit.transaction_history')}
              extra={(
                <Select
                  value={transactionFilter}
                  onChange={setTransactionFilter}
                  className="min-w-40"
                  options={[
                    { label: t('deposit.filter_all'), value: 'all' },
                    { label: t('deposit.filter_deposit'), value: 'deposit' },
                    { label: t('deposit.filter_spending'), value: 'spending' },
                  ]}
                />
              )}
            >
              <Table
                rowKey="_id"
                dataSource={filteredTransactions}
                columns={[
                  { title: t('deposit.table_time'), dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => new Date(value).toLocaleString() },
                  {
                    title: t('deposit.table_amount'),
                    dataIndex: 'amount',
                    key: 'amount',
                    render: (value: number) => `${value > 0 ? '+' : ''}${formatVND(value)}`,
                  },
                  { title: t('deposit.table_status'), dataIndex: 'status', key: 'status' },
                  { title: t('deposit.table_note'), dataIndex: ['metadata', 'note'], key: 'note' },
                ]}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 720 }}
              />
            </Card>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
