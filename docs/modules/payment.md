# Payment Module

- **Owner**: Finance Team
- **Dependencies**: Auth (User), Membership, Wallet
- **Related Documents**: [BUSINESS_RULES.md](../BUSINESS_RULES.md), [STATE_MACHINES.md](../STATE_MACHINES.md), [ERROR_HANDLING.md](../ERROR_HANDLING.md)

## Purpose
Handles all financial transactions including membership purchase payments, booking fees, shop orders, and refunds. Integrates with VNPAY (Vietnamese gateway) and Stripe (international) for payment processing with webhook-based async confirmation.

## Models
| Model | Description |
|---|---|
| `Payment` | Payment record: amount, currency, gateway, status, idempotency key, metadata |
| `PaymentTransaction` | Individual gateway transaction log: request/response, gateway ref, status |
| `PaymentWebhook` | Incoming webhook event log: raw payload, signature, processing status |
| `Refund` | Refund record: original payment, amount, reason, admin approval status |
| `PaymentMethod` | Stored payment methods: card token, bank account, gateway customer ID |

## Services
| Service | Key Methods |
|---|---|
| `paymentService` | `createPayment()`, `processPayment()`, `handleWebhook()`, `getPaymentStatus()`, `retryPayment()` |
| `vnpayService` | `createPaymentUrl()`, `verifyReturn()`, `verifyIpn()`, `queryTransaction()` |
| `stripeService` | `createPaymentIntent()`, `confirmPayment()`, `handleWebhook()`, `createCustomer()` |
| `refundService` | `requestRefund()`, `processRefund()`, `calculateRefund()`, `approveRefund()`, `getRefundHistory()` |

## Controllers
| Controller | Endpoints |
|---|---|
| `paymentController` | `POST /payment/create`, `GET /payment/vnpay-return` |
| `webhookController` | `POST /payment/stripe/webhook`, `POST /payment/vnpay/webhook` |
| `refundController` | `POST /payment/refund`, `GET /payment/refunds` |

## Business Rules
| Rule | Description |
|---|---|
| BR-PAY-001 | All financial transactions must be atomic (wallet + order) |
| BR-PAY-002 | Payment idempotency key required for all transactions |
| BR-PAY-003 | Refund must go to original payment method or wallet |
| BR-PAY-004 | VNPAY timeout: 15 minutes; Stripe: 30 minutes |
| BR-PAY-005 | Minimum payment: 1,000 VND (or equivalent) |
| BR-MEM-006 | Refund calculation for membership cancellations |
| BR-ADM-001 | Admin approval required for refunds above 1,000,000 VND |

## States
See STATE_MACHINES.md §4 — Payment State Machine.

States: `INITIATED` → `PROCESSING` → `COMPLETED` / `FAILED` → `REFUNDED` / `PARTIAL_REFUND`

## Key Flows

### Initiate → Process → Webhook → Complete/Fail
1. Client requests payment → `POST /payment/create` (includes idempotency key per BR-PAY-002)
2. Validate minimum amount (BR-PAY-005)
3. Payment created with status `INITIATED`
4. Gateway URL generated (VNPAY payment URL / Stripe PaymentIntent)
5. Client redirected to gateway
6. User completes payment on gateway page
7. Gateway sends async webhook → `POST /payment/:gateway/webhook`
8. Verify webhook signature, check idempotency
9. If success → status `COMPLETED`, trigger order/membership activation
10. If fail → status `FAILED`, release holds
11. If timeout (BR-PAY-004) → status `TIMEOUT`, release reservations

### Refund Flow
1. Refund requested (via cancellation service or admin)
2. If refund > 1,000,000 VND → create admin approval request (BR-ADM-001)
3. On approval → calculate amount per BR-MEM-006
4. Process refund to original payment method (BR-PAY-003)
5. If original method unavailable → credit wallet

## API Endpoints
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/payment/create` | Required | Member | Create payment request |
| GET | `/payment/vnpay-return` | Public | — | VNPAY return URL (redirect) |
| POST | `/payment/stripe/webhook` | Public* | — | Stripe webhook endpoint |
| POST | `/payment/vnpay/webhook` | Public* | — | VNPAY IPN webhook endpoint |
| POST | `/payment/refund` | Required | Admin, Finance | Process refund |
| GET | `/payment/refunds` | Required | Admin, Finance | List refunds |

*Webhook endpoints validated via gateway signature, not JWT.

## Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `PAYMENT_FAILED` | 422 | Gateway declined the transaction |
| `PAYMENT_TIMEOUT` | 504 | Gateway did not respond in time |
| `PAYMENT_EXPIRED` | 410 | Payment intent expired before completion |
| `PAYMENT_IDEMPOTENCY_MISMATCH` | 409 | Idempotency key re-used with different payload |

## Testing
- BR-PAY-001: simulate partial failure → wallet rollback verified
- BR-PAY-002: duplicate idempotency key → same response returned
- BR-PAY-003: refund to original method; fallback to wallet
- BR-PAY-004: VNPAY timeout at 15min, Stripe at 30min
- BR-PAY-005: payment <1,000 VND → rejected
- Webhook: invalid signature → rejected; replay attack prevention
- VNPAY return URL verification (checksum + order info)
- Stripe webhook idempotency + event ordering

## Future
- Additional gateways (Momo, Zalopay, PayPal)
- Recurring payment / auto-renewal
- Multi-currency support
- Payouts to PTs (trainer commission)
- Invoice generation and PDF download
