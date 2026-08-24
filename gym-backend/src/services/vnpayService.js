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

// VNPay hash được tính trên chuỗi query RAW mà nó echo về. Phụ thuộc phiên bản VNPay,
// dấu cách có thể được encode thành "+" hoặc "%20" → nếu orderInfo chứa ký tự cần
// encode (khoảng trắng, ký tự đặc biệt), chữ ký bên gửi và bên nhận sẽ lệch nhau.
// Chuẩn hóa orderInfo chỉ giữ ký tự ASCII an toàn (không cần encode) để chữ ký
// không bị ảnh hưởng bởi cách VNPay encode.
const sanitizeOrderInfo = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9_-]/g, '_')
  .slice(0, 250)

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
    vnp_OrderInfo: sanitizeOrderInfo(orderInfo),
    vnp_OrderType: 'other',
    vnp_Locale: locale,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr || '127.0.0.1',
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
  }

  if (bankCode) params.vnp_BankCode = bankCode

  // IPN is configured for the merchant with VNPay, not appended to a PAY
  // request. `vnp_IpnUrl` is not in the official PAY parameter list and the
  // sandbox returns Error code 99 when it is supplied for this merchant.

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
  const expected = String(secureHash).toLowerCase()

  // VNPay có thể encode dấu cách thành "+" hoặc "%20" khi echo query về.
  // Kiểm tra cả 2 dạng để tránh false-negative signature dù giao dịch thật thành công.
  if (expected === signParams(params, hashSecret).toLowerCase()) return true

  const strictEncode = (value) => encodeURIComponent(String(value))
  const stringifyStrict = (input) => Object.entries(sortParams(input))
    .map(([key, value]) => `${strictEncode(key)}=${strictEncode(value)}`)
    .join('&')
  const signStrict = (input, secretKey) => crypto
    .createHmac('sha512', secretKey)
    .update(Buffer.from(stringifyStrict(input), 'utf-8'))
    .digest('hex')

  return expected === signStrict(params, hashSecret).toLowerCase()
}
