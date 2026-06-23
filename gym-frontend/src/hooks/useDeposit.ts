import { useState, useCallback } from 'react'
import { message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { useWallet } from '../context/WalletProvider'
import {
  getBankInfo,
  createDepositPayment,
  confirmDeposit,
  cancelDepositTransaction,
} from '../services/walletService'
import type { BankInfo, DepositResponse, BankOption } from '../types/member/wallet'
import { BANKS } from '../types/member/wallet'

const MOCK_BANK_INFO: BankInfo = {
  bankId: '970436',
  accountNumber: '1234567890',
  accountName: 'GYMPRO - TRUNG TAM THE HINH',
  branch: 'CN TP. HCM',
}

export function useDeposit() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshWallet } = useWallet()
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null)
  const [bankInfoLoading, setBankInfoLoading] = useState(false)
  const [bankInfoError, setBankInfoError] = useState<string | null>(null)
  const [selectedBank, setSelectedBank] = useState<BankOption>('VCB')
  const [deposit, setDeposit] = useState<DepositResponse | null>(null)
  const [depositLoading, setDepositLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  const fetchBankInfo = useCallback(async () => {
    setBankInfoLoading(true)
    setBankInfoError(null)
    try {
      const res = await getBankInfo()
      setBankInfo(res.data.data)
    } catch {
      // TODO: Remove mock fallback when API is ready
      setBankInfo(MOCK_BANK_INFO)
    } finally {
      setBankInfoLoading(false)
    }
  }, [])

  const handleCreateDeposit = useCallback(async (amount: number) => {
    if (!user) return
    if (amount < 10000) {
      message.error('Số tiền tối thiểu là 10.000đ')
      return
    }
    if (amount > 50000000) {
      message.error('Số tiền tối đa là 50.000.000đ')
      return
    }

    setDepositLoading(true)
    setDeposit(null)
    try {
      const bankMeta = BANKS[selectedBank]
      const res = await createDepositPayment({
        amount,
        bankId: bankMeta.id,
        userId: user._id,
      })
      setDeposit(res.data.data)
      message.success('Đã tạo yêu cầu nạp tiền')
    } catch {
      // TODO: Remove mock fallback when API is ready
      const mock: DepositResponse = {
        transactionId: `MOCK_${Date.now()}`,
        transferContent: `NAPTIEN${user._id.slice(-8)}`,
        expiredAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        amount,
      }
      setDeposit(mock)
    } finally {
      setDepositLoading(false)
    }
  }, [user, selectedBank])

  const handleConfirmDeposit = useCallback(async (amount: number) => {
    if (!deposit?.transactionId) return
    setConfirmLoading(true)
    try {
      const res = await confirmDeposit({ transactionId: deposit.transactionId })
      const newBalance = res.data?.newBalance ?? res.data?.data?.newBalance
      if (newBalance !== undefined) {
        refreshWallet()
      }
      message.success(`Nạp tiền thành công! +${amount.toLocaleString('vi-VN')}đ`)
      setDeposit(null)
      setTimeout(() => navigate('/deposit'), 1500)
    } catch {
      // TODO: Replace with real error handling when API is ready
      message.error('Chưa nhận được giao dịch. Thử lại sau ít phút.')
    } finally {
      setConfirmLoading(false)
    }
  }, [deposit, navigate, refreshWallet])

  const handleCancelDeposit = useCallback(async () => {
    if (!deposit?.transactionId) return
    setCancelLoading(true)
    try {
      await cancelDepositTransaction(deposit.transactionId)
      message.info('Đã hủy yêu cầu nạp tiền')
    } catch {
      // TODO: Remove mock fallback when API is ready
      message.info('Đã hủy yêu cầu nạp tiền')
    } finally {
      setCancelLoading(false)
      setDeposit(null)
    }
  }, [deposit])

  return {
    bankInfo,
    bankInfoLoading,
    bankInfoError,
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
  }
}
