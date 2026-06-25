import api from './api';

export const getWallet = () => api.get('/wallet')
export const getWalletTransactions = () => api.get('/wallet/transactions')
export const getDepositPayments = () => api.get('/wallet/deposit-payments')
export const createDeposit = (data: { amount: number; provider: string }) => api.post('/wallet/deposit', data)
export const createVnpayDeposit = (data: { amount: number; bankCode?: string }) => api.post('/wallet/vnpay-deposit', data)
export const createManualQrDeposit = (data: { amount: number }) => api.post('/wallet/manual-qr-deposit', data)
export const getManualQrDepositInfo = (txnRef: string) => api.get(`/wallet/manual-qr-info/${encodeURIComponent(txnRef)}`)
export const simulateManualQrPayment = (txnRef: string) => api.post(`/wallet/manual-qr-demo-pay/${encodeURIComponent(txnRef)}`)
export const createStripePaymentIntent = (data: { amount?: number; amountUsd?: number }) => api.post('/wallet/create-payment-intent', data)
export const getStripeExchangeRate = () => api.get('/wallet/stripe-exchange-rate')
export const fakeDeposit = (data: { userId: string; amount: number }) => api.post('/wallet/fake-deposit', data)
export const transferWallet = (data: { fromUserId: string; toUserId: string; amount: number }) => api.post('/wallet/transfer', data)

export const getBankInfo = () => api.get('/wallet/bank-info')

export const createDepositPayment = (data: { amount: number; bankId: string; userId: string }) =>
  api.post('/wallet/deposit', data)

export const confirmDeposit = (data: { transactionId: string }) =>
  api.post('/wallet/deposit/confirm', data)

export const cancelDepositTransaction = (transactionId: string) =>
  api.patch(`/wallet/deposit/${transactionId}/cancel`)

export const staffListAllTransactions = (params?: Record<string, any>) =>
  api.get('/wallet/staff/transactions', { params })

export const staffListAllPayments = (params?: Record<string, any>) =>
  api.get('/wallet/staff/payments', { params })
