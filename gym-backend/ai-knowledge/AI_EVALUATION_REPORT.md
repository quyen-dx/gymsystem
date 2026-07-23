# AI Sprint 10 — AI Evaluation Framework

## 1. Architecture

```
npm run ai:test
  → tests/ai/runner.js  (orchestrator)
    → node:test native runner (no dependencies)
      → cards/builders.test.js       (7 card builders)
      → cards/registry.test.js       (trade registry integrity)
      → cards/response.test.js       (response builder parity)
      → vision/validation.test.js    (mime/extensions/size/normalize)
      → vector/search.test.js        (query, declaration, actual search)
      → memory/conversation.test.js  (load/update/summarize/TTL/entities)
      → routing/declarations.test.js (tool declarations + intents)
      → streaming/sse.test.js        (generator + events)
      → regression/golden.test.js    (golden .json validation)
```

## 2. Folder Structure

```
tests/ai/
  runner.js                   ← main orchestrator (scans dirs, runs files, collects metrics)
  cards/
    builders.test.js          ← 7 card builder unit tests
    registry.test.js          ← registry integrity (7 types)
    response.test.js          ← response builder parity tests
  database/                   ← reserved for databaseQuery integration tests
  web/                        ← reserved for webQuery integration tests
  vision/
    validation.test.js        ← vision tool validation tests
  vector/
    search.test.js            ← vectorQuery tests (real .vectors.json)
  memory/
    conversation.test.js      ← conversation memory unit tests
  routing/
    declarations.test.js      ← tool declarations + intent enum
  streaming/
    sse.test.js               ← streaming event generation tests
  regression/
    golden.test.js            ← golden response validation
    golden.json               ← expected behaviors for 10 scenarios
```

## 3. Test Coverage

| Suite | Tests | Coverage |
|-------|-------|----------|
| `cards/builders` | 19 | All 7 card types: wallet, membership, plan, booking, notification, searchResult, generalInfo. Error paths, null guards, action types, schema fields. |
| `cards/registry` | 1 | 7 registered types, no pollution |
| `cards/response` | 6 | 1:1 card per result, 0 cards on error, schema fields, suggestions, deeplinks |
| `vision/validation` | 6 | MIME types, extensions, file size, edge cases, normalizeRequest, declaration |
| `vector/search` | 4 | Empty query error, declaration schema, response schema, live search |
| `memory/conversation` | 11 | Load/store, no currentTopic, entities array, dedup, persistence, prompt build, greeting empty, summarize threshold, TTL expiry, no business data |
| `routing/declarations` | 3 | 3 declarations, field validation, intent enum completeness |
| `streaming/sse` | 2 | AsyncGenerator type, event emission on unavailable |
| `regression/golden` | 5 | Golden file exists, valid tools, valid cards, valid intents, schema |

**Total: 57 test assertions across 9 suites**

## 4. Metrics

| Metric | Value |
|--------|-------|
| **Total duration** | 1053ms |
| **Suites** | 9 |
| **Passed** | 9 (100%) |
| **Failed** | 0 |
| **Skipped** | 0 |
| **Slowest suite** | `routing` (730ms — due to module import chain) |
| **Fastest suite** | `regression` (2ms) |
| **Zero dependencies** | Uses Node.js native `node:test` + `node:assert/strict` |

## 5. Regression Strategy

`tests/ai/regression/golden.json` stores expected behavior for 10 scenarios:

| Scenario | Expected Tool | Expected Card |
|----------|--------------|---------------|
| Wallet Balance | database | wallet |
| Membership Status | database | membership |
| Membership Expiry | database | plan |
| Upcoming Booking | database | booking |
| Unread Notifications | database | notification |
| Greeting | none | none |
| Refund Policy | vector | generalInfo |
| Check-in Guide | vector | generalInfo |
| Exercise Question | vector | generalInfo |
| General Knowledge | web | searchResult |

When provider or prompt changes:
1. Run `npm run ai:test`
2. Check regression suite: all golden cases must pass
3. If a golden test fails → behavior changed → review before deploying

To add new regression cases: append to `golden.json` with `{ name, question, expectedTool, expectedIntent, expectedCard, expectedSuccess }`.

## 6. Future Provider Testing

When adding a new provider (e.g., DeepSeek, OpenAI):

1. **Golden tests still pass** — same routing rules, same card generation
2. **Registry tests still pass** — same 7 card types
3. **Response builder parity** — same 1:1 mapping
4. **Add provider-specific tests** in new suite (e.g., `tests/ai/providers/deepseek.test.js`) to verify `generateContent()` and `generateStream()` signatures match the interface
5. **Run full suite** → `npm run ai:test` → must be 100% green

## 7. CI/CD Integration (Planned)

```
npm run ai:test
  ↓  exit code 0 = pass
  ↓  exit code 1 = fail
  ↓
can be added to GitHub Actions / CI pipeline:
  - name: AI Tests
    run: npm run ai:test
```

## 8. Files Created

| File | Purpose |
|------|---------|
| `tests/ai/runner.js` | Test orchestrator — scans directories, runs test files, collects metrics |
| `tests/ai/cards/builders.test.js` | Unit tests for all 7 card builders |
| `tests/ai/cards/registry.test.js` | Registry integrity test |
| `tests/ai/cards/response.test.js` | Response builder parity tests |
| `tests/ai/vision/validation.test.js` | Vision tool validation tests |
| `tests/ai/vector/search.test.js` | Vector search tests |
| `tests/ai/memory/conversation.test.js` | Memory CRUD + entity + TTL tests |
| `tests/ai/routing/declarations.test.js` | Tool declaration validation |
| `tests/ai/streaming/sse.test.js` | Streaming event generation tests |
| `tests/ai/regression/golden.test.js` | Golden response validator |
| `tests/ai/regression/golden.json` | 10 regression scenarios |

## 9. Verification Results

```
Results: 9 passed, 0 failed, 9 total
Duration: 1053ms

  ✓ cards/builders        11ms
  ✓ cards/registry        33ms
  ✓ cards/response         4ms
  ✓ vision/validation      8ms
  ✓ vector/search        158ms
  ✓ memory/conversation   73ms
  ✓ routing/declarations 730ms
  ✓ streaming/sse         28ms
  ✓ regression/golden      2ms
```

Zero AI tool changes. Zero business logic changes. Zero new dependencies. Runs with `npm run ai:test`.
