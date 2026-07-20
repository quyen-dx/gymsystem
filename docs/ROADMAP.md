# Project Roadmap — GymPro

> **Last Updated:** 2026-07-20

---

## Current State

Post-MVP, pre-production. Documentation is being synchronized. Security hardening is the next implementation priority.

---

## Phase 0: Foundation & Fixes (2 weeks)

| Sprint | Focus | Key Deliverables |
|--------|-------|-----------------|
| 0.1 | Documentation Resolution | All CRITICAL + HIGH doc issues fixed |
| 0.2 | Security Hardening | Helmet, rate limiting, Zod validation, webhook signatures, audit logging |

---

## Phase 1: Core Business Foundations (3 weeks)

| Sprint | Module | Key Deliverables |
|--------|--------|-----------------|
| 1.1 | Membership | Purchase flow, state machine, freeze, refund engine, expiry cron, trial rules |
| 1.2 | Payment & Wallet | VNPAY/Stripe finalization, idempotency, atomic transactions, dual-entry ledger |
| 1.3 | Booking & Schedule | Slot management, confirmation flow, recurring bookings, waitlist |

---

## Phase 2: Operations & Experience (3 weeks)

| Sprint | Module | Key Deliverables |
|--------|--------|-----------------|
| 2.1 | Check-in & Streaks | QR with HMAC, auto-activation, streak tracking, hour validation |
| 2.2 | Shop & Orders | Catalog, atomic checkout, GHN integration, escrow, returns |
| 2.3 | Notifications | Email/SMS/in-app delivery, templates, preferences, batched delivery |

---

## Phase 3: Intelligence & Analytics (2 weeks)

| Sprint | Module | Key Deliverables |
|--------|--------|-----------------|
| 3.1 | AI Assistant | Gateway, intent classifier, permission engine, tool router, streaming |
| 3.2 | Reports | Revenue, membership, check-in, trainer, product analytics; CSV export |

---

## Phase 4: Infrastructure & Production (2 weeks)

| Sprint | Focus | Key Deliverables |
|--------|-------|-----------------|
| 4.1 | System Operations | DB monitoring, cron reliability, circuit breaker, structured logging |
| 4.2 | Production Readiness | Docker compose, CI/CD, backups, SSL, CDN, load testing, pen test |

---

## Phase 5: Polish & Launch (1 week)

| Sprint | Focus | Key Deliverables |
|--------|-------|-----------------|
| 5.1 | Frontend Polish | Responsive, a11y, loading/error states, bilingual, bundle optimization |
| 5.2 | Documentation & Handover | Final docs, deployment guide, handover to ops |

---

## Future (Post-Launch)

- Electron desktop distribution
- Mobile app (React Native)
- AI-powered PT scheduling optimization
- Gym location geospatial search
- Class/group session booking
- Multi-gym franchise support
- International expansion (English-first UI)
- Member referral program
- Integration with wearable fitness devices

---

## References

- [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) — Detailed technical plan
- [BUSINESS_BLUEPRINT.md](./BUSINESS_BLUEPRINT.md) — Business model and objectives
