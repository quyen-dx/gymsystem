import { createDepositRequest, getDepositById, getSandboxPaymentByOrderId, processProviderWebhook, simulateSandboxPaymentSuccess } from '../services/paymentService.js'

export const createDeposit = async (req, res, next) => {
    try {
        const { amount, provider } = req.body
        const payment = await createDepositRequest({
            userId: req.user._id,
            amount: Number(amount),
            provider,
        })
        return res.status(201).json({ success: true, data: payment })
    } catch (error) {
        next(error)
    }
}

export const createSandboxPayment = async (req, res, next) => {
    try {
        const { amount } = req.body
        const payment = await createDepositRequest({
            userId: req.user._id,
            amount: Number(amount),
            provider: 'sandbox',
        })
        return res.status(201).json({
            success: true,
            data: {
                orderId: payment.referenceId,
                qrData: payment.qrCodeUrl,
                expiresAt: payment.expiresAt,
                status: payment.status,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const simulateSandboxPayment = async (req, res, next) => {
    try {
        const { orderId } = req.body
        const result = await simulateSandboxPaymentSuccess(orderId)
        return res.json({ success: true, data: result })
    } catch (error) {
        next(error)
    }
}

export const getSandboxPayment = async (req, res, next) => {
    try {
        const payment = await getSandboxPaymentByOrderId(req.params.orderId)
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Yêu cầu thanh toán không tìm thấy' })
        }
        return res.json({ success: true, data: payment })
    } catch (error) {
        next(error)
    }
}

export const getDeposit = async (req, res, next) => {
    try {
        const payment = await getDepositById(req.params.id)
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Deposit request not found' })
        }
        if (payment.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập' })
        }
        return res.json({ success: true, data: payment })
    } catch (error) {
        next(error)
    }
}

export const handlePaymentWebhook = async (req, res, next) => {
    try {
        const provider = req.params.provider
        const result = await processProviderWebhook(provider, req.body, req.headers)
        return res.json({ success: true, data: result })
    } catch (error) {
        next(error)
    }
}
