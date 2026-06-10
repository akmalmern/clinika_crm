# 🏥 Klinika CRM — Multi-Tenant SaaS

Ko'p klinikaga xizmat qiluvchi, abonent to'lovli SaaS Klinika CRM platformasi.

> **Stack:** NestJS 11 · PostgreSQL 16 · Prisma 6 · Redis 7 · MinIO · BullMQ · Next.js 14 (App Router) · Nginx · Docker

Bosqichma-bosqich (Phase) quriladi. **Hozirgi holat: backend Phase 1–7B + frontend 8A–8C + Phase 9A (production tayyorgarligi).**

---

## 📦 Monorepo struktura

```
clinica_crm/
├── server/              # NestJS backend
│   ├── prisma/          # schema + migratsiyalar + seed
│   └── src/
│       ├── common/      # guard, decorator, filter, interceptor, constants, utils, dto
│       ├── config/      # env validatsiya + tipizatsiyalangan config
│       ├── core/        # prisma (+extensions), tenant (ALS), redis
│       ├── health/      # /health, /ready
│       └── modules/     # auth, audit, plans, clinics, subscriptions, members
├── client/              # Next.js frontend (Phase 8)
└── docker-compose.yml   # postgres + redis + minio + backend
```

---

## ✅ Bajarilgan bosqichlar

**Phase 1 — Asos:** Docker infra, Prisma, Auth (JWT access+refresh, Redis), RBAC guards,
Tenant middleware + Prisma extension (avtomatik `clinic_id` + soft-delete filtri),
Audit infra, health, standart javob konverti, Swagger, seed.

