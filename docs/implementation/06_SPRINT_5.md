# Sprint 5: Commerce

> **Sprint Duration:** 2 weeks  
> **Sprint Number:** 5 of 5  
> **Target Release:** v1.5.0 — Commerce Release  
> **Status:** Planning

---

## 1. Sprint Goal

Implement the end-to-end e-commerce platform: product catalog with variants and review system, atomic inventory management with reservation, shopping cart with server-side synchronisation, order lifecycle with GHN shipping integration, and escrow-based seller payouts with 7-day dispute window.

---

## 2. Business Objectives

- Enable sellers to list products with variants (size, color, SKU) and manage inventory
- Allow members to browse, search, and filter the product catalog by category, price, rating
- Implement a server-side shopping cart with price-locked checkout to prevent price drift
- Build the full order lifecycle: PENDING → CONFIRMED → SHIPPING → DELIVERED → (RETURNED → REFUNDED) / CANCELLED
- Integrate GHN (Giao Hàng Nhanh) for real-time shipping rate calculation, order creation, tracking, and delivery confirmation
- Implement atomic inventory management with 30-minute reservation TTL for unpaid orders
- Build escrow-based payment release: funds held until delivery confirmed + 7-day dispute window
- Provide seller dashboard with revenue, order, and product analytics

---

## 3. Modules Included

| Module | Path | Owner |
|--------|------|-------|
| Shop | `docs/modules/shop.md` | Commerce Team |
| Product | `docs/modules/product.md` | Commerce Team |
| Order | `docs/modules/order.md` | Commerce Team |
| Upload | `docs/modules/upload.md` | Core Services Team |

---

## 4. Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 1 — Auth & Membership | Must be complete | User roles (seller, member, admin), wallet |
| Sprint 2 — Payment | Must be complete | VNPAY/Stripe integration, wallet transactions, refund pipeline |
| Upload Module | Must be complete | Cloudinary integration for product images, return evidence photos |
| GHN API Credentials | Must be provisioned | Sandbox token for testing; production token for go-live |
| MongoDB Replica Set | Must be configured | Required for inventory atomic operations and order transactions |

---

## 5. Prerequisites

- [ ] User module: `member`, `seller`, `staff`, `admin`, `super_admin` roles with JWT auth
- [ ] Payment module: VNPAY and Stripe gateways operational; wallet deposit/withdrawal functional
- [ ] Wallet module: `wallets` and `wallet_transactions` with atomic `$inc` operations
- [ ] Upload module: Cloudinary integration for image uploads (product images, return evidence)
- [ ] GHN API sandbox access: test tokens for rate calculation, order creation, tracking
- [ ] MongoDB transactions enabled (replica set `rs0`)
- [ ] Socket.io infrastructure (ADR-010) for real-time order status updates

---

## 6. Documents to Read

| Document | Path |
|----------|------|
| Shop Module | `docs/modules/shop.md` |
| Product Module | `docs/modules/product.md` |
| Order Module | `docs/modules/order.md` |
| Upload Module | `docs/modules/upload.md` |
| Business Rules Catalog | `docs/BUSINESS_RULES.md` |
| State Machines | `docs/STATE_MACHINES.md` |
| Permission Matrix | `docs/PERMISSION_MATRIX.md` |
| Database Schema Reference | `docs/DATABASE.md` |
| API Standards | `docs/API_STANDARDS.md` |
| Edge Cases Catalogue | `docs/EDGE_CASES.md` |
| ADR-009 — GHN Shipping | `docs/adr/ADR-009.md` |
| ADR-010 — Socket.io | `docs/adr/ADR-010.md` |

---

## 7. Business Rules

| Rule ID | Module | Type | Summary |
|---------|--------|------|---------|
| BR-SHP-001 | Shop | workflow | Inventory reservation on order creation; release on timeout (30 min) or cancel; atomic operations with stock guard |
| BR-SHP-002 | Shop | calculation | Platform fee: 2% of product price per item; `FLOOR(item_price * 0.02 * item_quantity)`; displayed as separate invoice line item |
| BR-SHP-003 | Shop | workflow | Escrow holds payment until delivery confirmation; funds released to seller after 7-day dispute window; disputes freeze escrow |
| BR-SHP-004 | Shop | constraint | Return window: 7 calendar days from delivery confirmation; items must be unused and in original packaging; seller has 48h to approve/reject; refund within 5 business days |
| BR-PAY-001 | Payment | constraint | All financial transactions must be atomic (wallet + order) — applies to order payment/release flows |
| BR-PAY-004 | Payment | constraint | Payment timeout: 30 minutes for Stripe — linked to inventory reservation TTL |

---

## 8. State Machines

### Order State Machine

> Source: `docs/STATE_MACHINES.md` §3

**States:** `PENDING` | `CONFIRMED` | `SHIPPING` | `DELIVERED` | `CANCELLED` | `RETURNED` | `REFUNDED`

| From | To | Trigger | Guard | Action |
|------|----|---------|-------|--------|
| — | `PENDING` | Member creates order from cart | All items in stock (BR-SHP-001); shipping address valid | Reserve inventory; create order items with price snapshots; start 30-min payment timer |
| `PENDING` | `CONFIRMED` | Payment webhook received (VNPAY/Stripe) | Payment signature valid; idempotency key not replayed | Capture payment; deduct inventory permanently; create GHN shipment; notify seller |
| `PENDING` | `CANCELLED` | Payment timeout (30 min) OR member cancels | Payment not yet received | Release inventory reservation; no charge; notify member |
| `CONFIRMED` | `SHIPPING` | Seller ships order | Has GHN tracking code | Attach tracking to order; notify buyer; start delivery monitoring |
| `CONFIRMED` | `CANCELLED` | Admin cancels | Not yet shipped | Full refund; release inventory; notify buyer and seller |
| `SHIPPING` | `DELIVERED` | Buyer confirms delivery OR auto-confirm | GHN tracking shows delivered OR 14 days elapsed with GHN API confirmation | Mark delivered; start 7-day escrow release timer (BR-SHP-003); notify buyer |
| `DELIVERED` | `RETURNED` | Buyer requests return | Within 7 days of delivery (BR-SHP-004); item eligible for return | Provide return label; await seller receipt and inspection |
| `DELIVERED` | `REFUNDED` | Escrow auto-released after 7 days | No dispute raised within 7 days of delivery | Release funds to seller; order status → COMPLETED (via escrow release) |
| `RETURNED` | `REFUNDED` | Admin processes refund after inspection | Item received and inspected; seller approved or 48h timeout | Issue refund via gateway; update inventory; notify buyer |

