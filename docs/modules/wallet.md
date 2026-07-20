# Wallet Module

- **Owner**: Finance Team
- **Dependencies**: Auth (User), Payment
- **Related Documents**: [BUSINESS_RULES.md](../BUSINESS_RULES.md), [ERROR_HANDLING.md](../ERROR_HANDLING.md)

## Purpose
Provides an internal digital wallet for each member used for fee deductions (late cancellation penalties, booking fees), refunds, deposits, and withdrawals. Supports transfer between members and maintains an immutable, dual-entry audit trail for all transactions.

## Models
| Model | Description |
|---|---|
| `Wallet` | Member wallet: balance, member reference, status, daily/monthly limits |
| `WalletTransaction` | Immutable transaction log: amount, type, reference, counterparty, description, dual-entry ledger ref |

## Services
| Service | Key Methods |
|---|---|
| `walletService` | `getBalance()`, `deposit()`, `withdraw()`, `transfer()`, `hold()`, `release()`, `freeze()`, `unfreeze()` |
| `transactionService` | `listTransactions()`, `getTransaction()`, `exportStatement()`, `reconcile()` |

## Controllers
| Controller | Endpoints |
|---|---|
| `walletController` | `GET /wallet`, `POST /wallet/deposit`, `POST /wallet/withdraw`, `POST /wallet/transfer`, `GET /wallet/transactions` |

## Business Rules
| Rule | Description |
|---|---|
| BR-WAL-001 | Wallet balance cannot go negative |
| BR-WAL-002 | Withdrawal requires identity verification |
| BR-WAL-003 | Transaction history immutable (append-only) |
| BR-WAL-004 | Dual-entry booking required for all transactions |
| BR-PAY-001 | All financial transactions must be atomic (wallet + order) |

## States
Wallet statuses: `active`, `frozen`, `closed`. Transaction types: `deposit`, `withdrawal`, `payment`, `refund`, `transfer_in`, `transfer_out`, `fee`, `correction`, `hold`, `release`.

## Key Flows

### Deposit → Balance Update
1. Member initiates deposit → `POST /wallet/deposit`
2. Payment created via Payment module
3. On payment success → `walletService.deposit()` called
4. Dual-entry: debit gateway account, credit member wallet (BR-WAL-004)
5. Balance updated, transaction recorded (immutable, BR-WAL-003)
6. Member receives confirmation with new balance

### Withdraw → Freeze → Release
1. Member requests withdrawal → `POST /wallet/withdraw`
2. Check identity verification (BR-WAL-002)
3. Check balance sufficiency (BR-WAL-001)
4. Amount frozen (held) in wallet: balance -= amount, hold += amount
5. Admin approval request created
6. On admin approve → hold released, withdrawal processed to bank
7. On admin reject → hold released back to available balance

### Transfer Between Members
1. Sender initiates transfer → `POST /wallet/transfer`
2. Validate sender balance (BR-WAL-001)
3. Atomic dual-entry: debit sender, credit receiver (BR-WAL-004)
4. Both transactions recorded with counterparty reference
5. Both members notified

## API Endpoints
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/wallet` | Required | Member | Get wallet balance and info |
| POST | `/wallet/deposit` | Required | Member | Deposit funds (redirects to payment) |
| POST | `/wallet/withdraw` | Required | Member | Request withdrawal |
| POST | `/wallet/transfer` | Required | Member | Transfer to another member |
| GET | `/wallet/transactions` | Required | Member | List transaction history |

## Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `WALLET_INSUFFICIENT_BALANCE` | 422 | Balance below required amount |
| `WALLET_NEGATIVE_TRANSACTION` | 422 | Transaction would result in negative balance |

## Testing
- BR-WAL-001: attempt to spend more than balance → rejected
- BR-WAL-002: withdrawal without ID verification → rejected; exceeding monthly limit → rejected
- BR-WAL-003: attempt to DELETE transaction → blocked at DB level; correction via offsetting entry
- BR-WAL-004: dual-entry check → every transaction has matching debit/credit
- Atomicity: wallet + order update in single transaction (BR-PAY-001)
- Concurrent withdrawal and payment: race condition prevention via optimistic locking
- Frozen wallet: all outbound operations blocked

## Future
- Auto-deposit / scheduled top-up
- Wallet-to-bank transfer automation
- Virtual prepaid card for wallet spending
- Multi-currency wallet support
- Interest on wallet balance (savings feature)
