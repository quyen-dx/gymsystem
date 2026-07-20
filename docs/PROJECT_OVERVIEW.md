# GymPro — Project Overview

> **Document Status:** Active  
> **Last Updated:** 2026-07-20  
> **Version:** 1.0.0 (Post-MVP)

---

## 1. Project Name

**GymPro** — Gym Management System

---

## 2. Mission

Provide a unified, production-grade gym management platform enabling gyms to manage memberships, training, scheduling, payments, e-commerce, and member wellness through a single system.

---

## 3. Vision

Become the leading all-in-one gym ERP in Vietnam, serving 1000+ gyms with zero-downtime operations, automated billing, AI-driven coaching, and real-time analytics.

---

## 4. Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 8 | Build tooling |
| Ant Design | 6 | UI component library |
| Tailwind CSS | 4 | Utility-first styling |
| React Router | 7 | Client-side routing |
| TanStack Query | 5 | Server state management |
| Framer Motion | 12 | Animation library |
| Recharts | 3 | Data visualization |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | — | Runtime |
| Express | 5 | HTTP framework |
| Mongoose | 9 | MongoDB ODM |
| Passport.js | 0.7 | Authentication strategies |
| Socket.io | 4.8 | Real-time communication |
| JSON Web Tokens | 9 | Stateless auth |
| Zod | 3 | Schema validation |

### Database

- **Primary:** MongoDB Atlas
- **Fallback:** Local MongoDB

### AI

| Service | Purpose |
|---|---|
| Google Gemini 2.5 Flash | Conversational AI assistant |
| Tavily Search | Web search augmentation |
| OpenRouter | Fallback LLM provider |

### Payments

| Gateway | Market |
|---|---|
| VNPAY | Vietnam (domestic) |
| Stripe | International |

### Infrastructure

| Tool | Purpose |
|---|---|
| Docker | Containerization |
| Cloudinary | Media management & CDN |
| GHN (Giao Hàng Nhanh) | E-commerce shipping |
| Nodemailer | Email delivery |
| Twilio / SpeedSMS | SMS notifications |

### Desktop (Future)

- **Electron** — Native desktop distribution for Windows, macOS, and Linux.

---

## 5. System Architecture Overview

GymPro follows a **monorepo** structure with two primary application folders:

- **`gym-frontend/`** — React SPA built with Vite. Communicates with the backend via REST API and WebSocket (Socket.io).
- **`gym-backend/`** — Express REST API server. Connects to MongoDB (Atlas or local), integrates with third-party services (Cloudinary, Stripe, VNPAY, GHN, Nodemailer, Twilio), and runs scheduled cron jobs for automated operations.

Additional top-level directories:

- **`electron/`** — Electron shell configuration for desktop distribution.
- **`dist/`** — Build artifacts for the desktop installer.
- **`docs/`** — Architecture decision records (ADR), module specifications, and system documentation.

The frontend and backend are fully decoupled and communicate exclusively over HTTP/WebSocket, making it possible to deploy, scale, and maintain each layer independently.

---

## 6. Key Features

- **Membership Management** — Plans, cycles, renewals, cancellations, refunds, plan upgrades/downgrades.
- **PT Booking System** — Trainer availability, waitlist management, recurring schedule support.
- **QR Check-In** — Daily QR-based attendance with streak tracking and automatic membership activation on first check-in.
- **E-Commerce Shop** — Multi-vendor product catalog with GHN shipping integration.
- **Wallet System** — Digital wallet with VNPAY and Stripe deposit support, automated refunds.
- **AI Assistant** — Gemini-powered conversational agent for member support and queries.
- **Role-Based Dashboards** — Separate views and permissions for Admin, PT, Staff, Seller, and Member roles.
- **Bilingual Support** — Full Vietnamese and English interface.

---

## 7. Target Users

- **Primary:** Gyms and fitness centers in Vietnam
- **Secondary:** International expansion planned as a phased rollout

---

## 8. Project Status

**Post-MVP, pre-production.**

The core feature set has been implemented and tested. The application is not yet deployed to production. Critical security and payment processing issues have been identified and are being tracked. See `CURRENT_PHASE.md` for the detailed status and remediation plan.

---

## 9. Module List

| Module | Description |
|---|---|
| **Auth** | User registration, login, OAuth (Google, Facebook), JWT management, role-based access control |
| **Membership** | Plan definitions, subscription lifecycle, renewal, cancellation, refund, plan change with cycle-based state machine |
| **Booking** | Personal trainer session booking, availability management, waitlist, recurring scheduling |
| **Check-in** | QR code generation and scanning, attendance tracking, streak counting, auto-activation of membership cycles |
| **Workout** | Workout program creation, assignment, progress tracking |
| **Schedule** | Class and event scheduling, calendar management, conflict detection |
| **Trainer** | Trainer profile management, specialization tracking, assignment to members |
| **Payment** | Payment processing (VNPAY, Stripe), invoice generation, transaction history, refund orchestration |
| **Wallet** | Member digital wallet, deposits, credit tracking, automated refund crediting |
| **Shop** | E-commerce storefront, multi-vendor product listing, cart, checkout |
| **Product** | Product CRUD, inventory management, category tree, media upload |
| **Notification** | Email (Nodemailer), SMS (Twilio/SpeedSMS), in-app (Socket.io) notification delivery |
| **Report** | Business intelligence, revenue analytics, member growth, trainer performance, export (Excel/PDF) |
| **Content** | Static page management, blog/articles, banner management, SEO metadata |
| **System Settings** | Global configuration, gym profile, SMS/email templates, payment gateway credentials, role permissions |
| **AI Assistant** | Gemini-powered chatbot, context-aware responses, Tavily web search augmentation, OpenRouter fallback |
