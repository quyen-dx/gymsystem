# Error Handling Strategy — GymPro Gym Management System

> **Version:** 1.0  
> **Last Updated:** 2026-07-20  
> **Owner:** Platform Team

---

## 1. Standard Error Response Format

Every error response returned by the API **MUST** conform to the following JSON structure:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": {
    "code": "ERROR_CODE",
    "details": "Specific details (only in development)",
    "field": "fieldName (for validation errors)",
    "timestamp": "2026-07-20T10:30:00.000Z",
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

| Field       | Description                                                                  |
|-------------|------------------------------------------------------------------------------|
| `success`   | Always `false` for error responses.                                          |
| `message`   | Safe, user-facing message. Never contains stack traces or internal details.  |
| `error`     | Machine-readable error envelope.                                             |
| `code`      | Unique error code from the taxonomy (§2).                                    |
| `details`   | Detailed technical info. **Only included when `NODE_ENV=development`.**      |
| `field`     | The input field that caused the error. Present **only** for validation errors. |
| `timestamp` | ISO 8601 UTC timestamp of when the error occurred.                           |
| `requestId` | Correlation ID generated per request. Included in every response.            |

---

## 2. Error Code Taxonomy

Error codes follow the format `[MODULE]_[ERROR_TYPE]`. Codes are unique, immutable, and must never be reused or re-purposed.

### Authentication & Authorization
| Code                              | Description                              | HTTP Status |
|-----------------------------------|------------------------------------------|-------------|
| `AUTH_INVALID_TOKEN`              | Token is malformed or tampered with      | 401         |
| `AUTH_TOKEN_EXPIRED`              | Token has passed its expiry              | 401         |
| `AUTH_INSUFFICIENT_PERMISSIONS`   | User lacks required role/scope           | 403         |
| `AUTH_USER_NOT_FOUND`             | User record does not exist               | 404         |

### Membership
| Code                              | Description                              | HTTP Status |
|-----------------------------------|------------------------------------------|-------------|
| `MEMBERSHIP_NOT_FOUND`            | Membership record not found              | 404         |
| `MEMBERSHIP_EXPIRED`              | Membership has passed end date           | 422         |
| `MEMBERSHIP_ALREADY_ACTIVE`       | User already holds an active membership  | 409         |
| `MEMBERSHIP_MAX_RENEWAL`          | Renewal limit reached for this plan      | 422         |
| `MEMBERSHIP_INVALID_STATE`        | Membership status transition not allowed | 409         |

### Booking
| Code                              | Description                              | HTTP Status |
|-----------------------------------|------------------------------------------|-------------|
| `BOOKING_SLOT_UNAVAILABLE`        | Requested time slot is fully booked      | 409         |
| `BOOKING_TIME_CONFLICT`           | Overlapping booking exists               | 409         |
| `BOOKING_PAST_CANCELLATION`       | Cancellation window has passed           | 422         |
| `BOOKING_MEMBERSHIP_REQUIRED`     | Active membership needed to book         | 403         |

### Check-In
| Code                              | Description                              | HTTP Status |
|-----------------------------------|------------------------------------------|-------------|
| `CHECKIN_INVALID_QR`              | QR code is unrecognized or forged        | 400         |
| `CHECKIN_ALREADY_CHECKED`         | Member already checked in for this slot  | 409         |
| `CHECKIN_MEMBERSHIP_EXPIRED`      | Membership expired at time of check-in   | 403         |
| `CHECKIN_OUTSIDE_HOURS`           | Check-in attempted outside facility hours| 422         |

### Payment
| Code                              | Description                              | HTTP Status |
|-----------------------------------|------------------------------------------|-------------|
| `PAYMENT_FAILED`                  | Payment gateway declined the transaction | 422         |
| `PAYMENT_TIMEOUT`                 | Payment gateway did not respond in time  | 504         |
| `PAYMENT_EXPIRED`                 | Payment intent expired before completion | 410         |
| `PAYMENT_IDEMPOTENCY_MISMATCH`    | Idempotency key re-used with different payload | 409  |

