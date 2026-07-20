# Deployment Guide — GymPro

> **Last Updated:** 2026-07-20
> **Status:** Draft — to be completed before first production deployment

---

## Prerequisites

- Node.js 20+ (LTS)
- MongoDB 7.x (replica set required for transactions)
- Docker & Docker Compose (for production)
- Cloudinary account (for media storage)
- VNPAY merchant account (for domestic payments)
- Stripe account (for international payments)
- GHN API key (for shipping)
- SMTP server or SendGrid account (for email)
- Twilio or SpeedSMS account (for SMS)

---

## Environment Variables

Required environment variables (see `.env.example` in each workspace):

### Backend (`gym-backend/.env`)

```
MONGODB_URI=mongodb://<user>:<pass>@<host>:<port>/gympro?replicaSet=rs0&w=majority
MONGODB_LOCAL_URI=mongodb://localhost:27017/gympro
JWT_SECRET=<generated-secret>
JWT_REFRESH_SECRET=<generated-secret>
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
STRIPE_SECRET_KEY=<sk_live_xxx>
STRIPE_WEBHOOK_SECRET=<whsec_xxx>
VNPAY_TMN_CODE=<code>
VNPAY_HASH_SECRET=<secret>
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
GHN_TOKEN=<token>
GHN_SHOP_ID=<id>
MAIL_HOST=<smtp.example.com>
MAIL_PORT=587
MAIL_USER=<user>
MAIL_PASS=<pass>
```

### Frontend (`gym-frontend/.env`)

```
VITE_API_URL=https://api.gympro.example.com
VITE_SOCKET_URL=https://api.gympro.example.com
```

---

## Build Commands

```bash
# Backend
cd gym-backend
npm run build      # Compile TypeScript (if TS)
npm run start      # Production start

# Frontend
cd gym-frontend
npm run build      # Production build to dist/
```

---

## Docker Deployment

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart backend
```

### docker-compose.yml (template)

```yaml
services:
  backend:
    build: ./gym-backend
    ports: ["3000:3000"]
    env_file: ./gym-backend/.env
    depends_on: [mongo]
  frontend:
    build: ./gym-frontend
    ports: ["80:80"]
  mongo:
    image: mongo:7
    volumes: [mongo_data:/data/db]
    command: --replSet rs0
volumes:
  mongo_data:
```

---

## Database Backups

- Daily automated mongodump to cloud storage
- Retention: 7 daily, 4 weekly, 3 monthly
- Point-in-time recovery via oplog

---

## Monitoring

- API health endpoint: `GET /api/health`
- Memory/CPU via PM2 metrics
- Slow query log (>100ms) for MongoDB
- Error tracking: Winston structured JSON logs

---

## Security Checklist

- [ ] Helmet middleware enabled
- [ ] Rate limiting on auth endpoints (5 req/min per IP)
- [ ] CORS restricted to known origins
- [ ] HTTPS only (TLS 1.2+)
- [ ] HSTS header enabled
- [ ] Content Security Policy header set
- [ ] webhook signature verification active (Stripe, VNPAY)
- [ ] .env files excluded from version control
- [ ] JWT secrets rotated and strong
- [ ] MongoDB authentication enabled
- [ ] Firewall restricts database access

---

## References

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) — Full system architecture
- [DATABASE.md](./DATABASE.md) — Database schema and backup strategy