**Invalid Transitions:**
- `PENDING → SHIPPING` (must be confirmed first)
- `PENDING → DELIVERED` (skips fulfilment)
- `CONFIRMED → DELIVERED` (must ship first)
- `SHIPPING → CANCELLED` (already in transit; must wait for return flow)
- `DELIVERED → CANCELLED` (must use return → refund path)
- `REFUNDED → *` (terminal)
- `CANCELLED → *` (terminal)

---

## 9. Permission Matrix

> Source: `docs/PERMISSION_MATRIX.md`

### Shop & Products Resource

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| Browse products | R | R | R | R | R | R | R |
| View own products | — | — | — | — | R | R | R |
| Create products | — | — | — | — | C | C | C |
| Update own products | — | — | — | — | U | U | U |
| Delete own products | — | — | — | — | D | D | D |
| Approve products | — | — | — | — | — | U | U |
| View orders own | — | R | — | — | R | R | R |
| View all orders | — | — | — | — | — | R | R |
| Process shipping | — | — | — | — | U | U | U |
| Process returns | — | — | — | — | — | U | U |
| Manage categories | — | — | — | — | — | CUD | CUD |

---

## 10. Database Collections

> Source: `docs/DATABASE.md` §2.9, §2.10

### Shop/Product (5 collections)

| Collection | Key Fields | Purpose |
|-----------|------------|---------|
| `products` | `name`, `slug` (unique), `description`, `categoryId`, `type` (enum: `physical`, `digital`, `service`), `basePrice`, `salePrice`, `images` [String], `tags` [String], `isActive`, `isFeatured`, `sortOrder` | Product catalog with SEO-friendly slugs |
| `product_variants` | `productId`, `name` (e.g. "Size L"), `sku` (unique), `price` (override base), `stock`, `reserved` (for active carts/orders), `isActive`, `sortOrder` | Product variants with individual stock tracking |
| `categories` | `name`, `slug` (unique), `description`, `parentId` (self-referencing), `image`, `sortOrder`, `isActive` | Hierarchical product category tree |
| `product_reviews` | `productId`, `userId`, `rating` (1-5), `title`, `content`, `images` [String], `isVerifiedPurchase`, `isActive` | Member product reviews with verified purchase flag |
| `seller_payouts` | `userId` (seller), `amount`, `fee` (platform fee), `netAmount`, `status` (enum: `pending`, `processing`, `completed`, `failed`), `periodStart`, `periodEnd`, `paidAt`, `method` (enum: `bank_transfer`, `wallet`), `bankInfo` | Escrow payout records for sellers |

### Order (4 collections)

| Collection | Key Fields | Purpose |
|-----------|------------|---------|
| `orders` | `userId`, `orderNumber` (unique, human-readable), `status` (enum: `pending`, `confirmed`, `shipping`, `delivered`, `cancelled`, `returned`, `refunded`), `subtotal`, `shippingFee`, `discount`, `total`, `shippingAddress`, `notes` | Core order records with full lifecycle |
| `order_items` | `orderId`, `productId`, `variantId`, `productName` (snapshot), `variantName` (snapshot), `sku` (snapshot), `quantity`, `unitPrice`, `subtotal` | Line items with price snapshots for historical accuracy |
| `order_tracking` | `orderId` (unique), `carrier` (GHN), `trackingNumber` (sparse unique), `status`, `estimatedDelivery`, `actualDelivery`, `events` [{ `timestamp`, `location`, `status`, `description` }] | GHN tracking data with event timeline |
| `order_returns` | `orderId`, `userId`, `items` [{ `itemId`, `quantity`, `reason` }], `reason`, `status` (enum: `requested`, `approved`, `picked_up`, `received`, `inspected`, `refunded`, `rejected`), `refundAmount` | Return requests with status tracking |

### Indexes

- `products`: `{ categoryId: 1, isActive: 1 }`, `{ isFeatured: 1, sortOrder: 1 }`, text: `{ name: "text", description: "text" }`
- `product_variants`: `{ productId: 1, isActive: 1 }`
- `categories`: `{ parentId: 1 }`
- `product_reviews`: unique compound `{ productId: 1, userId: 1 }`, `{ productId: 1, rating: -1 }`
- `seller_payouts`: `{ userId: 1, status: 1, createdAt: -1 }`, `{ status: 1, periodStart: 1 }`
- `orders`: `{ userId: 1, status: 1, createdAt: -1 }`, `{ status: 1, createdAt: -1 }`
- `order_items`: `{ orderId: 1 }`, `{ productId: 1 }`
- `order_tracking`: unique `orderId`, `{ trackingNumber: 1 }` (sparse unique)
- `order_returns`: `{ orderId: 1 }`, `{ userId: 1, status: 1 }`

### Critical Atomic Operations

- **Inventory decrement:** `findOneAndUpdate({ _id: variantId, stock: { $gte: qty } }, { $inc: { stock: -qty, reserved: +qty } })` — prevents negative stock (EC-SHP-001)
- **Cart quantity merge:** `findOneAndUpdate({ userId, 'items.productId': productId }, { $inc: { 'items.$.quantity': 1 } })` — prevents duplicate cart entries (EC-SHP-007)
- **Order cancellation + inventory release:** Single MongoDB transaction: update order status → `$inc` stock back → delete reservation

---

## 11. API Endpoints

> Source: `docs/API_STANDARDS.md` §14.11, §14.12, §14.13

### Products (Public + Seller/Admin)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/products` | No | — (public) | List active products (paginated, filterable: `?category=&priceMin=&priceMax=&rating=&tags=`) |
| `GET` | `/api/v1/products/search` | No | — (public) | Full-text product search with faceted filters |
| `GET` | `/api/v1/products/:id` | No | — (public) | Get product with variants and aggregate rating |
| `GET` | `/api/v1/products/:slug` | No | — (public) | Get product by SEO slug |
| `POST` | `/api/v1/products` | Yes | `seller`, `admin`, `super_admin` | Create product (seller: owned products only) |
| `PUT` | `/api/v1/products/:id` | Yes | `seller` (own), `admin`, `super_admin` | Update product |
| `DELETE` | `/api/v1/products/:id` | Yes | `admin`, `super_admin` | Soft-delete product |
| `GET` | `/api/v1/products/:id/variants` | No | — (public) | List product variants |
| `POST` | `/api/v1/products/:id/variants` | Yes | `seller` (own), `admin` | Create variant with SKU |
| `PUT` | `/api/v1/products/:id/variants/:variantId` | Yes | `seller` (own), `admin` | Update variant (stock, price) |
| `DELETE` | `/api/v1/products/:id/variants/:variantId` | Yes | `seller` (own), `admin` | Remove variant |

