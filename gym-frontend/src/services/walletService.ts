import api from './api';

export const getWallet = () => api.get('/wallet')
export const getWalletTransactions = () => api.get('/wallet/transactions')
export const createDeposit = (data: { amount: number; provider: string }) => api.post('/wallet/deposit', data)
export const createStripePaymentIntent = (data: { amount: number }) => api.post('/wallet/create-payment-intent', data)
export const fakeDeposit = (data: { userId: string; amount: number }) => api.post('/wallet/fake-deposit', data)
export const transferWallet = (data: { fromUserId: string; toUserId: string; amount: number }) => api.post('/wallet/transfer', data)

export const getBankInfo = () => api.get('/wallet/bank-info')

export const createDepositPayment = (data: { amount: number; bankId: string; userId: string }) =>
  api.post('/wallet/deposit', data)

export const confirmDeposit = (data: { transactionId: string }) =>
  api.post('/wallet/deposit/confirm', data)

export const cancelDepositTransaction = (transactionId: string) =>
  api.patch(`/wallet/deposit/${transactionId}/cancel`)
