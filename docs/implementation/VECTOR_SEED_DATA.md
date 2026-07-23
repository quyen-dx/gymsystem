# GymPro AI Assistant — Vector Seed Data Specification

> **Status:** Implementation Specification  
> **Purpose:** Define the initial Vector Knowledge Base for GymPro AI Assistant  
> **Architecture:** MongoDB VectorDocument + cosine similarity (no ChromaDB)  
> **Embedding Model:** Gemini `text-embedding-004` (768 dimensions)

---

## 1. Overview

The Vector source answers GymPro internal knowledge questions:

- "Chính sách hoàn tiền như thế nào?"
- "Hướng dẫn tập Deadlift đúng cách?"
- "Làm sao để đăng ký gói tập?"
- "Quy định phòng gym là gì?"
- "Cách hủy lịch PT?"

All content is pre-embedded and stored in the existing MongoDB `VectorDocument` collection. Queries are answered via cosine similarity search.

---

## 2. Folder Structure

```
gym-backend/
└── ai-knowledge/                    # Git-tracked knowledge base
    ├── README.md                    # This document's summary
    │
    ├── faq/                         # Frequently Asked Questions
    │   ├── general.md               # General FAQ
    │   ├── membership.md            # Membership FAQ
    │   ├── booking.md               # Booking/PT FAQ
    │   ├── payment.md               # Payment/Wallet FAQ
    │   └── orders.md                # Orders/Shop FAQ
    │
    ├── policies/                    # Official GymPro Policies
    │   ├── refund-policy.md         # Refund Policy
    │   ├── privacy-policy.md        # Privacy Policy
    │   ├── terms-of-service.md      # Terms of Service
    │   ├── cancellation-policy.md   # Cancellation Policy
    │   ├── membership-terms.md      # Membership Terms
    │   └── code-of-conduct.md       # Gym Code of Conduct
    │
    ├── guides/                      # User Guides
    │   ├── membership-guide.md      # How to use membership
    │   ├── booking-guide.md         # How to book PT
    │   ├── wallet-guide.md          # How to use wallet
    │   ├── checkin-guide.md         # How to check in
    │   └── shop-guide.md            # How to shop
    │
    ├── exercises/                   # Exercise Library
    │   ├── chest.md                 # Chest exercises
    │   ├── back.md                  # Back exercises
    │   ├── legs.md                  # Leg exercises
    │   ├── shoulders.md             # Shoulder exercises
    │   ├── arms.md                  # Arm exercises
    │   ├── core.md                  # Core exercises
    │   └── compound.md              # Compound lifts
    │
    ├── nutrition/                   # Nutrition Guides
    │   ├── protein-guide.md         # Protein requirements
    │   ├── meal-timing.md           # Meal timing
    │   ├── pre-workout.md           # Pre-workout nutrition
    │   ├── post-workout.md          # Post-workout recovery
    │   ├── supplements.md           # Supplement guide
    │   └── hydration.md             # Hydration guide
    │
    ├── gym-rules/                   # Gym Rules & Constitution
    │   ├── general-rules.md         # General gym rules
    │   ├── equipment-rules.md       # Equipment usage rules
    │   ├── locker-room.md           # Locker room policy
    │   ├── guest-policy.md          # Guest policy
    │   └── safety-rules.md          # Safety rules
    │
    ├── prompts/                     # Prompt Library (internal)
    │   ├── system-prompt-vi.md      # Vietnamese system prompt
    │   ├── system-prompt-en.md      # English system prompt
    │   └── response-templates.md    # Response templates
    │
    └── business-rules/              # Business Rules
        ├── membership-rules.md      # Membership business rules
        ├── booking-rules.md         # Booking business rules
        ├── refund-rules.md          # Refund calculation rules
        ├── checkin-rules.md         # Check-in rules
        ├── wallet-rules.md          # Wallet rules
        ├── order-rules.md           # Order processing rules
        └── pt-rules.md              # PT assignment rules
```

**Total documents: ~45 files**

---

## 3. Markdown Format (Every Document Must Follow This)

