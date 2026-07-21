# Epic 6.1 Discovery: Check-in System

**Coverage: ~85%** — 745-line `checkInController.js` with full check-in flow, JWT QR, streak, daily dedup, membership validation, paginated history, stats, heatmap. MongoDB-transaction-protected duplicate prevention.

## Existing (Reuse)

| Piece | Location |
|-------|----------|
| CheckIn model (20+ fields) | `models/CheckIn.js` |
| DailyQRCode model | `models/DailyQRCode.js` |
| QR generation + JWT verify | `checkInController.js:194-243,87-122` (`generateQRToken`, `resolveMemberFromCheckinPayload`) |
| Core verify flow + auto-activate | `checkInController.js:344-464` (`staffVerifyCheckin` with transaction + `activateCycle`) |
| Daily dedup (BR-CHK-004) | Transaction-locked `findOne` with Vietnam date range |
| Streak calc (BR-CHK-003) | `calculateStreak` inline; `checkInService.js` also has `computeStreak` |
| Staff history + member history | 2 endpoints with pagination, filters, population |
| Stats + heatmap | Aggregated by day/week/month |
| RBAC | `permissions.js` — `checkin.view_own/any/create/manual` roles defined |

## Missing / Gaps

| Gap | Severity | Rule |
|-----|----------|------|
| Gym operating hours not enforced | MEDIUM | BR-CHK-005 |
| Holiday/closure not checked (ScheduleOverride) | MEDIUM | EC-CHK-004 |
| QR logic inline (no `qrService.js`) | LOW | Architecture |
| Streak logic inline (no `streakService.js`) | LOW | Architecture |
| Only `pending_initial_activation` handled (no renewal order) | LOW | EC-CHK-005 |

## Recommendation: Option 3 (Patch)

Preserve 745-line controller. Create `qrService.js` and `streakService.js` to extract logic. Add BR-CHK-005 (operating hours) and EC-CHK-004 (holiday closure) validations to `staffVerifyCheckin` and `generateQRToken`.

**Files to create:** `qrService.js`, `streakService.js`  
**Files to modify:** `checkInController.js` (+2 validations, import new services), `checkInService.js` (minor)
