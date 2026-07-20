# Order Module

- **Owner**: Commerce Team
- **Dependencies**: Auth Module, Product Module, Payment Module, User Module
- **Related Documents**: STATE_MACHINES.md

## Purpose

Manage the complete order lifecycle from creation to delivery and returns. Integrates with GHN (Giao Hàng Nhanh) for shipping, tracking, and delivery status updates. Handles order feedback and return/refund workflows.

## Models

- **Order**: Core order entity. Fields include order number (human-readable, unique), userId, status, items total, shipping fee, discount, grand total, payment method, payment status, shipping address, shipping provider, tracking number, notes, and timestamps.
- **OrderItem**: Individual line items within an order. Fields include orderId, productId, variantId, quantity, unit price, total price, and product snapshot (preserved for historical accuracy).
- **OrderTracking**: Shipping tracking records. Fields include orderId, carrier (GHN), tracking number, status, location, timestamp, and raw provider webhook payload.
- **OrderReturn**: Return/refund requests. Fields include orderId, items returned, reason, return status (pending, approved, rejected, completed), refund amount, refund method, and resolution notes.

## Services

- **orderService**: Core order management. Handles order creation (cart checkout → order), status transitions, payment confirmation integration, and order queries. Enforces state machine rules.
- **orderTrackingService**: Shipping integration. Creates GHN shipment orders, polls/consumes webhooks for tracking updates, and synchronizes delivery status. Provides tracking timeline visible to users.
- **returnService**: Return and refund processing. Validates return eligibility (within policy window, item condition), manages return authorization, coordinates with payment module for refunds, and updates inventory on completion.

## Key Flows

1. **Place Order**: User checks out → orderService creates order with items, calculates totals, applies discounts → status becomes PENDING → redirect to payment.
2. **Payment Confirmation**: Payment webhook received → orderService confirms payment → status becomes CONFIRMED → inventory deducted → orderTrackingService creates GHN shipment.
3. **Shipping Update**: GHN webhook → orderTrackingService records tracking event → order status updated to SHIPPED → user notified.
4. **Delivery Confirmation**: GHN delivered webhook → order status → DELIVERED → feedback request sent to user.
5. **Return Request**: User requests return → returnService validates → return created with status PENDING → admin reviews → approved/rejected → on approval, refund processed → inventory restored.

### Order State Machine (see STATE_MACHINES.md for full diagram)

```
PENDING → CONFIRMED → SHIPPING → SHIPPED → DELIVERED
  |          |                                    |
  ↘ CANCELLED  ↘ CANCELLED                  ↘ RETURN_REQUESTED → RETURN_APPROVED → REFUNDED
                                                                        ↘ RETURN_REJECTED
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /orders | User | List current user's orders (paginated) |
| GET | /orders/admin | Admin | List all orders (paginated, filterable) |
| POST | /orders | User | Create order from cart |
| GET | /orders/:id | User | Get order details |
| PUT | /orders/:id/status | Admin | Update order status |
| POST | /orders/:id/feedback | User | Submit order feedback |
| GET | /orders/:id/tracking | User | Get tracking timeline |
| POST | /orders/:id/return | User | Request return |
| GET | /orders/returns/admin | Admin | List return requests |
| PUT | /orders/returns/:id | Admin | Approve/reject return |
| POST | /orders/:id/cancel | User | Cancel order (if eligible) |

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| ORD_001 | Order not found | Order ID does not exist |
| ORD_002 | Invalid status transition | Status change not allowed by state machine |
| ORD_003 | Order cannot be cancelled | Order is past cancellation window |
| ORD_004 | Return period expired | Return requested outside allowed window |
| ORD_005 | Item not in order | Return item does not belong to this order |
| ORD_006 | GHN API error | Failed to create/update shipment with carrier |
| ORD_007 | Insufficient stock | Not enough inventory to fulfill order |
| ORD_008 | Duplicate tracking number | Tracking number already in use |

## Future

- Multiple carrier support (GHN, GHTK, Viettel Post)
- Partial shipment (split order across multiple shipments)
- Reorder (one-click reorder from previous order)
- Order notes and seller-buyer messaging
- Automated return label generation
- COD (cash on delivery) payment flow
