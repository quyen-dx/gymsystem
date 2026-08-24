import crypto from 'node:crypto'
import { createVnpayPaymentUrl } from '../services/vnpayService.js'

const currentUrl = createVnpayPaymentUrl({
  amount: 10000,
  txnRef: `DIAG${Date.now()}`,
  orderInfo: 'Nap tien vi GymPro',
  ipAddr: '127.0.0.1',
})

const current = new URL(currentUrl)
const params = Object.fromEntries([...current.searchParams].filter(([key]) => key !== 'vnp_SecureHash'))
const officialStyleData = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&')
const officialStyleHash = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET)
  .update(Buffer.from(officialStyleData, 'utf8'))
  .digest('hex')
const officialStyleUrl = `${current.origin}${current.pathname}?${officialStyleData}&vnp_SecureHash=${officialStyleHash}`

const withoutIpn = { ...params }
delete withoutIpn.vnp_IpnUrl
const encoded = (value) => encodeURIComponent(String(value)).replace(/%20/g, '+')
const encodedWithoutIpnData = Object.keys(withoutIpn).sort().map((key) => `${encoded(key)}=${encoded(withoutIpn[key])}`).join('&')
const encodedWithoutIpnHash = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET)
  .update(Buffer.from(encodedWithoutIpnData, 'utf8'))
  .digest('hex')
const encodedWithoutIpnUrl = `${current.origin}${current.pathname}?${encodedWithoutIpnData}&vnp_SecureHash=${encodedWithoutIpnHash}`
const rawWithoutIpnData = Object.keys(withoutIpn).sort().map((key) => `${key}=${withoutIpn[key]}`).join('&')
const rawWithoutIpnHash = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET)
  .update(Buffer.from(rawWithoutIpnData, 'utf8'))
  .digest('hex')
const rawWithoutIpnUrl = `${current.origin}${current.pathname}?${rawWithoutIpnData}&vnp_SecureHash=${rawWithoutIpnHash}`
const buildEncodedUrl = (overrides = {}) => {
  const next = { ...withoutIpn, ...overrides }
  const data = Object.keys(next).sort().map((key) => `${encoded(key)}=${encoded(next[key])}`).join('&')
  const hash = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET).update(Buffer.from(data, 'utf8')).digest('hex')
  return `${current.origin}${current.pathname}?${data}&vnp_SecureHash=${hash}`
}

const probe = async (label, paymentUrl) => {
  const response = await fetch(paymentUrl, { redirect: 'follow' })
  const finalUrl = new URL(response.url)
  const html = await response.text()
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null
  console.log(JSON.stringify({
    label,
    status: response.status,
    finalHost: finalUrl.host,
    finalPath: finalUrl.pathname,
    errorCode: finalUrl.searchParams.get('code'),
    title,
    signatureError: html.includes('Sai chữ ký'),
    genericError: html.includes('Có lỗi xảy ra trong quá trình xử lý'),
    params: [...new URL(paymentUrl).searchParams.keys()].sort(),
    signaturePrefix: new URL(paymentUrl).searchParams.get('vnp_SecureHash')?.slice(0, 10),
  }))
}

await probe('current_encoded_signature', currentUrl)
await probe('official_style_raw_signature', officialStyleUrl)
await probe('encoded_signature_without_undocumented_ipn_param', encodedWithoutIpnUrl)
await probe('official_style_without_undocumented_ipn_param', rawWithoutIpnUrl)
await probe('documentation_example_return_url', buildEncodedUrl({
  vnp_ReturnUrl: 'https://domainmerchant.vn/ReturnUrl',
  vnp_TxnRef: `DIAGDOC${Date.now()}`,
}))