### Wallet
| Code                              | Description                              | HTTP Status |
|-----------------------------------|------------------------------------------|-------------|
| `WALLET_INSUFFICIENT_BALANCE`     | Wallet balance below required amount     | 422         |
| `WALLET_NEGATIVE_TRANSACTION`     | Transaction would result in negative balance | 422      |

### Order
| Code                              | Description                              | HTTP Status |
|-----------------------------------|------------------------------------------|-------------|
| `ORDER_INVENTORY_INSUFFICIENT`    | Not enough stock to fulfill order        | 409         |
| `ORDER_NOT_SHIPPABLE`             | Order is in a state that does not allow shipping | 409  |
| `ORDER_RETURN_WINDOW_CLOSED`      | Return period has elapsed                | 422         |

### Product
| Code                              | Description                              | HTTP Status |
|-----------------------------------|------------------------------------------|-------------|
| `PRODUCT_NOT_FOUND`               | Product does not exist                   | 404         |
| `PRODUCT_OUT_OF_STOCK`            | Product has zero available quantity      | 409         |

### Validation
| Code                              | Description                              | HTTP Status |
|-----------------------------------|------------------------------------------|-------------|
| `VALIDATION_REQUIRED_FIELD`       | Mandatory field missing                  | 400         |
| `VALIDATION_INVALID_FORMAT`       | Field value fails format/regex check     | 400         |
| `VALIDATION_OUT_OF_RANGE`         | Numeric/date value out of allowed range  | 400         |

### System
| Code                              | Description                              | HTTP Status |
|-----------------------------------|------------------------------------------|-------------|
| `SYSTEM_DATABASE_ERROR`           | Database connection or query failure     | 500         |
| `SYSTEM_RATE_LIMIT`               | Request rate threshold exceeded          | 429         |
| `SYSTEM_INTERNAL_ERROR`           | Unhandled or unexpected error            | 500         |
| `SYSTEM_MAINTENANCE_MODE`         | System is under maintenance              | 503         |

---

## 3. HTTP Status Code Mapping

| Status | Description               | When to Use                                                   |
|--------|---------------------------|---------------------------------------------------------------|
| 200    | Success (with errors)     | Non-critical operations return errors inside a 200 body.      |
| 400    | Bad Request               | Validation failures, malformed input, missing fields.         |
| 401    | Unauthorized              | Missing token, expired token, invalid token.                  |
| 403    | Forbidden                 | Token valid but insufficient permissions or membership.       |
| 404    | Not Found                 | Resource does not exist (user, membership, product, etc.).    |
| 409    | Conflict                  | Duplicate key, state conflict, slot taken, already checked in.|
| 410    | Gone                      | Resource is permanently unavailable (e.g., expired payment).  |
| 422    | Unprocessable Entity      | Business rule violation (expired membership, past cancellation).|
| 429    | Too Many Requests         | Rate limit exceeded. Body includes `Retry-After` header.      |
| 500    | Internal Server Error     | Unhandled exception, database failure, unexpected crash.      |
| 503    | Service Unavailable       | Maintenance mode, dependency outage.                          |
| 504    | Gateway Timeout           | External payment or third-party timeout.                      |

---

## 4. Global Error Handler — Express Middleware

A single **central error-handling middleware** MUST be registered **after** all routes:

```javascript
// app.use(errorHandler)
// Signature: (err, req, res, next) => { ... }
```

| Input Error Type             | Normalized Status | Code                         |
|------------------------------|-------------------|------------------------------|
| `CastError` (Mongoose)       | 400               | `VALIDATION_INVALID_FORMAT`  |
| `ValidationError` (Mongoose) | 422               | `VALIDATION_REQUIRED_FIELD`  |
| Duplicate key (Mongoose 11000)| 409              | `[MODULE]_DUPLICATE_ENTRY`   |
| `TokenExpiredError` (JWT)    | 401               | `AUTH_TOKEN_EXPIRED`         |
| `JsonWebTokenError` (JWT)    | 401               | `AUTH_INVALID_TOKEN`         |
| Custom `AppError`            | As defined        | As defined                   |
| Unhandled `Error`            | 500               | `SYSTEM_INTERNAL_ERROR`      |