### Reviews

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/products/:id/reviews` | No | — (public) | List approved reviews for product |
| `POST` | `/api/v1/products/:id/reviews` | Yes | `member` | Submit review (requires verified purchase) |
| `PUT` | `/api/v1/products/reviews/:id` | Yes | `admin` | Approve/reject review |
| `DELETE` | `/api/v1/products/reviews/:id` | Yes | `admin`, `super_admin` | Delete review |

### Categories

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/shop/categories` | No | — (public) | List categories (tree structure) |
| `POST` | `/api/v1/shop/categories` | Yes | `admin`, `super_admin` | Create category |
| `PUT` | `/api/v1/shop/categories/:id` | Yes | `admin`, `super_admin` | Update category |
| `DELETE` | `/api/v1/shop/categories/:id` | Yes | `admin`, `super_admin` | Delete category |

### Cart

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/cart` | Yes | `member` | Get current cart with items and totals |
| `POST` | `/api/v1/cart/items` | Yes | `member` | Add item to cart (quantity merge via `$inc`) |
| `PUT` | `/api/v1/cart/items/:itemId` | Yes | `member` | Update cart item quantity |
| `DELETE` | `/api/v1/cart/items/:itemId` | Yes | `member` | Remove item from cart |
| `DELETE` | `/api/v1/cart` | Yes | `member` | Clear entire cart |

### Orders

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/orders` | Yes | `member` (own), `admin` (all) | List orders (paginated, filterable: `?status=&dateFrom=&dateTo=`) |
| `POST` | `/api/v1/orders` | Yes | `member` | Create order from cart (price-locked checkout, inventory reservation) |
| `GET` | `/api/v1/orders/:id` | Yes | `member` (own), `seller` (own products), `admin` | Get order details with items and tracking |
| `PUT` | `/api/v1/orders/:id/status` | Yes | `admin`, `super_admin` | Update order status (enforce state machine transitions) |
| `POST` | `/api/v1/orders/:id/cancel` | Yes | `member`, `admin` | Cancel order if eligible (release inventory) |
| `POST` | `/api/v1/orders/:id/return` | Yes | `member` | Request return (validates BR-SHP-004 7-day window) |
| `GET` | `/api/v1/orders/:id/tracking` | Yes | `member`, `admin` | Get tracking timeline from GHN |
| `GET` | `/api/v1/orders/:id/feedback` | Yes | `member` | Submit order feedback |

### Shipping (GHN Integration)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `POST` | `/api/v1/shipping/calculate` | Yes | `member` | Calculate GHN shipping rate for cart contents and address |
| `POST` | `/api/v1/shipping/ghn/webhook` | No | — (webhook) | GHN tracking status webhook receiver |
| `POST` | `/api/v1/shipping/create-shipment` | Yes | `seller`, `admin` | Create GHN shipment for confirmed order |

### Returns (Admin)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/admin/returns` | Yes | `admin`, `super_admin` | List all return requests |
| `PUT` | `/api/v1/admin/returns/:id/approve` | Yes | `admin`, `super_admin` | Approve return (process refund) |
| `PUT` | `/api/v1/admin/returns/:id/reject` | Yes | `admin`, `super_admin` | Reject return with reason |

### Seller Dashboard

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/seller/products` | Yes | `seller` | List own products with inventory status |
| `GET` | `/api/v1/seller/orders` | Yes | `seller` | List orders containing own products |
| `GET` | `/api/v1/seller/revenue` | Yes | `seller` | Get revenue summary (total, pending escrow, released, period breakdown) |
| `GET` | `/api/v1/seller/payouts` | Yes | `seller` | List escrow payout history |
| `GET` | `/api/v1/seller/stats` | Yes | `seller` | Dashboard stats: product count, order count, revenue, rating |

### Shop (Public Browse)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/shop` | No | — (public) | Browse shop homepage (featured products, categories, promotions) |

---

## 12. AI Components

| Component | Type | Path Reference | Purpose |
|-----------|------|---------------|---------|
| Product search | DB Tool | `docs/AI_ARCHITECTURE.md` §9 — `query_products` | AI assistant queries product catalog for member inquiries |
| Order lookup | DB Tool | `docs/AI_ARCHITECTURE.md` §9 — `query_orders` (via DB tools) | AI retrieves order status for member |
| Payment history | DB Tool | `docs/AI_ARCHITECTURE.md` §9 — `query_payments` | AI displays payment/refund history |

> **Note:** The commerce module has lighter AI integration than other sprints. Product and order queries are exposed via DB tools for the AI assistant; no new AI tools are required for Sprint 5.

---

## 13. Files Expected Created

### Models (12)

| File | Purpose |
|------|---------|
| `src/models/product.model.js` | Product Mongoose model with slug generation |
| `src/models/productVariant.model.js` | ProductVariant Mongoose model with SKU uniqueness |
| `src/models/category.model.js` | Category Mongoose model (self-referencing parentId) |
| `src/models/productReview.model.js` | ProductReview Mongoose model with verified purchase validation |
| `src/models/sellerPayout.model.js` | SellerPayout Mongoose model for escrow records |
| `src/models/order.model.js` | Order Mongoose model with human-readable orderNumber generation |
| `src/models/orderItem.model.js` | OrderItem Mongoose model with price snapshots |
| `src/models/orderTracking.model.js` | OrderTracking Mongoose model for GHN events |
| `src/models/orderReturn.model.js` | OrderReturn Mongoose model for return requests |
| `src/models/cart.model.js` | Cart Mongoose model (server-side, per-user) |
| `src/models/inventoryLog.model.js` | InventoryLog Mongoose model (audit trail for stock changes) |
| `src/models/shopSetting.model.js` | ShopSetting Mongoose model (platform fee rate, escrow duration, return window config) |

### Services (12)

