# Shop Module

- **Owner**: Commerce Team
- **Dependencies**: Auth (User), Payment, Wallet
- **Related Documents**: [BUSINESS_RULES.md](../BUSINESS_RULES.md), [STATE_MACHINES.md](../STATE_MACHINES.md)

## Purpose
Manages the gym's merchandise and supplement e-commerce functionality including product catalog, shopping cart, order processing, inventory management, shipping, returns, and the escrow-based payment release system.

## Models
### Products
| Model | Description |
|---|---|
| `Product` | Product: name, description, price, images, SKU, status, tags |
| `ProductVariant` | Variant options: size, color, stock quantity, price override |
| `Category` | Product categories with hierarchy (parent/child) |
| `ProductReview` | Member reviews: rating, text, images, verified purchase flag |

### Orders
| Model | Description |
|---|---|
| `Order` | Order: member, items total, platform fee, grand total, status, shipping address |
| `OrderItem` | Individual line item: product, variant, quantity, unit price, platform fee |
| `OrderTracking` | Tracking events: status, location, timestamp, carrier, tracking number |
| `OrderReturn` | Return request: reason, photos, status, refund amount |

## Services
| Service | Key Methods |
|---|---|
| `productService` | `listProducts()`, `getProduct()`, `createProduct()`, `updateStock()`, `searchProducts()`, `getByCategory()` |
| `categoryService` | `listCategories()`, `createCategory()`, `updateCategory()`, `getTree()` |
| `cartService` | `getCart()`, `addItem()`, `updateItem()`, `removeItem()`, `clearCart()`, `applyDiscount()` |
| `orderService` | `createOrder()`, `getOrder()`, `listOrders()`, `updateStatus()`, `cancelOrder()`, `calculateTotals()` |
| `shippingService` | `getShippingMethods()`, `calculateShipping()`, `createShipment()`, `trackShipment()`, `confirmDelivery()` |

## Controllers
| Controller | Endpoints |
|---|---|
| `productController` | `GET /products`, `GET /products/:id`, CRUD `/admin/products` |
| `categoryController` | CRUD `/shop/categories` |
| `cartController` | `GET /cart`, `POST /cart/items`, `PUT /cart/items/:id`, `DELETE /cart/items/:id` |
| `orderController` | `GET /orders`, `POST /orders`, `GET /orders/:id`, `PUT /orders/:id/status`, `PUT /orders/:id/cancel` |
| `returnController` | `POST /orders/:id/return`, `PUT /admin/returns/:id/approve` |

## Business Rules
| Rule | Description |
|---|---|
| BR-SHP-001 | Inventory reservation on order creation, release on timeout/cancel |
| BR-SHP-002 | Platform fee: 2% of product price |
| BR-SHP-003 | Escrow holds payment until delivery confirmation |
| BR-SHP-004 | Return window: 7 days from delivery |
| BR-PAY-004 | Payment timeout: 30 minutes for Stripe |

## States
See STATE_MACHINES.md §3 — Order State Machine.

States: `PENDING` → `CONFIRMED` → `SHIPPING` → `DELIVERED` → `RETURNED` → `REFUNDED` / `CANCELLED`

## Key Flows

### Browse → Cart → Order → Payment → Ship → Deliver
1. Member browses products → `GET /products` with filters
2. Member adds items to cart → `POST /cart/items`
3. Member checks out → `POST /orders` (validates stock, reserves inventory per BR-SHP-001)
4. Order created with status `PENDING`
5. Payment initiated via Payment module
6. On payment success → status `CONFIRMED`, inventory permanently deducted
7. Seller ships → status `SHIPPING`, tracking attached
8. Member confirms delivery → status `DELIVERED`
9. Escrow period: 7 days (BR-SHP-003)
10. If no dispute → funds released to seller, status `COMPLETED`

### Return Flow
1. Member requests return within 7 days of delivery (BR-SHP-004)
2. Seller has 48 hours to approve/reject
3. If approved → member ships item back, seller inspects
4. On admin approval → refund processed, status `REFUNDED`

## API Endpoints
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/products` | Public | — | List products (filterable) |
| GET | `/products/:id` | Public | — | Get product details |
| POST | `/admin/products` | Required | Admin | Create product |
| PUT | `/admin/products/:id` | Required | Admin | Update product |
| DELETE | `/admin/products/:id` | Required | Admin | Delete product |
| GET | `/shop/categories` | Public | — | List categories |
| POST | `/shop/categories` | Required | Admin | Create category |
| PUT | `/shop/categories/:id` | Required | Admin | Update category |
| GET | `/cart` | Required | Member | Get current cart |
| POST | `/cart/items` | Required | Member | Add to cart |
| DELETE | `/cart/items/:id` | Required | Member | Remove from cart |
| GET | `/orders` | Required | Member, Admin | List orders |
| POST | `/orders` | Required | Member | Create order |
| GET | `/orders/:id` | Required | Member, Admin | Get order details |
| PUT | `/orders/:id/status` | Required | Admin | Update order status |
| PUT | `/orders/:id/cancel` | Required | Member | Cancel order |
| POST | `/orders/:id/return` | Required | Member | Request return |

## Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `PRODUCT_NOT_FOUND` | 404 | Product does not exist |
| `PRODUCT_OUT_OF_STOCK` | 409 | Product has zero available quantity |
| `ORDER_INVENTORY_INSUFFICIENT` | 409 | Not enough stock to fulfill order |
| `ORDER_NOT_SHIPPABLE` | 409 | Order state does not allow shipping |
| `ORDER_RETURN_WINDOW_CLOSED` | 422 | Return period has elapsed |

## Testing
- BR-SHP-001: create order → stock reserved; cancel → stock released; payment timeout → auto-release
- BR-SHP-002: platform fee calculated as FLOOR(price * 0.02 * qty), itemized on invoice
- BR-SHP-003: payment held in escrow; release after 7-day dispute window; dispute blocks release
- BR-SHP-004: return request >7 days → rejected; seller approval timeout at 48h
- Cart persistence across sessions
- Concurrent checkout: last-item race condition → one succeeds, one fails
- Order status transitions per state machine

## Future
- Flash sales / limited-time discounts
- Wishlist feature
- Bundle deals (product sets at discount)
- Digital products (e-gift cards, video workouts)
- Subscription / auto-reorder for supplements
- Loyalty points program