```markdown
---
source: faq                    # One of: faq, policy, guide, exercise, nutrition, gym_rules, prompt, business_rules
sourceId: faq-membership-001   # Unique identifier within source (used for update tracking)
title: "Cách đăng ký gói tập"
language: vi                    # vi | en
tags: [membership, đăng ký, gói tập, hội viên]
version: 1                      # Integer, increment on content change
lastUpdated: 2026-07-22
---

# Cách đăng ký gói tập

## Câu hỏi
Làm sao để đăng ký gói tập tại GymPro?

## Câu trả lời
Để đăng ký gói tập tại GymPro, bạn làm theo các bước sau:

1. Truy cập trang **Membership** trên website hoặc app GymPro.
2. Chọn gói tập phù hợp: Basic, Gold, hoặc Platinum.
3. Chọn phương thức thanh toán: Ví GymPro, thẻ ngân hàng, hoặc VNPay.
4. Xác nhận đăng ký.

Sau khi thanh toán thành công, gói tập sẽ được kích hoạt ngay lập tức.

## Liên kết
[Xem các gói tập →](/membership/plans)
[Xem hướng dẫn chi tiết →](/guides/membership)

---

## Câu hỏi
Tôi có thể đổi gói tập sau khi đăng ký không?

## Câu trả lời
Có, bạn có thể nâng cấp hoặc hạ cấp gói tập. Việc thay đổi sẽ có hiệu lực vào chu kỳ tiếp theo. Vui lòng liên hệ nhân viên gym hoặc truy cập trang Membership để thực hiện.
```

### 3.1 Frontmatter Fields (Required)

| Field | Type | Description |
|-------|------|-------------|
| `source` | enum | `faq`, `policy`, `guide`, `exercise`, `nutrition`, `gym_rules`, `prompt`, `business_rules` |
| `sourceId` | string | Unique identifier. Format: `{source}-{category}-{number}`. Used for update deduplication. |
| `title` | string | Human-readable title in the document's language |
| `language` | string | `vi` or `en` |
| `tags` | string[] | 3-5 relevant keywords for metadata filtering (optional but recommended) |
| `version` | integer | Increment on every content edit |
| `lastUpdated` | date | ISO date of last content change |

### 3.2 Content Rules

- Each `## Câu hỏi` / `## Câu trả lời` pair becomes one chunk
- `## Câu hỏi` is the question/section title
- `## Câu trả lời` is the answer content
- Multiple Q&A pairs per file are allowed (each becomes a separate vector document)
- Minimum content length: 50 characters (shorter = not useful for search)
- Maximum content per chunk: 1024 tokens (~2500 Vietnamese characters)
- Links to existing pages use `[text →](/route)` format

---

## 4. Embedding Strategy

### 4.1 Chunking

```
┌─────────────────────────────────────────────────────────────────┐
│  CHUNKING RULES                                                  │
│                                                                  │
│  1. Split by `## ` heading sections                             │
│  2. Each `## Câu hỏi` + `## Câu trả lời` pair = 1 chunk        │
│  3. If a single answer exceeds 1024 tokens:                     │
│     → Split at paragraph boundaries (double newline)            │
│     → Overlap: 128 tokens (last 2-3 sentences of previous chunk)│
│     → Add chunk suffix: " (phần 1/2)", " (phần 2/2)"            │
│  4. If a chunk is under 50 chars: merge with next chunk         │
│                                                                  │
│  Target: ~200-400 chunks for 45 source documents                 │
│  Estimated: ~500 chunks with multi-section splits                │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Chunk Example

```
Source document (faq/membership.md):

  ## Câu hỏi
  Làm sao để đăng ký gói tập?

  ## Câu trả lời
  Để đăng ký gói tập tại GymPro, bạn làm theo các bước sau:
  1. Truy cập trang Membership...
  2. Chọn gói tập phù hợp...
  3. Chọn phương thức thanh toán...
  4. Xác nhận đăng ký...

↓ Chunked into ↓

VectorDocument {
  source: "faq",
  sourceId: "faq-membership-001",
  title: "Cách đăng ký gói tập",
  content: "Câu hỏi: Làm sao để đăng ký gói tập?\n\nCâu trả lời: Để đăng ký gói tập tại GymPro, bạn làm theo các bước sau:\n1. Truy cập trang Membership...\n2. Chọn gói tập phù hợp...\n3. Chọn phương thức thanh toán...\n4. Xác nhận đăng ký...",
  language: "vi",
  chunkIndex: 0,
  contentHash: "sha256_of_content",
  embedding: [0.123, -0.456, ...]  // 768 floats from text-embedding-004
}
```