**Golden rules:**

1. If `err` is a known `AppError` subclass → use its own status code + error code.
2. If `err` is a Mongoose/JWT known type → normalize as per table above.
3. Otherwise → respond `500 SYSTEM_INTERNAL_ERROR`. **Never leak stack traces in production.**
4. Always attach `requestId` from `req.id` to the response.
5. Always set `error.details = err.stack` only when `NODE_ENV === 'development'`.

### Socket.io Error Handling

Socket.io connections must emit errors as structured events:

```json
{
  "event": "error",
  "data": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "Authentication failed"
  }
}
```

- Authentication errors during handshake → disconnect with reason.
- Business errors during socket operations → emit `error` event to the requesting client.
- Unhandled exceptions → log, emit generic error, do not crash the process.

### Unhandled Rejections & Uncaught Exceptions

```javascript
process.on('unhandledRejection', (reason) => {
  logger.error({ message: 'Unhandled Rejection', error: reason });
  process.exit(1); // PM2 will auto-restart
});

process.on('uncaughtException', (err) => {
  logger.error({ message: 'Uncaught Exception', error: err });
  process.exit(1); // PM2 will auto-restart
});
```

---

## 5. Per-Layer Error Handling

### 5.1 Controller Layer

| Rule                                                         | Detail                                                       |
|--------------------------------------------------------------|--------------------------------------------------------------|
| **Wrap every async handler**                                 | Use the `catchAsync` utility.                                |
| `catchAsync` pattern                                         | `fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)` |
| **Never log in controllers**                                 | Controllers delegate all logging to services or middleware.  |
| **Never catch in controllers**                               | Let errors propagate to the global handler via `next(err)`.  |
| **Only send responses**                                      | Controllers call `res.json()` or `res.status().json()`.      |

### 5.2 Service Layer

| Rule                                                         | Detail                                                       |
|--------------------------------------------------------------|--------------------------------------------------------------|
| **Throw typed errors**                                       | Instantiate and throw `AppError` subclasses with a valid error code. |
| **Log at service boundary**                                  | Use `logger.warn()` for handled business errors, `logger.error()` for unexpected failures. |
| **Retry transient failures**                                 | External calls (DB queries, payment gateway, 3rd-party APIs) use retry with exponential backoff. |
| **Never expose internals**                                   | Error messages in thrown exceptions must be user-safe. Internal details go into a separate `meta` property. |

### 5.3 Model Layer (Mongoose)

| Rule                                                         | Detail                                                       |
|--------------------------------------------------------------|--------------------------------------------------------------|
| **Validation errors**                                        | Mongoose `ValidationError` → normalised to `400` or `422` by global handler. |
| **CastError**                                                | Invalid `ObjectId` → `400` with `code: "VALIDATION_INVALID_FORMAT"`. |
| **Duplicate key**                                            | MongoDB error code `11000` → `409` with module-specific code. |
| **Custom pre-save validation**                               | Throw `AppError` from `pre('save')` hooks for domain rules that Mongoose validators cannot express. |

### 5.4 Middleware Layer

| Middleware            | Behaviour                                                                    |
|-----------------------|------------------------------------------------------------------------------|
| **Auth middleware**   | Extract JWT from `Authorization: Bearer <token>`. Verify → attach `req.user` or throw `AUTH_INVALID_TOKEN` / `AUTH_TOKEN_EXPIRED`. |
| **Role guard**        | Check `req.user.role` against required roles. Throw `AUTH_INSUFFICIENT_PERMISSIONS` (403). |
| **Rate limiter**      | Enforce request cap per IP/user. Respond `429` with `Retry-After` header. Code: `SYSTEM_RATE_LIMIT`. |
| **Maintenance mode**  | Read maintenance flag (env / DB). Respond `503` with `SYSTEM_MAINTENANCE_MODE`. |
| **Request ID**        | Generate `uuid` per request. Attach to `req.id` and include in every log entry and response. |

