import crypto from 'crypto'
import { getBackendUrl } from '../config/appUrls.js'
import AppError from '../utils/appError.js'

const VNPAY_VERSION = '2.1.0'

const formatDate = (date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value
    return result
  }, {})

  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`
}

const encodeValue = (value) => encodeURIComponent(String(value)).replace(/%20/g, '+')

const sortParams = (params) => Object.keys(params)
  .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
  .sort()
  .reduce((result, key) => {
    result[key] = params[key]
    return result
  }, {})

const stringifyParams = (params) => Object.entries(sortParams(params))
  .map(([key, value]) => `${encodeValue(key)}=${encodeValue(value)}`)
  .join('&')

const signParams = (params, secretKey) => crypto
  .createHmac('sha512', secretKey)
  .update(Buffer.from(stringifyParams(params), 'utf-8'))
  .digest('hex')

const getRequiredConfig = () => {
  const tmnCode = process.env.VNPAY_TMN_CODE
  const hashSecret = process.env.VNPAY_HASH_SECRET
  const paymentUrl = process.env.VNPAY_PAYMENT_URL
  if (!tmnCode || !hashSecret || !paymentUrl) {
    throw new AppError('VNPAY chưa được cấu hình VNPAY_TMN_CODE/VNPAY_HASH_SECRET/VNPAY_PAYMENT_URL', 500)
  }
  return {
    tmnCode,
    hashSecret,
    paymentUrl,
  }
}

export const createVnpayPaymentUrl = ({ amount, txnRef, orderInfo, ipAddr, locale = 'vn', bankCode }) => {
  const { tmnCode, hashSecret, paymentUrl } = getRequiredConfig()
  const returnUrl = process.env.VNPAY_RETURN_URL || `${getBackendUrl()}/api/wallet/vnpay-return`
  const createDate = formatDate(new Date())
  const expireDate = formatDate(new Date(Date.now() + 15 * 60 * 1000))

  const params = {
    vnp_Version: VNPAY_VERSION,
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Amount: Math.round(Number(amount) * 100),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: locale,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr || '127.0.0.1',
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
  }

  if (bankCode) params.vnp_BankCode = bankCode

  const secureHash = signParams(params, hashSecret)
  return `${paymentUrl}?${stringifyParams({ ...params, vnp_SecureHash: secureHash })}`
}

export const verifyVnpayReturn = (query) => {
  const { hashSecret } = getRequiredConfig()
  const params = { ...query }
  const secureHash = params.vnp_SecureHash
  delete params.vnp_SecureHash
  delete params.vnp_SecureHashType

  if (!secureHash) return false
  return secureHash.toLowerCase() === signParams(params, hashSecret).toLowerCase()
}