| File | Purpose |
|------|---------|
| `src/services/productService.js` | Product CRUD, slug generation, search with faceted filters, image management |
| `src/services/productVariantService.js` | Variant CRUD, SKU uniqueness, stock tracking, price inheritance |
| `src/services/categoryService.js` | Category tree CRUD, product count denormalization, slug generation |
| `src/services/reviewService.js` | Review lifecycle, verified purchase validation, rating aggregation, moderation |
| `src/services/cartService.js` | Server-side cart: add/update/remove items, quantity merge via `$inc`, price snapshot |
| `src/services/orderService.js` | Order creation (cart → order), status transitions per state machine, total calculation with platform fee (BR-SHP-002) |
| `src/services/inventoryService.js` | Atomic stock decrement with guard, reservation system (30-min TTL), release on cancel/timeout, low-stock alerts |
| `src/services/shippingService.js` | GHN API integration: rate calculation, shipment creation, tracking webhook, delivery confirmation |
| `src/services/returnService.js` | Return eligibility (7-day window), status tracking, refund processing, inventory restoration |
| `src/services/escrowService.js` | Escrow hold/release workflow, 7-day dispute window timer, seller payout processing |
| `src/services/sellerService.js` | Seller dashboard: revenue aggregation, order list, product stats, payout history |
| `src/services/orderNumberService.js` | Human-readable order number generation (e.g., `GYM-20260720-0001`) with atomic counter |

### Controllers (10)

| File | Purpose |
|------|---------|
| `src/controllers/productController.js` | Product public + admin REST endpoints |
| `src/controllers/variantController.js` | Variant REST endpoints |
| `src/controllers/categoryController.js` | Category REST endpoints |
| `src/controllers/reviewController.js` | Review REST endpoints |
| `src/controllers/cartController.js` | Cart REST endpoints |
| `src/controllers/orderController.js` | Order REST endpoints |
| `src/controllers/returnController.js` | Return request REST endpoints |
| `src/controllers/shippingController.js` | GHN shipping webhook + rate endpoints |
| `src/controllers/sellerController.js` | Seller dashboard REST endpoints |
| `src/controllers/shopController.js` | Public shop browse endpoint |

### Validators (4)

| File | Purpose |
|------|---------|
| `src/validators/product.validator.js` | Validation schemas for product, variant, category, review payloads |
| `src/validators/order.validator.js` | Validation schemas for order creation, status updates, cart payloads |
| `src/validators/return.validator.js` | Validation schemas for return requests |
| `src/validators/shipping.validator.js` | Validation schemas for shipping address, GHN webhook payload |

### Middleware (3)

| File | Purpose |
|------|---------|
| `src/middleware/sellerAuthorization.js` | Seller ownership check (can only manage own products) |
| `src/middleware/orderAuthorization.js` | Order access check (member: own orders; seller: orders with own products; admin: all) |
| `src/middleware/ghnWebhookAuth.js` | GHN webhook signature verification per ADR-009 |

### Routes (6)

| File | Purpose |
|------|---------|
| `src/routes/product.routes.js` | Product, variant, category, review route definitions |
| `src/routes/cart.routes.js` | Cart route definitions |
| `src/routes/order.routes.js` | Order, return route definitions |
| `src/routes/shipping.routes.js` | GHN shipping and webhook route definitions |
| `src/routes/seller.routes.js` | Seller dashboard route definitions |
| `src/routes/shop.routes.js` | Public shop browse route definition |

### GHN Integration (3)

| File | Purpose |
|------|---------|
| `src/integrations/ghn/ghnClient.js` | GHN API client: rate calculation, order creation, tracking query, webhook parsing |
| `src/integrations/ghn/ghnWebhookHandler.js` | GHN webhook event handler: status mapping, order status sync |
| `src/integrations/ghn/ghnConstants.js` | GHN service IDs, status code mappings, address master data constants |

### Jobs (5)

| File | Purpose |
|------|---------|
| `src/jobs/releaseExpiredReservationsJob.js` | Cron (every 1 min): release inventory reservations for unpaid orders older than 30 minutes |
| `src/jobs/autoConfirmDeliveryJob.js` | Cron (daily): query GHN API for orders in SHIPPING >14 days; auto-confirm delivery |
| `src/jobs/releaseEscrowJob.js` | Cron (daily): release escrow to seller for delivered orders past the 7-day dispute window |
| `src/jobs/returnApprovalTimeoutJob.js` | Cron (every 1h): auto-reject return requests where seller hasn't responded within 48h |
| `src/jobs/ghnTrackingPollJob.js` | Cron (every 30 min): poll GHN for tracking updates as webhook fallback |

### Socket.io (1)

| File | Purpose |
|------|---------|
| `src/socket/orderSocket.js` | Real-time order status updates: payment confirmed, shipped, delivered |

### Constants (3)

| File | Purpose |
|------|---------|
| `src/constants/productEnums.js` | Product type, status enum constants |
| `src/constants/orderEnums.js` | Order status, payment status, return status enum constants |
| `src/constants/shippingEnums.js` | Shipping carrier, tracking status enum constants |

### Tests (12)

| File | Purpose |
|------|---------|
| `tests/unit/services/productService.test.js` | Unit tests — product CRUD, slug generation, search |
| `tests/unit/services/inventoryService.test.js` | Unit tests — atomic stock decrement, reservation, release |
| `tests/unit/services/cartService.test.js` | Unit tests — cart operations, quantity merge, price snapshot |
| `tests/unit/services/orderService.test.js` | Unit tests — order creation, status transitions, platform fee calculation (BR-SHP-002) |
| `tests/unit/services/escrowService.test.js` | Unit tests — escrow hold, release after dispute window, dispute freeze |
| `tests/unit/services/returnService.test.js` | Unit tests — return eligibility, 7-day window (BR-SHP-004), approval timeout |
| `tests/unit/services/shippingService.test.js` | Unit tests — GHN rate calculation, shipment creation, tracking parsing |
| `tests/unit/integrations/ghnClient.test.js` | Unit tests — GHN API client with mocked responses |
| `tests/integration/checkoutFlow.test.js` | Integration: cart → checkout → order creation → payment → confirmation → shipping |
| `tests/integration/returnFlow.test.js` | Integration: delivery → return request → seller approval → refund → inventory restored |
| `tests/integration/escrowFlow.test.js` | Integration: payment → escrow hold → delivery → 7-day window → release |
| `tests/integration/inventoryRace.test.js` | Integration: concurrent checkout on last item → exactly 1 succeeds (EC-SHP-001) |
| `tests/e2e/commerce.e2e.test.js` | E2E: real API tests for product, cart, order, return, seller endpoints |
| `tests/e2e/ghnWebhook.e2e.test.js` | E2E: GHN webhook signature verification and status sync |