### 4.3 Embedding Generation

```
Pipeline (runs on deployment and on content update):

1. Read all .md files from ai-knowledge/
2. Parse frontmatter (source, sourceId, title, language, version)
3. Chunk content per Section 4.1 rules
4. For each chunk:
   a. Compute contentHash = SHA256(content)
   b. Check MongoDB: does VectorDocument with this contentHash exist?
      YES → Skip (already embedded)
      NO  → Continue
   c. Call Gemini text-embedding-004 API
      Input: content string
      Output: float[768]
   d. Upsert VectorDocument:
      {
        source, sourceId, title,
        content, language,
        chunkIndex, contentHash,
        embedding: float[768],
        metadata: { tags, version, lastUpdated }
      }
5. Remove orphaned chunks: any VectorDocument whose sourceId
   exists in DB but NOT in the current ai-knowledge/ files

Estimated time: ~3 seconds for 500 chunks
Estimated cost: ~$0.01 for full re-embedding
```

---

## 5. Update Strategy

### 5.1 When to Re-Embed

```
┌─────────────────────────────────────────────────────────────────┐
│  TRIGGER                    │  ACTION                           │
├─────────────────────────────┼───────────────────────────────────┤
│  New .md file added         │  Chunk + embed new file only      │
│  Existing .md file edited   │  Delete old chunks by sourceId,   │
│                             │  re-chunk + re-embed              │
│  .md file deleted           │  Remove chunks by sourceId        │
│  System prompt changes      │  Re-embed prompts/ directory      │
│  GymPro policy changes      │  Re-embed policies/ directory     │
│  New FAQ entries in MongoDB │  Sync to faq/ .md files first,    │
│                             │  then re-embed                    │
│  Weekly scheduled check     │  Compare contentHash for all docs │
│                             │  Re-embed any with mismatch       │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Seed Command

```bash
# Run on first deployment and after any knowledge base change:
npm run ai:seed-vectors

# What it does:
# 1. Scans ai-knowledge/ for all .md files
# 2. Parses frontmatter
# 3. Chunks content
# 4. Generates embeddings via text-embedding-004
# 5. Upserts to MongoDB VectorDocument collection
# 6. Removes orphaned documents
# 7. Reports: [total docs, new, updated, skipped, deleted]

# Dry run (preview without writing):
npm run ai:seed-vectors -- --dry-run

