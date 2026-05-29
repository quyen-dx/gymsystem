export interface BankInfo {
  bankId: string
  accountNumber: string
  accountName: string
  branch: string
}

export interface DepositRequest {
  amount: number
  bankId: string
  userId: string
}

export interface DepositResponse {
  transactionId: string
  transferContent: string
  expiredAt: string
  amount?: number
}

export interface DepositConfirmRequest {
  transactionId: string
}

export type BankOption = 'VCB' | 'MB' | 'TECHCOMBANK'

export interface BankMeta {
  id: string
  name: string
  shortName: string
  logo: string
}

export const BANKS: Record<BankOption, BankMeta> = {
  VCB: { id: '970436', name: 'Vietcombank', shortName: 'VCB', logo: 'https://api.vietqr.io/img/VCB.png' },
  MB: { id: '970422', name: 'MB Bank', shortName: 'MB', logo: 'https://api.vietqr.io/img/MB.png' },
  TECHCOMBANK: { id: '970407', name: 'Techcombank', shortName: 'Techcombank', logo: 'https://api.vietqr.io/img/TCB.png' },
}

export const PRESET_AMOUNTS = [100000, 200000, 500000, 1000000]
