import { useState } from 'react'
import { message } from 'antd'
import { useTranslation } from 'react-i18next'
import type { BankInfo } from '../../types/member/wallet'
import type { BankMeta } from '../../types/member/wallet'

interface BankInfoCardProps {
  bankInfo: BankInfo
  bankMeta: BankMeta
  transferContent: string
  showWarning?: boolean
}

function CopyableRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      message.success(label)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      message.error(t('deposit.bank.copy_failed'))
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--theme-card)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--theme-muted)]">{label}</p>
        <p className="truncate text-sm font-medium text-[var(--theme-text)]">{value}</p>
      </div>
      <button
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--theme-accent-muted)] active:bg-[var(--theme-accent-border)]"
      >
        {copied ? (
          <svg className="size-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="size-4 text-[var(--theme-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  )
}

export default function BankInfoCard({
  bankInfo,
  bankMeta,
  transferContent,
  showWarning,
}: BankInfoCardProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <CopyableRow label={t('deposit.bank.account_number')} value={bankInfo.accountNumber} />
      <CopyableRow label={t('deposit.bank.account_name')} value={bankInfo.accountName} />
      <CopyableRow label={t('deposit.bank.transfer_content')} value={transferContent} />
      <CopyableRow label={t('deposit.bank.bank_name')} value={bankMeta.name} />

      {showWarning && (
        <div className="mt-3 rounded-lg border border-[#f59e0b33] bg-[#f59e0b0f] px-4 py-3 text-sm text-[#f59e0b]">
          ⚠ {t('deposit.bank.warning')}
        </div>
      )}
    </div>
  )
}
