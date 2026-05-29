import { useEffect, useState, useMemo } from 'react'
import { Button, Card, Skeleton, Table, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import DepositQR from '../../../components/wallet/DepositQR'
import BankInfoCard from '../../../components/wallet/BankInfoCard'
import { useDeposit } from '../../../hooks/useDeposit'
import { useWallet } from '../../../context/WalletProvider'
import { getWalletTransactions } from '../../../services/walletService'
import { BANKS, PRESET_AMOUNTS } from '../../../types/member/wallet'
import type { BankOption } from '../../../types/member/wallet'

const { Text } = Typography

function formatVND(amount: number) {
  return new Intl.NumberFormat(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

const STEPS = [
  { step: 1, titleKey: 'deposit.step_1_title', descKey: 'deposit.step_1_desc' },
  { step: 2, titleKey: 'deposit.step_2_title', descKey: 'deposit.step_2_desc' },
  { step: 3, titleKey: 'deposit.step_3_title', descKey: 'deposit.step_3_desc' },
  { step: 4, titleKey: 'deposit.step_4_title', descKey: 'deposit.step_4_desc' },
]

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
  const [tab, setTab] = useState<'qr' | 'manual'>('qr')
  const [amount, setAmount] = useState(PRESET_AMOUNTS[1])
  const [customInput, setCustomInput] = useState('')
  const [transactions, setTransactions] = useState<any[]>([])

  const bankMeta = useMemo(() => BANKS[selectedBank], [selectedBank])
  const amountError = useMemo(() => {
    if (amount < 10000) return t('deposit.min_amount')
    if (amount > 50000000) return t('deposit.max_amount')
    return null
  }, [amount, t])

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
        className="!h-11 !bg-[var(--theme-accent)] !font-semibold !shadow-none hover:!bg-[var(--theme-accent-hover)]"
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

          <div className="mb-6 flex gap-1 rounded-xl bg-[var(--theme-elevated)] p-1">
            <button
              onClick={() => setTab('qr')}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                tab === 'qr'
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-button-text)] shadow-sm'
                  : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
              }`}
            >
              {t('deposit.tab_qr')}
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                tab === 'manual'
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-button-text)] shadow-sm'
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
          ) : (
            renderManualTab()
          )}

          <div className="mt-10">
            <h2 className="mb-4 text-base font-semibold text-[var(--theme-text)]">{t('deposit.guide_title')}</h2>
            <div className="space-y-3">
              {STEPS.map(({ step, titleKey, descKey }) => (
                <div key={step} className="flex gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent)] text-sm font-bold text-[var(--theme-button-text)]">
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
            <Card title={t('deposit.transaction_history')}>
              <Table
                rowKey="_id"
                dataSource={transactions}
                columns={[
                  { title: t('deposit.table_time'), dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => new Date(value).toLocaleString() },
                  { title: t('deposit.table_type'), dataIndex: 'type', key: 'type' },
                  { title: t('deposit.table_amount'), dataIndex: 'amount', key: 'amount', render: (value: number) => value.toLocaleString('vi-VN') },
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
