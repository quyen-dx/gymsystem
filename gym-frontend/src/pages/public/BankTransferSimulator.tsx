import { Button, Card, Result, Tag } from 'antd'
import type { ReactNode } from 'react'
import i18n from '../../i18n'

export const SIMULATED_BANK_ACCOUNT = {
  bankName: 'NCB',
  accountName: 'NGUYEN VAN A',
  accountNumber: '9704198526191432198',
}

type BankTransferSimulatorProps = {
  amount: number
  transferContent: string
  status: string
  confirming: boolean
  recipientBankName: string
  recipientAccountName: string
  recipientAccountNumber: string
  warningText: ReactNode
  successTitle: string
  successSubtitle: ReactNode
  confirmText?: string
  onConfirm: () => void
}

function formatVND(amount: number) {
  return new Intl.NumberFormat(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

export default function BankTransferSimulator({
  amount,
  transferContent,
  status,
  confirming,
  recipientBankName,
  recipientAccountName,
  recipientAccountNumber,
  warningText,
  successTitle,
  successSubtitle,
  confirmText = 'Xác nhận chuyển khoản',
  onConfirm,
}: BankTransferSimulatorProps) {
  const paid = status === 'PAID'

  return (
    <div className="min-h-screen bg-[#eef5f2] px-4 py-6 text-[#10251f]">
      <div className="mx-auto max-w-md">
        <div className="mb-4 rounded-2xl bg-[#007a3d] px-5 py-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">NCB</p>
              <h1 className="mt-1 text-xl font-bold">Chuyển khoản</h1>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">QR PAY</span>
          </div>
        </div>

        <Card className="!rounded-2xl !border-0 !bg-white !text-[#10251f] shadow-md">
          <div className="space-y-5">
            <div className="rounded-xl border border-[#d7e6df] bg-[#f8fbfa] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#587067]">Tài khoản nguồn</p>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#10251f]">NGUYEN VAN A</p>
                  <p className="text-sm text-[#6b7f77]">**** 2198</p>
                </div>
                <Tag color="green">ĐANG HOẠT ĐỘNG</Tag>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-[#6b7f77]">Ngân hàng nhận</p>
                <div className="mt-1 rounded-xl border border-[#d7e6df] bg-white px-4 py-3 font-semibold text-[#10251f]">{recipientBankName}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7f77]">Số tài khoản</p>
                <div className="mt-1 rounded-xl border border-[#d7e6df] bg-white px-4 py-3 font-semibold text-[#10251f]">{recipientAccountNumber}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7f77]">Tên chủ tài khoản</p>
                <div className="mt-1 rounded-xl border border-[#d7e6df] bg-white px-4 py-3 font-semibold text-[#10251f]">{recipientAccountName}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7f77]">Số tiền</p>
                <div className="mt-1 rounded-xl border border-[#d7e6df] bg-white px-4 py-3 text-xl font-bold text-[#007a3d]">{formatVND(amount)}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7f77]">Nội dung chuyển khoản</p>
                <div className="mt-1 rounded-xl border border-[#d7e6df] bg-white px-4 py-3 font-semibold text-[#10251f]">{transferContent}</div>
              </div>
            </div>

            <div className="rounded-xl border border-[#f1d18a] bg-[#fff8e6] px-4 py-3 text-xs text-[#7a5a10]">
              {warningText}
            </div>

            {paid ? (
              <Result status="success" title={successTitle} subTitle={successSubtitle} />
            ) : (
              <Button type="primary" block size="large" loading={confirming} onClick={onConfirm} className="!h-12 !bg-[#007a3d]">
                {confirmText}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
