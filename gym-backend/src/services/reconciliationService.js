import Transaction from '../models/Transaction.js'
import Payment from '../models/Payment.js'
import ReconciliationDiscrepancy from '../models/ReconciliationDiscrepancy.js'

const createDiscrepancy = async ({ date, gateway, type, gatewayTransactionId, internalTransactionId, internalAmount, gatewayAmount, internalStatus, gatewayStatus, details }) => {
    return ReconciliationDiscrepancy.findOneAndUpdate(
        {
            date,
            gateway,
            type,
            gatewayTransactionId: gatewayTransactionId || '',
            internalTransactionId: internalTransactionId || null,
        },
        {
            $setOnInsert: {
                date,
                gateway,
                type,
                gatewayTransactionId: gatewayTransactionId || '',
                internalTransactionId: internalTransactionId || null,
                internalAmount,
                gatewayAmount,
                internalStatus,
                gatewayStatus,
                details,
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    )
}

export const reconcileGateway = async ({ gateway, internalTxns, gatewayTxns }) => {
    const reconciliationDate = new Date()
    reconciliationDate.setHours(0, 0, 0, 0)

    const internalByRef = new Map()
    for (const txn of internalTxns) {
        const ref = txn.referenceId || txn.idempotencyKey
        if (ref) internalByRef.set(String(ref), txn)
    }

    const gatewayByRef = new Map()
    for (const txn of gatewayTxns) {
        const ref = txn.txnRef || txn.id
        if (ref) gatewayByRef.set(String(ref), txn)
    }

    const allRefs = new Set([...internalByRef.keys(), ...gatewayByRef.keys()])

    for (const ref of allRefs) {
        const internal = internalByRef.get(ref)
        const gwTxn = gatewayByRef.get(ref)

        if (!internal && gwTxn) {
            await createDiscrepancy({
                date: reconciliationDate,
                gateway,
                type: 'missing_internal',
                gatewayTransactionId: gwTxn.id || gwTxn.txnRef,
                gatewayAmount: gwTxn.amount,
                gatewayStatus: gwTxn.status,
                details: `Gateway transaction ${ref} has no matching internal transaction`,
            })
            continue
        }

        if (internal && !gwTxn) {
            await createDiscrepancy({
                date: reconciliationDate,
                gateway,
                type: 'missing_gateway',
                internalTransactionId: internal._id,
                internalAmount: internal.amount,
                internalStatus: internal.status,
                details: `Internal transaction ${ref} has no matching gateway record`,
            })
            continue
        }

        if (internal && gwTxn) {
            const internalAmount = Math.abs(internal.amount) || 0
            const gatewayAmount = Math.abs(gwTxn.amount) || 0

            if (internalAmount !== gatewayAmount) {
                await createDiscrepancy({
                    date: reconciliationDate,
                    gateway,
                    type: 'amount_mismatch',
                    gatewayTransactionId: gwTxn.id || gwTxn.txnRef,
                    internalTransactionId: internal._id,
                    internalAmount,
                    gatewayAmount,
                    internalStatus: internal.status,
                    gatewayStatus: gwTxn.status,
                    details: `Amount mismatch: internal=${internalAmount}, gateway=${gatewayAmount}`,
                })
            }

            const internalMapped = internal.status === 'completed' ? 'completed' : internal.status
            const gatewayMapped = String(gwTxn.status || '').toLowerCase()
            if (internalMapped !== gatewayMapped && gatewayMapped !== '') {
                await createDiscrepancy({
                    date: reconciliationDate,
                    gateway,
                    type: 'status_mismatch',
                    gatewayTransactionId: gwTxn.id || gwTxn.txnRef,
                    internalTransactionId: internal._id,
                    internalAmount,
                    gatewayAmount,
                    internalStatus: internal.status,
                    gatewayStatus: gwTxn.status,
                    details: `Status mismatch: internal=${internalMapped}, gateway=${gatewayMapped}`,
                })
            }
        }
    }
}

export const runDailyReconciliation = async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const today = new Date(yesterday)
    today.setDate(today.getDate() + 1)

    const internalTxns = await Transaction.find({
        createdAt: { $gte: yesterday, $lt: today },
        status: 'completed',
    }).lean()

    const gatewayPayments = await Payment.find({
        createdAt: { $gte: yesterday, $lt: today },
        status: { $in: ['PAID', 'paid', 'REFUNDED', 'refunded'] },
    }).lean()

    const vnpayTxns = gatewayPayments.filter((p) => p.paymentMethod === 'VNPAY')
    const stripeTxns = gatewayPayments.filter((p) => p.paymentMethod === 'STRIPE')

    await reconcileGateway({
        gateway: 'vnpay',
        internalTxns,
        gatewayTxns: vnpayTxns.map((p) => ({
            txnRef: p.txnRef,
            amount: p.amount,
            status: p.status,
        })),
    })

    await reconcileGateway({
        gateway: 'stripe',
        internalTxns,
        gatewayTxns: stripeTxns.map((p) => ({
            txnRef: p.stripeSessionId,
            amount: p.amount,
            status: p.status,
        })),
    })

    const discrepancyCount = await ReconciliationDiscrepancy.countDocuments({
        date: yesterday,
        resolved: false,
    })

    return { date: yesterday, discrepancies: discrepancyCount }
}