# Re-embed specific source only:
npm run ai:seed-vectors -- --source=faq
npm run ai:seed-vectors -- --source=policies
```

### 5.3 In-Memory Index Warm-Up (on Server Start)

```
On Express server startup:
1. Load all VectorDocument embeddings from MongoDB
2. Store in memory as: { id, content, title, source, sourceId, embedding[] }[]
3. Estimate memory: 2000 docs × 768 floats × 4 bytes = ~6MB
4. Rebuild index on VectorDocument collection change (MongoDB change stream)
```

---

## 6. Seed Document Content — Minimum Required

### 6.1 FAQ Documents (faq/)

Minimum 25 Q&A pairs covering all user roles:

| File | Questions | Examples |
|------|-----------|----------|
| `general.md` | 5 | Giờ mở cửa? Wifi password? Gửi xe? Địa chỉ gym? Liên hệ? |
| `membership.md` | 6 | Cách đăng ký? Các gói tập? Hết hạn thì sao? Đóng băng? Hủy gói? Nâng cấp? |
| `booking.md` | 5 | Cách đặt PT? Hủy lịch? Đổi lịch? Trễ buổi tập? Không có PT phù hợp? |
| `payment.md` | 5 | Cách nạp tiền? Phương thức thanh toán? Hoàn tiền? Ví âm? Rút tiền? |
| `orders.md` | 4 | Cách đặt hàng? Theo dõi đơn? Đổi trả? Phí ship? |

### 6.2 Policy Documents (policies/)

Minimum 6 policy documents extracted from the existing MongoDB Policy collection:

| File | Content Source |
|------|---------------|
| `refund-policy.md` | Policy model, type = "refund" |
| `privacy-policy.md` | Policy model, type = "privacy" |
| `terms-of-service.md` | Policy model, type = "terms" |
| `cancellation-policy.md` | Policy model, type = "cancellation" |
| `membership-terms.md` | Policy model, type = "membership" |
| `code-of-conduct.md` | Policy model, type = "conduct" |

### 6.3 Guide Documents (guides/)

Minimum 5 guides:

| File | Content |
|------|---------|
| `membership-guide.md` | Step-by-step: register, renew, freeze, cancel, upgrade |
| `booking-guide.md` | Step-by-step: book PT, choose trainer, manage schedule |
| `wallet-guide.md` | How to top-up, check balance, view transactions, use points |
| `checkin-guide.md` | How to check in via QR, manual check-in, streak tracking |
| `shop-guide.md` | How to browse, order, track delivery, return items |

### 6.4 Exercise Documents (exercises/)

Minimum 20 exercises:

| File | Exercises |
|------|-----------|
| `chest.md` | Bench Press, Incline Dumbbell Press, Cable Fly, Push-up |
| `back.md` | Deadlift, Pull-up, Barbell Row, Lat Pulldown |
| `legs.md` | Squat, Leg Press, Romanian Deadlift, Bulgarian Split Squat |
| `shoulders.md` | Overhead Press, Lateral Raise, Face Pull |
| `arms.md` | Bicep Curl, Tricep Pushdown, Hammer Curl |
| `core.md` | Plank, Hanging Leg Raise, Cable Crunch |
| `compound.md` | Clean & Jerk, Snatch (advanced only) |

Each exercise entry includes:
- Tên bài tập (Exercise name)
- Nhóm cơ chính (Primary muscles)
- Hướng dẫn thực hiện (How to perform)
- Lỗi thường gặp (Common mistakes)
- Mẹo (Tips)
- Cấp độ (Level: beginner/intermediate/advanced)

### 6.5 Nutrition Documents (nutrition/)

Minimum 6 guides:

| File | Content |
|------|---------|
| `protein-guide.md` | Daily protein requirements by body weight and goal |
| `meal-timing.md` | When to eat relative to workout |
| `pre-workout.md` | What to eat before training |
| `post-workout.md` | Recovery nutrition |
| `supplements.md` | Common supplements: creatine, whey, BCAAs, pre-workout |
| `hydration.md` | Water intake guidelines for athletes |

### 6.6 Gym Rules (gym-rules/)

Minimum 5 documents:

| File | Content |
|------|---------|
| `general-rules.md` | Gym etiquette, dress code, hours |
| `equipment-rules.md` | How to use/return equipment, weight limits |
| `locker-room.md` | Locker usage, towel service, shower rules |
| `guest-policy.md` | Bringing guests, guest fees, limitations |
| `safety-rules.md` | Emergency exits, first aid, spotting rules |

### 6.7 Business Rules (business-rules/)

Minimum 7 documents. These are NOT user-facing policies. They define HOW the system calculates things.

| File | Content Example |
|------|----------------|
| `membership-rules.md` | Plan pricing tiers, duration calculation, upgrade rules, freeze limits |
| `booking-rules.md` | Slot availability, cancellation window, no-show policy, reschedule rules |
| `refund-rules.md` | Refund calculation formula, eligibility windows, pro-rata rules |
| `checkin-rules.md` | Check-in window, streak calculation, missed day handling |
| `wallet-rules.md` | Top-up minimums, point earning rates, point redemption rules |
| `order-rules.md` | Order processing flow, status transitions, auto-cancel rules |
| `pt-rules.md` | PT assignment limits, qualification requirements, rating system |

---

## 7. Quality Standards

### 7.1 Content Requirements

```
✓ Written in Vietnamese (primary). Optional English translations.
✓ Clear, simple language. 8th-grade reading level.
✓ Each question has exactly one answer (no ambiguity).
✓ Links to existing GymPro pages where applicable.
✓ No marketing language. Factual only.
✓ No personal opinions. Policy/rule citations only.
✓ Answers are self-contained. Readable without context.
```

### 7.2 Minimum Viable Seed

To launch, following minimum counts:

| Category | Minimum Documents | Minimum Chunks |
|----------|------------------|----------------|
| FAQ | 5 files, 25 Q&A pairs | 25 |
| Policies | 6 files | 30 |
| Guides | 5 files | 25 |
| Exercises | 7 files, 20 exercises | 20 |
| Nutrition | 6 files | 18 |
| Gym Rules | 5 files | 15 |
| Business Rules | 7 files | 35 |
| Prompts | 3 files | 3 |
| **TOTAL** | **44 files** | **~171 chunks** |

This is enough to launch. Expand to 500+ chunks over time.

### 7.3 Verification Checklist

Before seeding, verify:

```
□ All .md files have valid frontmatter (source, sourceId, title, language, version)
□ No duplicate sourceId across files
□ All answers are in Vietnamese (unless language: en)
□ All links in content are valid routes (check against existing React routes)
□ Business rules match actual service logic (validate with backend team)
□ Policy content matches live Policy collection in MongoDB
□ FAQ content matches live FAQ collection in MongoDB
□ Exercise descriptions reviewed by a PT
□ Nutrition guides reviewed by a nutritionist
□ Run dry-run seed — no errors
□ Run full seed — confirm chunk count matches expectation
□ Run 5 test queries — confirm relevant chunks returned at similarity ≥ 0.75
```

---

## 8. Search Configuration

### 8.1 Query-Time Parameters

```
┌─────────────────────────────────────────────────────────────────┐
│  PARAMETER           │  VALUE    │  NOTES                       │
├──────────────────────┼───────────┼───────────────────────────────┤
│  Embedding model     │  text-embedding-004  │ Gemini, 768 dim    │
│  Top K               │  5         │  Return top 5 most similar   │
│  Similarity threshold│  0.75      │  Below this → fallback to web│
│  Similarity metric   │  cosine    │  Dot product of normalized   │
│                      │            │  vectors                     │
│  Source filter       │  optional  │  If LLM specifies source type│
│  Language filter     │  auto      │  Match user message language │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Search Function Pseudocode