---

## 14. Files Expected Modified

| File | Change |
|------|--------|
| `src/models/user.model.js` | Add seller-specific fields: `shopName`, `shopDescription`, `bankInfo`, `isSellerActive` |
| `src/models/wallet.model.js` | Add `escrowBalance` field for funds held in escrow (separate from available balance) |
| `src/middleware/auth.js` | Ensure `seller` role is correctly parsed for product/order ownership checks |
| `src/services/walletService.js` | Add `holdInEscrow()`, `releaseFromEscrow()`, `refundFromEscrow()` methods |
| `src/app.js` | Register all commerce route groups |
| `src/socket/index.js` | Integrate order Socket.io namespace |
| `src/config/index.js` | Add GHN API configuration (base URL, token, shop ID, service IDs) |
| `src/config/shopDefaults.js` | Shop configuration: platform fee rate (default 2%), escrow duration (7 days), return window (7 days), inventory reservation TTL (30 min), payment timeout (30 min) |
| `.env.example` | Add `GHN_API_BASE_URL`, `GHN_TOKEN`, `GHN_SHOP_ID`, `GHN_SANDBOX=true/false` |

---

## 15. Definition of Ready

- [ ] All BR-SHP-xxx rules reviewed and clarified with product owner
- [ ] Order state machine transitions (STATES_MACHINES.md §3) agreed by architecture team
- [ ] GHN API sandbox access provisioned and tested (rate calculation, order creation, tracking query)
- [ ] GHN webhook endpoint registered in GHN partner portal with signing secret
- [ ] Payment gateways (VNPAY, Stripe) operational — webhook endpoints tested
- [ ] Wallet module supports escrow balance (separate from available balance)
- [ ] MongoDB replica set verified for transaction support (inventory atomic ops, order creation)
- [ ] Upload module (Cloudinary) deployed and tested for product images
- [ ] API contracts agreed for all 50+ endpoints listed in §11
- [ ] Product category tree seed data prepared (minimum 10 categories)
- [ ] Test product data prepared with variants, SKUs, stock quantities
- [ ] Frontend wireframes available for: product catalog, product detail, cart, checkout, order tracking, seller dashboard
- [ ] GHN test tracking numbers collected for webhook testing

---

## 16. Definition of Done

- [ ] All 72 files listed in §13 created with complete implementations
- [ ] All models have proper Mongoose schemas with indexes, enums, and soft-delete support
- [ ] Product slug auto-generated from name with uniqueness enforcement
- [ ] Variant SKU uniqueness enforced at database level
- [ ] Inventory operations use atomic `findOneAndUpdate` with `$gte` stock guard per EC-SHP-001 mitigation
- [ ] Inventory reservation system: 30-minute TTL with cron fallback for cleanup
- [ ] Cart operations use server-side cart with `$inc` for quantity merges per EC-SHP-007 mitigation
- [ ] Checkout locks prices at order creation; price drift between quote and charge handled per EC-PAY-006
- [ ] Order number generation atomic: human-readable format `GYM-YYYYMMDD-NNNN`
- [ ] Platform fee (BR-SHP-002) correctly calculated as `FLOOR(price * 0.02 * quantity)` per item, displayed as separate line item
- [ ] GHN integration: rate calculation, shipment creation, tracking webhook, delivery confirmation
- [ ] GHN webhook signature verification (ADR-009 compliance) per EC-PAY-005 pattern
- [ ] Escrow holds payment on order confirmation; releases to seller after delivery + 7-day dispute window (BR-SHP-003)
- [ ] Return window enforcement: 7 days from `deliveredAt` (BR-SHP-004); seller 48h approval timeout
- [ ] Seller payout records include platform fee breakdown
- [ ] Active product check at checkout (EC-SHP-004): inactive products removed from cart before order creation
- [ ] Seller account disabled: auto-cancel pending orders, flag in-transit orders (EC-SHP-006)
- [ ] Socket.io events emitted for: order confirmed, shipped, delivered, returned, refunded
- [ ] Unit test coverage ≥80% across all service files
- [ ] Integration tests pass for all 4 business rules (BR-SHP-001 through BR-SHP-004)
- [ ] Edge case regression tests pass: EC-SHP-001 through EC-SHP-007
- [ ] Race condition tests: EC-SHP-001 (inventory), EC-SHP-007 (cart), EC-SHP-003 (escrow release + return)
- [ ] All state machine transition guards enforce valid transitions; invalid transitions return 422
- [ ] Linting passes (`npm run lint`) with no errors
- [ ] TypeScript type checking passes (`npm run typecheck`) if applicable
- [ ] API documentation generated (Swagger/OpenAPI) for all endpoints

---

## 17. Acceptance Criteria

