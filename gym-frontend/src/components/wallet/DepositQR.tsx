import { QRCodeSVG } from 'qrcode.react'
import { Button, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import type { BankInfo } from '../../types/member/wallet'
import type { BankMeta } from '../../types/member/wallet'

const { Text } = Typography

interface DepositQRProps {
  bankInfo: BankInfo
  bankMeta: BankMeta
  amount: number
  transferContent: string
  expiredAt: string
  confirmLoading: boolean
  cancelLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function formatVND(amount: number) {
  return new Intl.NumberFormat(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

export default function DepositQR({
  bankInfo,
  bankMeta,
  amount,
  transferContent,
  expiredAt,
  confirmLoading,
  cancelLoading,
  onConfirm,
  onCancel,
}: DepositQRProps) {
  const { t } = useTranslation()
  const qrValue = [
    `https://img.vietqr.io/image/${bankMeta.id}-${bankInfo.accountNumber}-compact.png`,
    `?amount=${amount}`,
    `&addInfo=${encodeURIComponent(transferContent)}`,
    `&accountName=${encodeURIComponent(bankInfo.accountName)}`,
  ].join('')

  const expiredDate = new Date(expiredAt)
  const now = new Date()
  const isExpired = expiredDate <= now

  return (
    <div className="flex flex-col items-center gap-5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-1 text-xs font-medium text-[var(--theme-muted)]">
        <img src={bankMeta.logo} alt="" className="size-4 rounded-full" />
        {bankMeta.name}
      </span>

      <div className="rounded-2xl bg-white p-4">
        <QRCodeSVG
          value={qrValue}
          size={200}
          level="M"
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        />
      </div>

      <div className="text-center">
        <Text className="block text-xs text-[var(--theme-muted)]">{t('deposit.qr.amount_label')}</Text>
        <p className="text-2xl font-bold tracking-tight text-[var(--theme-text)]">
          {formatVND(amount)}
        </p>
      </div>

      {isExpired ? (
        <div className="rounded-lg bg-[#ef444415] px-4 py-2.5 text-sm text-[#ef4444]">
          {t('deposit.qr.expired')}
        </div>
      ) : (
        <div className="text-xs text-[var(--theme-muted)]">
          {t('deposit.qr.expires_at', { time: expiredDate.toLocaleTimeString('vi-VN') })}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="primary"
          size="large"
          loading={confirmLoading}
          disabled={isExpired || confirmLoading}
          onClick={onConfirm}
          className="!bg-[var(--theme-button-bg)] !text-[var(--theme-button-text)] !font-semibold !shadow-none hover:!bg-[var(--theme-accent-hover)]"
        >
          {confirmLoading ? t('deposit.qr.confirming') : t('deposit.qr.confirm_btn')}
        </Button>
        <Button size="large" disabled={confirmLoading} loading={cancelLoading} onClick={onCancel}>
          {t('deposit.qr.cancel_btn')}
        </Button>
      </div>
    </div>
  )
}