```
function vectorQuery(query, userId, language):
    1. embedding = await generateEmbedding(query)
    2. Normalize embedding to unit length
    3. candidates = load all VectorDocument embeddings from memory
    4. For each candidate:
         similarity = dotProduct(embedding, candidate.embedding)
         Filter: candidate.language == language (if set)
         Filter: candidate.similarity >= 0.75
    5. Sort by similarity descending
    6. Take top 5
    7. Return [{ content, source, title, score }]
    8. If no results above threshold → signal FALLBACK
```

---

## 9. Versioning

### 9.1 Version Tracking

```
ai-knowledge/
└── VERSION                          # Git-tracked version file

VERSION file format:
---
version: 1
date: 2026-07-22
changes:
  - Initial seed: 44 documents, 171 chunks
---

When content changes:
1. Update frontmatter version in changed .md files
2. Update VERSION file
3. Commit to Git
4. Run npm run ai:seed-vectors
5. Deploy

Rollback:
1. Git checkout previous VERSION
2. Run npm run ai:seed-vectors (deletes orphaned, re-embeds correct versions)
```

### 9.2 Git Strategy

- `ai-knowledge/` is part of the main repository
- Content changes go through normal PR review
- At least one backend engineer + one domain expert (PT/nutritionist/staff) reviews
- No direct commits to main branch for ai-knowledge/
- Every PR must include VERSION bump

---

## 10. Initial Seed Checklist

```
□ Create ai-knowledge/ directory with all subdirectories
□ Write 5 FAQ files (25 Q&A pairs) in Vietnamese
□ Extract 6 policy documents from existing MongoDB Policy collection
□ Write 5 user guides
□ Write 7 exercise files (20 exercises) with PT review
□ Write 6 nutrition files with nutritionist review
□ Write 5 gym rules files
□ Write 7 business rules files (validate against actual service logic)
□ Write 3 prompt files (system prompts + templates)
□ Validate all frontmatter
□ Validate no duplicate sourceId
□ Run --dry-run seed
□ Run full seed
□ Verify ~171 chunks in MongoDB VectorDocument collection
□ Test 5 sample queries, verify results at similarity ≥ 0.75
□ Commit all files to Git
□ Tag release: v1.0-knowledge-base
```
