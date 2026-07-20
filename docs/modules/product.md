# Product Module

- **Owner**: Commerce Team
- **Dependencies**: Auth Module, Upload Module, Category Module
- **Related Documents**: None

## Purpose

Manage the product catalog including products with variants (size, color, etc.), categories, pricing, inventory tracking, images, and customer reviews. Sellers manage their own products; admins oversee categories, reviews, and overall catalog quality.

## Models

- **Product**: Core product entity. Fields include name, slug (unique), description, basePrice, sellerId, status (draft, active, inactive, discontinued), images (array of Upload URLs), attributes (JSON — brand, material, etc.), tags, averageRating, reviewCount, and timestamps.
- **ProductVariant**: Specific product variations. Fields include productId, name (e.g., "Large Red"), sku (unique), price (override or null to use basePrice), stock, attributes (JSON — size, color), image, and active flag.
- **Category**: Product categorization (shared with content? if separate). Fields include name, slug, description, parentId (self-referential for hierarchy), image, sortOrder, active, and productCount (denormalized).
- **ProductReview**: Customer reviews. Fields include productId, userId, orderItemId (verified purchase), rating (1–5), title, body, images, status (pending, approved, rejected), and timestamps.

## Services

- **productService**: Product CRUD with seller scoping. Handles slug generation, product status transitions, image management, search with faceted filters (category, price range, rating, attributes), and inventory checks.
- **productVariantService**: Variant management. Handles SKU uniqueness, stock tracking, price inheritance from parent product, and bulk variant creation.
- **categoryService**: Category tree management. Handles hierarchical CRUD, reordering, product count updates, and slug generation.
- **reviewService**: Review lifecycle. Validates verified purchase (reviewer must have purchased the product), status moderation (auto-approve for trusted reviewers or require admin approval), rating aggregation, and flagging inappropriate content.

## Key Flows

1. **Create Product (Seller)**: Seller creates product with base info → adds variants with SKUs and stock → uploads images → productService creates with status draft → seller publishes → product becomes active.
2. **Search Products**: User queries with filters → productService searches by name/description → applies category, price, rating, attribute filters → sorts by relevance/price/rating/newest → returns paginated results with aggregate counts for active filters.
3. **Submit Review**: User submits review for a purchased product → reviewService validates orderItem → creates review with status pending → admin approves → averageRating and reviewCount updated on product.
4. **Inventory Update**: Order confirmed → productVariantService decrements stock for each variant → if stock reaches zero, variant optionally marked out-of-stock → low-stock threshold triggers notification.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /products | Public | List active products (paginated, filterable, sortable) |
| GET | /products/search | Public | Full-text search with faceted filters |
| GET | /products/:id | Public | Get product details with variants |
| GET | /products/:slug | Public | Get product by slug |
| POST | /products | Seller/Admin | Create product |
| PUT | /products/:id | Seller/Admin | Update product (seller: own only) |
| DELETE | /products/:id | Admin | Delete product |
| GET | /products/:id/variants | Public | List product variants |
| POST | /products/:id/variants | Seller/Admin | Create variant |
| PUT | /products/:id/variants/:variantId | Seller/Admin | Update variant |
| DELETE | /products/:id/variants/:variantId | Seller/Admin | Delete variant |
| GET | /categories | Public | List active categories (tree) |
| POST | /categories | Admin | Create category |
| PUT | /categories/:id | Admin | Update category |
| DELETE | /categories/:id | Admin | Delete category |
| GET | /products/:id/reviews | Public | List approved reviews for product |
| POST | /products/:id/reviews | User | Submit review (requires verified purchase) |
| PUT | /products/reviews/:id | Admin | Approve/reject review |
| DELETE | /products/reviews/:id | Admin | Delete review |

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| PRD_001 | Product not found | Product ID does not exist or is inactive |
| PRD_002 | Slug already exists | Product slug must be unique |
| PRD_003 | SKU already exists | Variant SKU must be unique |
| PRD_004 | Insufficient stock | Requested quantity exceeds available stock |
| PRD_005 | Category not found | Referenced category does not exist |
| PRD_006 | Not a seller | User does not have seller role |
| PRD_007 | Cannot modify product | Not the owner of this product (seller) |
| PRD_008 | Verified purchase required | Must purchase product before reviewing |
| PRD_009 | Duplicate review | User has already reviewed this product |

## Future

- Product bundles (group multiple products at a discount)
- Flash sales and time-limited pricing
- Related products (cross-sell and up-sell suggestions)
- Wishlist functionality
- Inventory import/export via spreadsheet
- Barcode/QR code generation for products
- Back-in-stock notifications