| # | Criteria | Verification |
|---|----------|-------------|
| AC-5.1 | Public product catalog: `GET /products` with category filtering, price range, rating, search | Paginated results with correct filters applied |
| AC-5.2 | Product detail: `GET /products/:id` returns product with variants, aggregate rating, review count | All variant options listed with stock availability |
| AC-5.3 | Seller creates product: `POST /products` with base info → `draft` status | Product created; seller is owner |
| AC-5.4 | Seller adds variants: `POST /products/:id/variants` with SKU, stock, price | Variant created with unique SKU; inherited base price if not overridden |
| AC-5.5 | Seller uploads product images via upload module → `PUT /products/:id` with image URLs | Images displayed in product detail |
| AC-5.6 | Category tree: `GET /shop/categories` returns hierarchical structure | Parent-child relationships correct; product counts denormalized |
| AC-5.7 | Member adds product to cart: `POST /cart/items` with productId, variantId, quantity | Cart updated; duplicate adds increment quantity via `$inc` |
| AC-5.8 | Cart persists across sessions: member logs out and back in → cart unchanged | Server-side cart per user |
| AC-5.9 | Checkout creates order: `POST /orders` → inventory reserved (BR-SHP-001), order status `PENDING` | Stock decremented with `reserved` increment; 30-min TTL set |
| AC-5.10 | Checkout rejects if stock insufficient: `POST /orders` returns 409 with specific product name | Atomic stock guard prevents oversell |
| AC-5.11 | Concurrent checkout on last item: 2 members checkout simultaneously → exactly 1 succeeds (EC-SHP-001) | Atomic `findOneAndUpdate` with `$gte` guard; 1 gets 409 |
| AC-5.12 | Payment webhook received → order status `CONFIRMED`, inventory permanently deducted, GHN shipment created | Payment processed; escrow hold applied (BR-SHP-003) |
| AC-5.13 | Platform fee itemized: FLOOR(price * 0.02 * qty) per item (BR-SHP-002) | Invoice shows separate platform fee line item |
| AC-5.14 | Payment timeout: order stays `PENDING` >30 min → auto-cancelled, inventory released (BR-SHP-001 + BR-PAY-004) | `releaseExpiredReservationsJob` cron |
| AC-5.15 | GHN shipping rate calculation: `POST /shipping/calculate` returns accurate rate for address | Rate matches GHN sandbox response |
| AC-5.16 | GHN shipment creation: seller ships → tracking number attached → order status `SHIPPING` | Tracking events streamed via GHN webhook |
| AC-5.17 | GHN webhook updates tracking: `POST /shipping/ghn/webhook` updates `order_tracking.events` | Status timeline visible via `GET /orders/:id/tracking` |
| AC-5.18 | GHN webhook signature verification: invalid signature → 401 (EC-PAY-005 pattern) | Webhook signature validated per ADR-009 |
| AC-5.19 | Buyer confirms delivery → order status `DELIVERED`, 7-day escrow timer starts (BR-SHP-003) | Escrow release scheduled |
| AC-5.20 | Auto-confirm delivery: order in `SHIPPING` >14 days → GHN API poll → auto-confirm | `autoConfirmDeliveryJob` cron; escrow timer started |
| AC-5.21 | Escrow auto-release: 7 days after delivery, no dispute → funds released to seller (BR-SHP-003) | Seller wallet credited; `seller_payouts` record created |
| AC-5.22 | Dispute raised within 7 days → escrow frozen → admin review → resolution | Funds not released until admin resolves dispute |
| AC-5.23 | Return request: within 7 days of delivery (BR-SHP-004) → `POST /orders/:id/return` | Return created with status `requested` |
| AC-5.24 | Return >7 days rejected: `POST /orders/:id/return` after 8 days → 422 `ORDER_RETURN_WINDOW_CLOSED` | BR-SHP-004 enforcement |
| AC-5.25 | Seller approves/auto-approves return → refund processed → inventory restored | Refund via original payment method per BR-PAY-003 |
| AC-5.26 | Seller dashboard: `GET /seller/revenue` shows total revenue, pending escrow, released funds | Correct financial aggregation |
| AC-5.27 | Inactive product in cart at checkout: removed from cart, member notified (EC-SHP-004) | Checkout proceeds with remaining items |
| AC-5.28 | Seller disabled: pending orders auto-cancelled, in-transit orders flagged (EC-SHP-006) | Affected buyers notified |
| AC-5.29 | Order status transitions enforce state machine: invalid transition → 422 | All invalid transitions per STATE_MACHINES.md §3 rejected |
| AC-5.30 | GHN tracking polling fallback: webhook missed → cron polls GHN API (EC-SHP-002) | `ghnTrackingPollJob` updates status from GHN API |

---

## 18. Testing Strategy

### Unit Tests

- **productService:** Product CRUD, slug auto-generation, duplicate slug handling, search with faceted filters
- **productVariantService:** Variant CRUD, SKU uniqueness, price inheritance, stock tracking
- **categoryService:** Category tree CRUD, parent-child relationships, product count denormalization
- **reviewService:** Review creation with verified purchase check, duplicate review prevention, rating aggregation
- **cartService:** Add item (quantity merge via `$inc`), update quantity, remove item, clear cart, price snapshot
- **inventoryService:** Atomic `$inc` with stock guard, reservation with TTL, release on cancel/timeout, low-stock alert threshold
- **orderService:** Order creation from cart (price-locked), status transitions (state machine guards), total calculation with platform fee (BR-SHP-002), order number generation
- **escrowService:** Hold, release after dispute window, dispute freeze, seller payout calculation with platform fee deduction
- **returnService:** Return eligibility (7-day window), status tracking, refund processing, inventory restoration, seller 48h auto-reject
- **shippingService:** GHN rate calculation (mocked), shipment creation, webhook status sync, tracking event parsing
- **sellerService:** Revenue aggregation, order list, product stats, payout history

### Integration Tests

- **checkoutFlow:** Add to cart → checkout → order creation → inventory reserved → payment webhook → order confirmed → inventory deducted → GHN shipment created
- **paymentTimeoutFlow:** Order created → payment not confirmed → 30 min passes → cron releases inventory → order cancelled
- **shippingFlow:** Order confirmed → seller ships via GHN → tracking events received → buyer confirms delivery → escrow timer starts
- **returnFlow:** Order delivered → buyer requests return → seller approves → refund processed → inventory restored
- **escrowFlow:** Payment held → delivery confirmed → 7 days elapsed → escrow auto-released to seller
- **disputeFlow:** Delivery confirmed → dispute raised within 7 days → escrow frozen → admin resolves → funds released/refunded
- **inventoryRace:** 2 concurrent checkouts on last item → exactly 1 succeeds (EC-SHP-001)
- **cartRace:** 2 concurrent add-to-cart for same product → quantity merged correctly (EC-SHP-007)

### E2E Tests

- Real HTTP requests against test database via supertest
- All 30 acceptance criteria enumerated in §17
- GHN webhook tests with real signature validation
- End-to-end commerce journey: browse → cart → checkout → payment → shipping → delivery → escrow release

---

## 19. Rollback Strategy

