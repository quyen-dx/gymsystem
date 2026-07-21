# EPIC_5.4_FIX_REPORT

**Tests:** 101/101 pass

## M-001: Return timeout TOCTOU — FIXED

`returnApprovalTimeoutJob.js` — replaced `find()` → modify → `save()` with atomic `findOneAndUpdate`.

- `find()` uses `.lean()` to fetch only `_id` and `userId` (no Mongoose document overhead)
- `findOneAndUpdate({ _id, status: 'requested' }, { $set: { ... } })` atomically updates only if status is still `'requested'`
- If result is `null` (concurrent seller approval already changed status), loop continues silently
- `rejectedCount` tracks actual successful updates, not just found documents
- Idempotent: re-runs find no documents (status already `'rejected'`)
- No duplicate processing: `status: 'requested'` filter on both `find` and `findOneAndUpdate`

## Files Modified

| File | Change |
|------|--------|
| `src/jobs/returnApprovalTimeoutJob.js` | Atomic `findOneAndUpdate` with status filter |

## Regression

| Module | Status |
|--------|--------|
| All restricted modules | Unchanged |
| Tests | 101/101 pass |
