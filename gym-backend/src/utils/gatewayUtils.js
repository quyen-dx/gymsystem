import crypto from 'crypto'

export const generateReferenceId = () => `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const buildQueryString = (payload) =>
    Object.keys(payload)
        .sort()
        .map((key) => `${key}=${payload[key]}`)
        .join('&')

export const signMomoPayload = (payload, secret) => {
    const raw = buildQueryString(payload)
    return crypto.createHmac('sha256', secret).update(raw).digest('hex')
}

export const verifyMomoSignature = (payload, signature, secret) => {
    if (!signature || !secret) return false
    return signMomoPayload(payload, secret) === signature
}

export const verifyVnPaySignature = (query, secret) => {
    const secureHash = query.vnp_SecureHash
    const hashType = query.vnp_SecureHashType || 'SHA256'
    if (!secureHash || !secret) return false
    const data = { ...query }
    delete data.vnp_SecureHash
    delete data.vnp_SecureHashType

    const rawData = Object.keys(data)
        .sort()
        .map((key) => `${key}=${data[key]}`)
        .join('&')

    const hash = crypto
        .createHash(hashType.toLowerCase())
        .update(secret + rawData)
        .digest('hex')

    return hash === secureHash
}

export const verifyZaloPaySignature = (payload, macKey) => {
    if (!macKey || !payload.mac) return false
    const data = `${payload.app_id}|${payload.apptransid}|${payload.pmcid}|${payload.amount}`
    const computed = crypto.createHmac('sha256', macKey).update(data).digest('hex')
    return computed === payload.mac
}

export const createPaymentQrCodeUrl = (provider, paymentData) => {
    let rawUrl = ''
    const amount = paymentData.amount
    const referenceId = paymentData.referenceId
    const payPayload = {
        provider,
        amount,
        referenceId,
        userId: paymentData.userId,
    }

    switch (provider) {
        case 'momo':
            rawUrl = `momo://pay?partnerCode=${paymentData.partnerCode || ''}&amount=${amount}&orderId=${referenceId}`
            break
        case 'vnpay':
            rawUrl = `vnpay://pay?amount=${amount}&orderId=${referenceId}`
            break
        case 'zalopay':
            rawUrl = `zalo://pay?amount=${amount}&orderId=${referenceId}`
            break
        case 'sandbox':
            rawUrl = `sandbox://pay?orderId=${referenceId}&amount=${amount}`
            break
        default:
            rawUrl = `https://pay.example.com/deposit?ref=${referenceId}&amount=${amount}`
    }

    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(rawUrl)}`
}

export const createProviderUrl = (provider, referenceId, amount) => {
    switch (provider) {
        case 'momo':
            return `momo://pay?amount=${amount}&orderId=${referenceId}`
        case 'vnpay':
            return `vnpay://pay?amount=${amount}&orderId=${referenceId}`
        case 'zalopay':
            return `zalo://pay?amount=${amount}&orderId=${referenceId}`
        default:
            return `https://pay.example.com/deposit?ref=${referenceId}&amount=${amount}`
    }
}