| Scenario | Rollback Action |
|----------|----------------|
| GHN API unavailable at checkout | Graceful degradation: allow order creation without shipping; seller manually creates shipment when GHN recovers |
| Inventory reservation leak (stuck reservations) | Cron `releaseExpiredReservationsJob` cleans up; admin manual release endpoint: `POST /admin/inventory/release/:orderId` |
| Escrow release fails (seller not credited) | Cron `releaseEscrowJob` retries; admin manual release endpoint; audit log tracks all attempts |
| GHN webhook missed (tracking not updated) | Cron `ghnTrackingPollJob` polls GHN API as fallback per EC-SHP-002 mitigation |
| Double refund due to concurrent admin actions | Idempotency key on refund operations; unique index on `(paymentId, type)` in `wallet_transactions` where `type: 'refund'` |
| Category delete causes product reference issues | Categories use soft-delete; products reference `categoryId` — queries filter `{ 'category.isActive': true }` for display |
| Product delete while in cart (EC-SHP-004) | Checkout validates all cart items are `isActive: true`; removes inactive items with notification |
| Seller disabled mid-order (EC-SHP-006) | Auto-cancel pending orders; flag in-transit; bulk notify affected buyers |

---

## 20. Risks

| # | Risk | Probability | Impact |
|---|------|------------|--------|
| R-5.1 | Inventory overselling due to race condition (EC-SHP-001) | Medium | Critical — unfulfillable orders, customer trust loss |
| R-5.2 | GHN API outage blocks all order creation/shipping | Low | High — orders cannot be fulfilled |
| R-5.3 | GHN webhook delivery failure → order stuck in SHIPPING (EC-SHP-002) | Medium | Medium — escrow never released; manual intervention |
| R-5.4 | Escrow release before return window closes → seller withdraws before refund (EC-SHP-003) | Low | High — financial loss |
| R-5.5 | Platform fee miscalculation → under-collection of revenue (BR-SHP-002) | Low | Medium — cumulative revenue loss at scale |
| R-5.6 | Price drift between cart add and checkout (EC-PAY-006) | Medium | Medium — customer charged wrong amount |
| R-5.7 | Seller account compromise → fraudulent products listed | Low | High — reputation damage, chargeback liability |
| R-5.8 | GHN API rate limit exceeded during peak (holiday sales) | Medium | Medium — shipping rate calculation delayed |
| R-5.9 | Wallet escrow balance not separate from available → member spends held funds | Medium | Critical — funds not available for refund |
| R-5.10 | Duplicate order number generation under concurrent load | Low | Medium — order tracking confusion |

---

## 21. Risk Mitigation

| Risk # | Mitigation |
|--------|-----------|
| R-5.1 | Atomic `findOneAndUpdate` with `{ stock: { $gte: qty } }` guard at database level; MongoDB transaction wraps entire order creation + inventory decrement; integration test with concurrent requests |
| R-5.2 | Circuit breaker pattern on GHN client (3 failures → open circuit → fallback); queue orders for retry when GHN recovers; health check endpoint monitors GHN availability; alert on circuit open |
| R-5.3 | Dual-path tracking: GHN webhook (primary) + cron poll `ghnTrackingPollJob.js` every 30 min (fallback); auto-confirm delivery after 14 days with GHN API confirmation per EC-SHP-002 mitigation |
| R-5.4 | Separate `escrowBalance` field on wallet (not in available balance); escrow release requires delivery confirmation + 7-day elapsed check at service layer; return request immediately places hold on seller's available balance for the order amount |
| R-5.5 | Platform fee calculated server-side only (not client-side); unit tests for fee calculation with edge cases (zero price, fractional rounding, large quantities); admin-configurable fee rate via `shop_settings` |
| R-5.6 | Lock price at checkout initialization; store `lockedUnitPrice` in cart items; order uses locked prices; display clear "prices may change" note in cart UI; cart TTL to prevent stale prices |
| R-5.7 | Seller registration requires admin approval; seller products require admin review before publishing (configurable); rate limiting on product creation; suspicious activity monitoring |
| R-5.8 | Rate limiting with exponential backoff in GHN client; queue bulk requests; cache shipping rates for common address pairs (TTL: 1 hour) |
| R-5.9 | `wallet.escrowBalance` field tracks funds held in escrow; `wallet.balance` = available only; withdrawal endpoint checks available balance only (excludes escrow); admin dashboard shows both balances |
| R-5.10 | Atomic counter using MongoDB `findOneAndModify` with `$inc` on a dedicated `order_counters` collection; unique index on `orderNumber` as safety net; retry on duplicate key error with incremented counter |

---

## 22. Estimated Implementation Order

Tasks are dependency-ordered. Same-numbered tasks can be parallelised.

1. **Constants & Enums** — `productEnums.js`, `orderEnums.js`, `shippingEnums.js`
2. **Shop Configuration** — `shopDefaults.js` (platform fee, escrow duration, TTL values)
3. **Category Models & Services** — `category.model.js`, `categoryService.js`, `categoryController.js` (foundational — products depend on categories)
4. **Product Models** — `product.model.js`, `productVariant.model.js`, `productReview.model.js`
5. **Cart Model** — `cart.model.js`
6. **Order Models** — `order.model.js`, `orderItem.model.js`, `orderTracking.model.js`, `orderReturn.model.js`, `sellerPayout.model.js`, `inventoryLog.model.js`
7. **Shop Config Model** — `shopSetting.model.js`
8. **Product Services** — `productService.js`, `productVariantService.js`, `reviewService.js`
9. **Cart Service** — `cartService.js` (add/update/remove with `$inc` merge)
10. **Inventory Service** — `inventoryService.js` (atomic decrement with guard, reservation, release)
11. **Order Number Service** — `orderNumberService.js` (atomic counter generation)
12. **Order Service** — `orderService.js` (cart → order, status transitions, totals with platform fee)
13. **GHN Integration** — `ghnClient.js`, `ghnWebhookHandler.js`, `ghnConstants.js`
14. **Shipping Service** — `shippingService.js` (rate calc, shipment creation, tracking sync)
15. **Escrow Service** — `escrowService.js` (hold, release, dispute, payout)
16. **Return Service** — `returnService.js` (eligibility, approval, refund, inventory restore)
17. **Seller Service** — `sellerService.js` (dashboard aggregations)
18. **Validators** — All 4 validator files (parallel)
19. **Middleware** — `sellerAuthorization.js`, `orderAuthorization.js`, `ghnWebhookAuth.js`
20. **Controllers** — All 10 controllers (parallel)
21. **Socket.io** — `orderSocket.js` (real-time order status events)
22. **Routes** — All 6 route files (parallel)
23. **Cron Jobs** — All 5 job files (parallel)
24. **Wallet Extension** — `escrowBalance` field; `holdInEscrow()`, `releaseFromEscrow()` methods
25. **App Registration** — Register routes in `src/app.js`; integrate Socket.io namespace
26. **Unit Tests** — All service unit tests (parallel: product, inventory, cart, order, escrow, return, shipping, seller)
27. **Integration Tests** — All workflow tests (parallel: checkout, return, escrow, race conditions)
28. **E2E Tests** — All E2E test files
29. **API Documentation** — OpenAPI/Swagger for all endpoints
30. **Lint & Typecheck** — `npm run lint`, `npm run typecheck`

