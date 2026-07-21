# EPIC_5_1_DISCOVERY_REPORT

## Coverage: ~50%

**Existing Product module** (11 endpoints at `/api/products`): Product model (embedded reviews/variants), productController (CRUD + search + categories + reviews + image upload), productOwnershipMiddleware, audit logging, Cloudinary images.

**Missing vs Sprint 5 spec:**

| Component | Gap |
|-----------|-----|
| Category model | Flat string on Product; no hierarchical model (`parentId`), no slug |
| ProductVariant model | Embedded weightVariants only; no standalone model, no SKU |
| ProductReview model | Embedded in Product; no `isVerifiedPurchase` flag |
| productService | Only `getRecommendedProducts()` — no CRUD abstraction |
| Zod validation | None — manual validation in controller |
| productEnums | No constants file |

## Files to Create (10)

**Models:** `Category.js`, `ProductVariant.js`, `productEnums.js`
**Services:** `productService.js` (expand), `productVariantService.js`, `categoryService.js`
**Validators:** `productValidator.js`
**Controllers:** `productVariantController.js`, `categoryController.js`
**Routes:** `productVariantRoutes.js`, `categoryRoutes.js`

## Files to Modify (2)

- `src/models/Product.js` — add `slug`, `categoryId` ref
- `src/app.js` — register new route groups

## Approach: Option 3 (Patch)

Existing `/api/products` remains operational. Add standalone Category/Variant models, Zod validation, proper service layer alongside. Same pattern as Epic 4.1 Exercise Library (new models coexisting with legacy embedded data).
