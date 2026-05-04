import api from './api';

export const getWallet = () => api.get('/wallet')
export const getWalletTransactions = () => api.get('/wallet/transactions')
export const createDeposit = (data: { amount: number; provider: string }) => api.post('/wallet/deposit', data)
export const createSandboxPayment = (data: { amount: number }) => api.post('/payment/create', data)
export const simulatePaymentSuccess = (data: { orderId: string }) => api.post('/payment/simulate-success', data)
export const fakeDeposit = (data: { userId: string; amount: number }) => api.post('/wallet/fake-deposit', data)
export const transferWallet = (data: { fromUserId: string; toUserId: string; amount: number }) => api.post('/wallet/transfer', data)
export const getDepositById = (id: string) => api.get(`/wallet/deposit/${id}`)