---

## 23. Review Checklist

- [ ] All business rules (BR-SHP-001 through BR-SHP-004) have service-layer enforcement
- [ ] All state machine transitions (STATES_MACHINES.md §3) have atomic guards and invalid transition rejection
- [ ] All edge cases (EC-SHP-001 through EC-SHP-007) have mitigation code in place
- [ ] Inventory operations use atomic `findOneAndUpdate` with `$gte` stock guard — never read-then-write
- [ ] Cart operations use `$inc` for quantity merges — never read-then-write
- [ ] Order number generation uses atomic counter — never read-then-increment
- [ ] GHN API calls wrapped in circuit breaker with retry logic per ADR-009
- [ ] GHN webhook signature verified before processing per ADR-009 compliance section
- [ ] Wallet `escrowBalance` field maintained separately from available balance
- [ ] Escrow release validates 7-day window and no active dispute before releasing
- [ ] Platform fee calculated server-side using integer arithmetic per `docs/DATABASE.md` §3.5
- [ ] Price snapshot stored in `order_items` at checkout time — never re-queried from product
- [ ] Checkout validates all cart items reference active (`isActive: true`) products
- [ ] Soft-delete pattern (`deletedAt`) on all collections per `docs/DATABASE.md` §3.2
- [ ] Timestamp fields (`createdAt`, `updatedAt`) on all collections per `docs/DATABASE.md` §3.1
- [ ] All monetary amounts stored as integers (VND) per `docs/DATABASE.md` §3.5
- [ ] All API endpoints return standardised response format per `docs/API_STANDARDS.md` §5
- [ ] All API endpoints use kebab-case URL paths per `docs/API_STANDARDS.md` §2.3
- [ ] Payment/idempotency endpoints require `Idempotency-Key` header per `docs/API_STANDARDS.md` §4.3
- [ ] Socket.io connections authenticated via JWT on handshake per ADR-010
- [ ] Socket.io events follow `namespace:action` naming convention per ADR-010
- [ ] Seller authorization middleware enforces product ownership
- [ ] Order authorization middleware enforces role-based access (member: own; seller: own products; admin: all)
- [ ] All cron jobs use persistent scheduler (`bull` or database-backed) per EC-SYS-002 mitigation
- [ ] Error codes follow catalogue: `PRODUCT_NOT_FOUND`, `PRODUCT_OUT_OF_STOCK`, `ORDER_INVENTORY_INSUFFICIENT`, `ORDER_NOT_SHIPPABLE`, `ORDER_RETURN_WINDOW_CLOSED`, `ORD_001` through `ORD_008`, `PRD_001` through `PRD_009`
- [ ] Idempotency keys enforced on payment and order creation endpoints

---

## 24. Documentation Update Checklist

- [ ] `docs/modules/shop.md` — Update with actual API paths, add GHN integration details
- [ ] `docs/modules/product.md` — Add variant management flow, SKU uniqueness enforcement
- [ ] `docs/modules/order.md` — Add escrow flow, GHN integration, return workflow details
- [ ] `docs/modules/upload.md` — No changes needed (already covers product images)
- [ ] `docs/BUSINESS_RULES.md` — No changes needed (rules defined pre-sprint)
- [ ] `docs/STATE_MACHINES.md` — No changes needed (order state machine defined pre-sprint)
- [ ] `docs/PERMISSION_MATRIX.md` — No changes needed (shop rows defined pre-sprint)
- [ ] `docs/DATABASE.md` — Add §2.17 Cart collection, §2.18 Inventory log collection, §2.19 Shop settings collection
- [ ] `docs/API_STANDARDS.md` — Add §14.21 Cart endpoints, §14.22 Shipping endpoints, §14.23 Return endpoints, §14.24 Seller endpoints; update §14.11 product endpoints with review endpoints
- [ ] `docs/EDGE_CASES.md` — Update EC-SHP entries with actual mitigation implementations
- [ ] `docs/adr/ADR-009.md` — Add implementation details section (circuit breaker config, retry strategy)
- [ ] `docs/IMPLEMENTATION_ROADMAP.md` — Mark Sprint 5 as complete; update overall project status
- [ ] `docs/DEPLOYMENT_GUIDE.md` — Add GHN API configuration section
- [ ] `CHANGELOG.md` — Add v1.5.0 entry with all new features

---

## 25. Deliverables

| # | Deliverable | Format | Recipient |
|---|-------------|--------|-----------|
| 1 | Product Catalog API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 2 | Variant & Inventory API | REST endpoints + OpenAPI spec | Frontend team, Admin team |
| 3 | Category Management API | REST endpoints + OpenAPI spec | Admin team |
| 4 | Review System API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 5 | Shopping Cart API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 6 | Order Lifecycle API | REST endpoints + OpenAPI spec | Frontend team, Mobile team, Admin team |
| 7 | GHN Shipping Integration | API client + webhook handler | Ops team, Admin team |
| 8 | Return & Refund API | REST endpoints + OpenAPI spec | Frontend team, Admin team |
| 9 | Escrow Payout System | Service + cron jobs | Finance team |
| 10 | Seller Dashboard API | REST endpoints + OpenAPI spec | Frontend team, Seller users |
| 11 | Real-time Order Updates | Socket.io events documentation | Frontend team |
| 12 | Inventory Reservation System | Cron jobs + TTL logic | Ops team |
| 13 | Platform Fee Calculation | Service logic + invoice integration | Finance team |
| 14 | Unit test suite | `tests/unit/` | QA team |
| 15 | Integration test suite | `tests/integration/` | QA team |
| 16 | E2E test suite | `tests/e2e/` | QA team |
| 17 | API documentation | Swagger UI at `/api-docs` | All teams |
| 18 | Database migration scripts | `src/scripts/` | Ops team |
| 19 | GHN integration runbook | Operations doc | Ops team |
| 20 | Sprint report | Sprint retrospective doc | Project Manager |
| 21 | Sprint 4-5 release notes | `CHANGELOG.md` | All stakeholders |