---

## 6. Error Logging Strategy

### Logger Service (Winston)

All logs are **structured JSON** written to stdout (production) and files (development).

| Level   | Usage                                                       |
|---------|-------------------------------------------------------------|
| `error` | Unhandled exceptions, database failures, 5xx responses.     |
| `warn`  | Handled business errors (4xx), validation failures.         |
| `info`  | Successful transactions, payment confirmations, state changes. |
| `debug` | Development-only details. Never enabled in production.      |

### Log Envelope

Every log entry **MUST** include:

```json
{
  "timestamp": "2026-07-20T10:30:00.000Z",
  "level": "error",
  "message": "Human-readable summary",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "60f...",
  "errorCode": "SYSTEM_DATABASE_ERROR",
  "stack": "   at ... (only in development)",
  "meta": {}
}
```

### Audit Trail

- All mutations to sensitive resources (membership, payment, wallet) log `userId`, `resourceId`, `action`, and `diff`.
- Authentication events (login, logout, token refresh) are always logged at `info` level.

### Sanitization — NEVER LOG

- User passwords (plaintext or hashed).
- Full JWT tokens (log `tokenId` or a prefix + last 4 chars only).
- Payment card numbers, CVV, or raw gateway responses containing PAN data.
- Personally identifiable information (PII) beyond userId.

---

## 7. Error Response Examples

### Validation Error

```json
{
  "success": false,
  "message": "Email is required",
  "error": {
    "code": "VALIDATION_REQUIRED_FIELD",
    "details": "body.email is a mandatory field",
    "field": "email",
    "timestamp": "2026-07-20T10:30:00.000Z",
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

### Authentication Error

```json
{
  "success": false,
  "message": "Your session has expired. Please login again.",
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "timestamp": "2026-07-20T10:30:00.000Z",
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

### Business Rule Violation

```json
{
  "success": false,
  "message": "This time slot is no longer available.",
  "error": {
    "code": "BOOKING_SLOT_UNAVAILABLE",
    "timestamp": "2026-07-20T10:30:00.000Z",
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

### System Error

```json
{
  "success": false,
  "message": "System is temporarily unavailable. Please try again.",
  "error": {
    "code": "SYSTEM_DATABASE_ERROR",
    "timestamp": "2026-07-20T10:30:00.000Z",
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

---

## 8. Client-Side Error Handling

### Axios Interceptor

A single response interceptor handles all API errors globally:

| Status | Behaviour                                                                    |
|--------|------------------------------------------------------------------------------|
| 401    | Clear stored tokens. Redirect to `/login`.                                   |
| 403    | Show toast notification: *"You do not have permission to perform this action."* |
| 422    | Extract `error.field` → set per-field validation error on the form.          |
| 429    | Read `Retry-After` header. Retry request after delay with exponential backoff (max 3 retries). |
| 5xx    | Show generic error toast. Log incident to monitoring.                        |

### React Query (TanStack Query)

```javascript
// Global default onError
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { onError: handleGlobalError },
    mutations: { onError: handleGlobalError },
  },
});
```

- Per-mutation `onError` for fine-grained handling (e.g., refetch inventory after an order failure).
- `onSuccess` + `onSettled` invalidation patterns for cache consistency.

### User-Facing Notifications

| Context                | Component               | Dismiss | Auto-Close |
|------------------------|-------------------------|---------|------------|
| Global API errors      | Toast (top-right)       | Manual  | 5 seconds  |
| Per-field validation   | Inline below form field | Manual  | Never      |
| Idempotent mutations   | Success toast           | Manual  | 3 seconds  |

### Form Validation

- Each form field displays its error from the `field` property in the error response.
- Fields must clear their error state on change.
- Submission is blocked while any field is in an error state.

---

> **References**
>
> - Error codes are defined as constants in `src/constants/errorCodes.js`.
> - The `AppError` base class lives in `src/utils/AppError.js`.
> - The global error handler middleware is `src/middleware/errorHandler.js`.
> - Client interceptor lives in `src/api/httpClient.js`.
