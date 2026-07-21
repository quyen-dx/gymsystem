# MEMBERSHIP BENEFITS REGRESSION REPORT

## Root Cause

The `featuresVi` field was removed from the `Plan` Mongoose schema during a Sprint 1
refactor (replaced by `featureIds` referencing `PlanFeature` documents).  However
the API response handlers continued to rely on `featuresVi` being present in the
document data.  Because Mongoose `strict:true` silently drops `featuresVi` during
`save()` / `create()`, it was **never written to MongoDB** for any new plan created
after the schema change.  When the frontend reads the plan list, it checks
`record.featuresVi || []` — which is `undefined` for new plans → shows `—`.

## Why Old Plans Still Work

Old plans (created before the schema refactor) still have `featuresVi` stored
**directly in the MongoDB document**.  Even though the current Mongoose schema
no longer declares `featuresVi`, Mongoose loads all fields from the database
into the document instance and `toObject()` includes them.  So old plans
survived the schema change without issues.

## Why New Plans Fail

```
┌──────────────────────┐
│ Frontend sends:      │
│  featuresVi: [...]   │
│  featureIds: [...]   │
└──────┬───────────────┘
       ▼
┌──────────────────────┐
│ POST /api/plans      │
│ createPlan()         │
└──────┬───────────────┘
       ▼
┌──────────────────────────────────────────┐
│ Plan.create({ ..., featuresVi, ... })    │
│                                          │
│ Mongoose strict:true drops featuresVi    │  ← SILENT DATA LOSS
│ because it is NOT in the schema.         │
│                                          │
│ MongoDB stores:                          │
│  { _id, nameVi, price, featureIds, ... } │
│  (NO featuresVi field)                   │
└──────┬───────────────────────────────────┘
       ▼
┌──────────────────────────────────────────┐
│ GET /api/plans                           │
│ getPlans()                               │
│                                          │
│ Plan.find().populate('featureIds')       │
│                                          │
│ Response:                                │
│  { ...plan.toObject(), memberCount }     │  ← featuresVi IS NOT DERIVED
│  → featuresVi: undefined                 │     from featureIds
└──────┬───────────────────────────────────┘
       ▼
┌──────────────────────┐
│ Frontend renders:    │
│  record.featuresVi   │
│    → undefined       │
│    → shows "—"       │
└──────────────────────┘
```

## Files Modified

**1 file:** `src/controllers/planController.js`

### Change: Added `deriveFeaturesVi()` helper (lines 6–14)

```js
const deriveFeaturesVi = (planDoc) => {
  const obj = typeof planDoc.toObject === 'function'
    ? planDoc.toObject()
    : planDoc;
  if (obj.featuresVi && obj.featuresVi.length) return obj.featuresVi;
  const populated = planDoc.featureIds || [];
  if (populated.length && populated[0] && typeof populated[0] === 'object') {
    return populated.map((f) => f.name);
  }
  return [];
};
```

**Logic:**
1. If the plan ALREADY has `featuresVi` stored (old plans from MongoDB) → return it unchanged
2. Otherwise derive from the populated `featureIds` array by mapping `f.name`
3. Fallback to empty array

### Change: Applied `deriveFeaturesVi()` in all four response handlers

| Handler | Line | Before | After |
|---------|------|--------|-------|
| `getPlans` | 90-94 | `{ ...plan.toObject(), memberCount }` | `{ ...plan.toObject(), memberCount, featuresVi: deriveFeaturesVi(plan) }` |
| `getPlanById` | 125-131 | `{ ...plan.toObject(), memberCount }` | `{ ...plan.toObject(), memberCount, featuresVi: deriveFeaturesVi(plan) }` |
| `createPlan` | 39-43 | `res.json({ plan: populated })` | `res.json({ plan: { ...planObj, featuresVi: deriveFeaturesVi(populated) } })` |
| `updatePlan` | 168-172 | `res.json({ plan: populated })` | `res.json({ plan: { ...planObj, featuresVi: deriveFeaturesVi(populated) } })` |

No schema changes.  No field renames.  No frontend contract changes.

## Regression Verification

| Check | Status |
|-------|--------|
| Old plans still display benefits | ✓ `featuresVi` from MongoDB is returned unchanged |
| Newly created plans display benefits | ✓ `featuresVi` derived from populated `featureIds` |
| Edit plan preserves benefits | ✓ `updatePlan` response includes derived `featuresVi` |
| API returns `featuresVi` correctly | ✓ All GET/POST/PUT responses now include it |
| MongoDB stores `featureIds` correctly | ✓ No change to write path — `featureIds` stored as before |
| Frontend contract unchanged | ✓ `featuresVi` is still a `string[]` in the response |