**Phase 2 — SaaS yadrosi:**
- **Tariflar (plans):** `subscription_plans` CRUD (faqat SUPER_ADMIN), `limits`/`features` JSON, pul `Decimal`.
- **Klinika CRUD:** SUPER_ADMIN klinika qo'shadi → avtomatik **CLINIC_ADMIN** foydalanuvchi + **xavfsiz parol generatsiyasi** (argon2) + **obuna** (TRIAL/ACTIVE) bitta tranzaksiyada.
- **clinic_members:** klinika admini xodim qo'shadi/ko'radi (yangi user yoki mavjudini biriktirish — bir nechta klinika a'zoligi). Unique `(user_id, clinic_id)`.
- **Subscription:** statuslar ACTIVE/TRIAL/PAST_DUE/SUSPENDED/CANCELLED, `start/end/next_billing/grace`.
- **Suspend guard:** SUSPENDED klinika foydalanuvchilari faqat `@AllowSuspended` route'larni ko'radi (billing holati) — qolgani 403 `PAYMENT_REQUIRED`. SUPER_ADMIN mustasno.
- **Klinika foydalanuvchi login:** `email + password + clinicSlug` (bir email bir nechta klinikada bo'lishi mumkin).
- **Super Admin dashboard:** klinikalar ro'yxati (holat, obuna, a'zolar soni) + pagination + qidiruv + filter.

---

## 🚀 Tez ishga tushirish (Docker)

```bash
cp server/.env.example server/.env
docker compose up -d --build
docker compose logs -f backend     # migrate deploy + seed avtomatik
```

- API: <http://localhost:3000/api/v1> · Swagger: <http://localhost:3000/api/docs>
- MinIO konsol: <http://localhost:9001> (`minioadmin`/`minioadmin`)

### Lokal (faqat infra Docker'da)

```bash
docker compose up -d postgres redis minio minio_init
cd server
cp .env.example .env
npm install
npm run prisma:generate
npx prisma migrate dev        # yoki: npm run prisma:deploy
npm run db:seed               # Super Admin + BASIC/STANDARD/PREMIUM tariflar
npm run start:dev
```

---

## 🔐 Phase 2 tekshirish (Definition of Done)

Standart Super Admin: `admin@clinic-crm.uz` / `Admin12345!`

```bash
# 1) Super Admin login
SA=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinic-crm.uz","password":"Admin12345!"}' | jq -r .data.tokens.accessToken)

# 2) Tariflar (seed bilan keladi)
curl -s http://localhost:3000/api/v1/super-admin/plans -H "Authorization: Bearer $SA"

# 3) Klinika qo'shish -> login + generatsiya qilingan parol qaytadi
curl -s -X POST http://localhost:3000/api/v1/super-admin/clinics \
  -H "Authorization: Bearer $SA" -H "Content-Type: application/json" \
  -d '{"name":"Demo Klinika","adminFullName":"Vali Aliyev","adminEmail":"admin@demo.uz"}'
# -> data.admin.temporaryPassword + data.clinic.slug ni oling

# 4) CLINIC_ADMIN login (clinicSlug bilan)
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.uz","password":"<TEMP_PAROL>","clinicSlug":"demo-klinika"}'

# 5) Klinikani SUSPEND qilish
curl -s -X POST http://localhost:3000/api/v1/super-admin/clinics/<CLINIC_ID>/suspend \
  -H "Authorization: Bearer $SA"

# 6) Endi CLINIC_ADMIN himoyalangan endpoint'ga kira olmaydi (403 PAYMENT_REQUIRED),
#    lekin /billing/status (AllowSuspended) ko'rinadi.
```

**DoD holati:** ✅ klinika qo'shilganda login/parol generatsiya · ✅ SUSPENDED bloklanishi (test bilan) · ✅ tenant izolyatsiya (A≠B test) · ✅ `prisma migrate dev` / `docker compose up`.

---

## 🧪 Sifat

```bash
cd server
npm run typecheck && npm run lint && npm run test:cov && npm run test:e2e
```

Joriy: **unit 29 suite / 131 test + e2e 7 suite / 25 test** o'tadi — auth, tenant izolyatsiya
(`applyClinicScope`), billing/idempotency (Payme/Click/Manual), double-booking, qisman
to'lov, fayl xavfsizligi (signed URL + tenant), EMR ruxsatlari, health/ready (200/503),
maydon shifrlash (roundtrip + kalit rotatsiyasi + shaffof enc/dec). Coverage: `npm run test:cov`.

Frontend:

```bash
cd client
npm run lint && npm run type-check && npm run build
```

---

## 📊 Observability (Phase 9A)

| Imkoniyat | Tafsilot |
|---|---|
| **Strukturalangan log (pino)** | Prod'da JSON, dev'da pretty. Har qatorda `requestId` (xato javobi + audit bilan bir xil) + `clinicId`. Token/parol/cookie redaktsiya qilinadi. |
| **Request tracing** | Har javobda `x-request-id` header; kelgan `x-request-id` qayta ishlatiladi. |
| **Sentry** | `SENTRY_DSN` berilsa yoqiladi — 5xx/kutilmagan xatolar yuboriladi (DSN bo'sh bo'lsa o'chiq). |
| **`/api/v1/health`** | Liveness — har doim 200 (`{status:ok, uptime}`). |
| **`/api/v1/ready`** | Readiness — DB + Redis + MinIO tekshiradi; biror tarmoq tushgan bo'lsa **503** (LB/K8s trafik yubormaydi). |
| **`/api/v1/metrics`** | Prometheus: `http_requests_total`, `http_request_duration_seconds` (method/route/status) + Node metrikalari. `METRICS_ENABLED=false` → 404. |

Sozlash: `LOG_LEVEL`, `SENTRY_DSN`, `SENTRY_ENV`, `SENTRY_TRACES_SAMPLE_RATE`, `METRICS_ENABLED`
(`.env.example`'ga qarang). **Env validatsiyasi** (`config/env.validation.ts`) ishga tushishda
majburiy o'zgaruvchilarni tekshiradi — yo'q/noto'g'ri bo'lsa server **umuman ko'tarilmaydi** (fail-fast).

---

## 🔒 Ma'lumot xavfsizligi va barqarorlik (Phase 9B)

### Backup + tiklash sinovi (`ops/backup/`)

> Sinalmagan backup = ishonchsiz backup. `pg-restore-test` har kuni backup'ni
> **bo'sh bazaga tiklab** butunligini tekshiradi. Batafsil: [ops/backup/README.md](ops/backup/README.md).

```bash
ops/backup/pg-backup.sh         # pg_dump -Fc + retention (RTO ~15–30 daq, RPO ≤24 soat)
ops/backup/pg-restore-test.sh   # so'nggi backup'ni vaqtinchalik bazaga tiklab tekshiradi
ops/backup/minio-backup.sh      # MinIO fayllarini mirror
# Windows lokal:  .\ops\backup\pg-backup.ps1  ;  .\ops\backup\pg-restore-test.ps1
```

### Maydon shifrlash (encryption at rest)

Nozik maydonlar **AES-256-GCM** bilan shifrlanadi (`core/crypto`). DB'da ochiq matn
turmaydi; ilova Prisma extension orqali **shaffof** o'qiydi/yozadi.

- **Maydonlar:** `medical_records`(diagnosis/complaints/treatment/notes), `patients`(allergies/address/notes).
- **Kalit:** `FIELD_ENCRYPTION_KEY` = base64(32 bayt), faqat `.env`/secret-manager'da.
  Yaratish: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- **Rotatsiya:** `FIELD_ENCRYPTION_KEY_ID` (joriy) + `FIELD_ENCRYPTION_KEYS_OLD="k1:base64,k0:base64"`
  (eski kalitlar deshifrlash uchun). Token formati `enc:<keyId>:<iv>:<tag>:<ct>`.
- **Expand-contract (xavfsiz):** ustun TEXT — ciphertext o'sha ustunda; `decrypt` ochiq
  qiymatni ham o'qiydi. Mavjud ma'lumotni shifrlash: `npm run db:encrypt` (qaytarish: `npm run db:decrypt`).
- **Qidiriladigan maydonlar** (telefon): partial qidiruv uchun ochiq qoladi — kelajakda
  `CryptoService.blindIndex` (HMAC) bilan blind-index ustuni qo'shiladi.

### Audit log immutable (append-only)

`audit_logs` ga faqat qo'shish mumkin — DB trigger **UPDATE/DELETE/TRUNCATE'ni rad etadi**
(migratsiya `20260111000000_phase9b_audit_immutable`). Buzilishni aniqlash uchun hash-chain
ixtiyoriy (kelajak).

### Partitioning (tez o'sadigan jadvallar)

`audit_logs` **vaqt bo'yicha oylik** range-partition (migratsiya `20260110000000_phase9b_audit_partition`,
composite PK `(id, created_at)`). Ma'lumot ko'chirilib saqlanadi.

- **Boshqaruv:** `ops/db/partition-maintain.sql` (cron — kelgusi oylar + retention).
- **Qaytarish:** `ops/db/audit-departition.sql` (qayta oddiy jadval).
- ⚠️ Partition CHILD jadvallari Prisma modelda emas — **prod'da `prisma migrate deploy`**
  ishlating (`migrate dev` drift sifatida ko'rsatishi mumkin). `appointments/transactions/
  patient_payments` partitioning keyinroq (FK/PK murakkabligi → ko'p-relizli expand-contract).

> **Tartib (MUHIM):** har data-migratsiyadan OLDIN backup oling (`ops/backup`). Migratsiyalar
> Prisma transaksiyasida — xato bo'lsa to'liq qaytariladi.

---

## 🚀 Production'ga deploy (noldan)

Stack: **Nginx (TLS 80/443) → Next.js (BFF) + NestJS** · PostgreSQL/Redis/MinIO faqat ichki tarmoqda.

### 1) Sirlar va TLS

```bash
cp .env.production.example .env.production
# .env.production ni to'ldiring: kuchli parollar, JWT_*_SECRET (≥32 belgi), PUBLIC_URL=https://crm.domen.uz
#   FIELD_ENCRYPTION_KEY (base64 32 bayt) — maydon shifrlash uchun MAJBURIY:
#     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
#   — sirlarni git'ga COMMIT QILMANG (ideal: Vault / Docker secrets / env injection).
#   — kalitni YO'QOTMANG: shifrlangan ma'lumotni tiklab bo'lmaydi (backup + kalit birga).

# TLS sertifikat (test uchun self-signed; prod uchun Let's Encrypt):
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout nginx/certs/privkey.pem -out nginx/certs/fullchain.pem \
  -subj "/CN=crm.domen.uz"
```

### 2) Ko'tarish

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# backend ishga tushganда `prisma migrate deploy` avtomatik qo'llanadi.
```

### 3) Birinchi Super Admin (bir martalik seed)

```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
# -> admin@clinic-crm.uz / Admin12345!  (DARHOL parolni o'zgartiring)
```

### 4) Tekshirish

```bash
curl -k https://crm.domen.uz/api/v1/health     # {status:ok}
curl -k https://crm.domen.uz/api/v1/ready      # {status:ready, checks:{database,redis,storage:up}}
# Frontend:  https://crm.domen.uz  ·  Swagger: https://crm.domen.uz/api/docs
```

### Eslatmalar

- **Let's Encrypt:** `nginx/www` (webroot) + `nginx/certs` certbot bilan mount qilinadi; sertifikat yangilanishini cron'ga qo'ying.
- **Backup:** PostgreSQL `pg_dump` + MinIO `mc mirror` muntazam; tiklashni sinab ko'ring (Phase 9B).
- **Skalalash:** backend stateless (sessiya Redis'da) — bir nechta nusxa + PgBouncer (spec 1.7).
- **CI/CD:** `.github/workflows/ci.yml` — lint → type-check → test → build (server+client) + `npm audit` + Trivy. `deploy` job — shablon (image push + remote `up -d`).

---

## 📐 Muhim arxitektura qarorlari

| Qaror | Sabab |
|---|---|
| **UUID v7** app-layer extension (`applyClinicScope`) | PG16'da native yo'q; sortable PK |
| **Partial unique** (`WHERE deleted_at IS NULL`) raw SQL migratsiyada | Prisma ifodalay olmaydi; soft-delete bilan to'qnashmaydi; kodda `findFirst` |
| Tenant filtri **Prisma extension** (qo'lda emas), sof `applyClinicScope` | spec anti-pattern #4; izolyatsiya unit-test qilinadi |
| Pul **`Decimal`**, vaqt **`@db.Timestamptz(6)`** (UTC) | spec 1.5 |
| status/role — **String** (DB enum emas) | additive o'zgarishlar |
| Klinika yaratish **bitta transaction** (clinic+user+member+subscription) | atomiklik |

> ⚠️ **Migratsiya:** init/Phase-2 migratsiyalari qo'lda yozilgan (partial unique uchun).
> `prisma migrate dev` ularni qo'llaydi; partial indekslar Prisma diff'ida ko'rinmaydi (drift bo'lmaydi).

---

## 🗺️ Keyingi bosqich

**Phase 3 — Billing:** Invoice, Payme/Click (JSON-RPC) integratsiya, Idempotency, Cron job (nextBillingDate → invoice → grace → suspend).
