# 🏥 Klinika CRM — SaaS Platforma (Pro Darajadagi Prompt)

> Ushbu hujjat AI yordamchiga (yoki dasturchilar jamoasiga) berish uchun mo'ljallangan **to'liq texnik topshiriq + arxitektura promptidir**. Maqsad — ko'p klinikaga xizmat qiluvchi, abonent (oylik) to'lovli, kelajakda kengayadigan **Multi-Tenant SaaS Klinika CRM** tizimini qurish. Tizimda xodimlar va bemorlarning hujjatlari (pasport, diplom, sertifikat, analiz, rasm) fayl ko'rinishida xavfsiz saqlanadi.

---

## 1. ROL VA KONTEKST (AI uchun)

Sen — 10+ yillik tajribaga ega **Senior Software Architect** va **Full-Stack dasturchisan**. Sening vazifang quyidagi texnologiyalar asosida **production darajasidagi**, **xavfsiz**, **kengayuvchan (scalable)** va **toza arxitekturali** Klinika CRM SaaS tizimini loyihalash va kodini yozish:

- **Backend:** NestJS 10+ (TypeScript, modulli monorepo) — Node.js 20 LTS
- **Ma'lumotlar bazasi:** PostgreSQL 16
- **ORM:** **Prisma** (QAT'IY — TypeORM ishlatma, butun loyihada faqat Prisma)
- **Frontend:** Next.js 14+ (App Router, TypeScript)
- **Cache / Sessiya:** Redis 7
- **Navbat (Background jobs):** BullMQ
- **Fayl saqlash:** MinIO (S3-mos) yoki AWS S3
- **Auth:** JWT (access + refresh token) + RBAC
- **Deploy:** Docker + Docker Compose + Nginx

> **Versiya qoidasi:** Faqat ko'rsatilgan versiyalardan foydalan. Agar yangiroq stabil versiya ishlatsang, sababini ayt. Eskirgan API yoki Next.js `pages` router'ni ARALASHTIRMA — faqat App Router.

Kod yozishdan oldin **arxitekturani tushuntir**, keyin **bosqichma-bosqich (phase)** amalga oshir. Har bir qarorda nima uchun shunday qilganingni qisqa izohla. Hech qachon "to'liq kodni keyin yozaman" deb o'tkazib yuborma — har bir modulni ishlaydigan holatda yetkaz.

---

## ⚙️ 1.5. MAJBURIY TEXNIK QARORLAR (Non-negotiable — chetlab o'tma)

Bular butun loyiha bo'ylab o'zgarmas qoidalar. Har bir phase'da shularga rioya qil:

- **Pul (money):** Hech qachon `Float`/`Number` EMAS. Pul Prisma'da `Decimal` (yoki butun son — tiyinlarda) sifatida saqlanadi. Pul hisob-kitobi `decimal.js`/`Prisma.Decimal` bilan. Valyuta `UZS` (kerak bo'lsa `currency` ustuni).
- **Vaqt (time):** Hamma sana/vaqt bazada **UTC** (`timestamptz`) saqlanadi, foydalanuvchiga **Asia/Tashkent** da ko'rsatiladi. Frontend va backend timezone'ni aniq boshqaradi.
- **Identifikatorlar:** Barcha primary key `UUID` (v7 afzal — tartiblanadigan), `Int` autoincrement EMAS (multi-tenant + xavfsizlik uchun).
- **Soft-delete + unique:** Soft-delete bilan unique cheklov ziddiyatini hal qil — unique index `WHERE deleted_at IS NULL` (partial unique index) bo'lsin.
- **Email/login uniqueligi:** `users` da unique `(clinic_id, email)` va `(clinic_id, phone)` — global emas (ikki klinika bir emailни ishlatishi mumkin).
- **Idempotency:** To'lov va tashqi webhook'lar idempotent — har bir tranzaksiya `provider_tx_id` + idempotency key orqali bir martagina qayd etiladi.
- **i18n boshidan:** API `Accept-Language` header'ini qabul qiladi (uz/ru/en). Foydalanuvchiga ko'rinadigan enum/xabarlar tarjima qilinadigan tarzda yozilsin (keyin qo'shish uchun emas, boshidan).
- **Kontekst rejimi:** Butun tizimni bitta javobда yozishga urinma. **Bitta phase = bitta to'liq yetkazib berish.** Har phase oxirida to'xta, xulosa ber, keyingisini so'ra. Kodni hech qachon "..." bilan qisqartirma.

---

## 🏛️ 1.6. ARXITEKTURA ASOSLARI VA UZOQ MUDDATLI BARQARORLIK (10 yil)

Maqsad — tizim ma'lumot va klinikalar ko'payganda buzilmasin, baza keyinchalik qayta yozilmasin, oson kengaysin. Bu qoidalar butun loyihaga taalluqli.

> **Halol tamoyil:** Hech bir dizayn "umuman o'zgarmaydi" deb kafolat bermaydi. Maqsad — o'zgarishlarni **og'riqsiz** qabul qiladigan arxitektura.

**A. Bazani kelajakda buzmaslik:**

- **Migration-first:** har bir baza o'zgarishi versiyalangan Prisma migratsiya. Production bazasi HECH QACHON qo'lda o'zgartirilmaydi.
- **Additive o'zgarishlar (expand-contract):** ustun darhol o'chirilmaydi/o'zgartirilmaydi — avval yangi qo'shiladi, ma'lumot ko'chiriladi, keyin (keyinroq) eskisi o'chiriladi. Eski API to'satdan buzilmaydi.
- **DB enum'dan qoch:** `status`, `role`, `category` kabi maydonlar PostgreSQL `enum` EMAS, `string` + ilova darajasida validatsiya. Yangi qiymat qo'shish bazani buzmasin.
- **Standart maydonlar — har jadvalda majburiy:** `id (UUID v7)`, `created_at`, `updated_at`, `deleted_at`, klinika jadvallarida `clinic_id`.

**B. Ma'lumot ko'payganda sekinlashmaslik (performance):**

- **Indekslar boshidan:** `(clinic_id, created_at)`, `(clinic_id, patient_id)`, `appointments(doctor_id, scheduled_at)`, `files(clinic_id, owner_type, owner_id)`. Index'siz jadval qoldirma.
- **Partition'ga tayyorlik:** tez o'sadigan jadvallar (`audit_logs`, `appointments`, `transactions`, `patient_payments`) vaqt bo'yicha (oy/yil) partition qilinadigan tarzda loyihalansin.
- **Hisobotni ajrat:** og'ir analitik so'rovlar asosiy bazani sekinlashtirmasin — **read-replica** yoki **materialized view**.
- **N+1 query'dan qoch:** Prisma'da `select`/`include` aniq, kerakli ustunlar olinadi.

**C. Kengayuvchanlik (klinikalar ko'payganda):**

- **Tenant ID = kelajakdagi sharding kaliti.** Hozir shared DB, lekin kod shunday yozilsinki, ertaga yirik klinikalarni alohida bazaga ko'chirish mumkin bo'lsin (Tenant Resolver orqali).
- **Stateless backend:** sessiya/holat Redis'da — horizontal scaling uchun.
- **Bo'sh bog'lanish (loose coupling):** Notification, Billing, Telegram, ML modullari alohida servisga chiqarilishi oson bo'lsin.

**D. Xavfsizlik (to'liq moslik):**

- **Maydon darajasida shifrlash (encryption at rest):** pasport raqami, tashxis kabi nozik maydonlar bazada ochiq turmasin.
- **Audit log immutable (append-only):** kim ko'rgani/o'zgartirgani isboti o'zgartirib bo'lmaydigan bo'lsin.
- **Backup + tiklash sinovi:** muntazam backup + uni vaqti-vaqti bilan tiklab ko'rish (sinalmagan backup = ishonchsiz backup).
- **Eng kam imtiyoz (least privilege):** har rol va DB foydalanuvchisi faqat kerakli ruxsatga ega.
- Qolgan talablar 10-bo'limda batafsil.

---

## 🛡️ 1.7. SCALE & RELIABILITY (Yuqori yuklama va ishonchlilik — SPOF'siz)

Maqsad — tizim 100x–1000x yuklamada ham yiqilmasin, bironta komponent ishdan chiqsa butun platforma to'xtamasin. Quyidagilar arxitekturaga boshidan moslab qo'yiladi (amalga oshirish bosqichi — Phase 10).

**A. Single Point of Failure (SPOF) bartaraf etish:**

- **PostgreSQL:** primary + replica(lar) + avtomatik failover (Patroni / streaming replication). Yozish primary'ga, og'ir o'qish/hisobot replica'ga.
- **Redis:** Sentinel yoki Cluster (1 master + replica'lar) — bitta nusxa EMAS.
- **MinIO:** distributed rejim (kamida 4 node) yoki tashqi S3.
- **Backend:** kamida 2+ nusxa, hech qachon bitta instansiya.

**B. Connection Pooling (MAJBURIY):**

- **PgBouncer** (transaction pooling) backend va PostgreSQL orasida. Prisma `connection_limit` cheklanadi.
- Sababi: ko'p backend nusxasi × Prisma pool → `max_connections` tugaydi → tizim qulaydi. PgBouncer buni oldini oladi.

```
DATABASE_URL=".../db?pgbouncer=true&connection_limit=5"
# PgBouncer: pool_mode=transaction, max_client_conn=2000, default_pool_size=25
```

**C. Sharding strategiyasi (oldindan tanlangan):**

- Shard kaliti = `clinic_id` (allaqachon hamma jadvalda bor).
- Yo'l: **Citus** (PostgreSQL extension) bilan `clinic_id` bo'yicha distribute, yoki yirik tenantlarni alohida bazaga ko'chirish. Kod Tenant Resolver orqali ikkalasiga ham tayyor.

```sql
SELECT create_distributed_table('appointments', 'clinic_id');
SELECT create_distributed_table('patients', 'clinic_id');
```

**D. Message broker (event-driven):**

- Modullararo muhim hodisalar uchun **Kafka** (yoki RabbitMQ): `appointment.created`, `payment.completed` kabi. Bir hodisani bir nechta servis (billing, notification, ML) mustaqil iste'mol qiladi.
- BullMQ ichki background joblar uchun qoladi.

**E. Qidiruv (full-text):**

- Bemor/xizmat qidiruvi `LIKE '%..%'` EMAS — PostgreSQL `pg_trgm` + GIN indeks, juda katta hajmda Elasticsearch/OpenSearch.

```sql
CREATE INDEX idx_patients_trgm ON patients USING gin (full_name gin_trgm_ops);
```

**F. Per-tenant rate limiting:**

- Global limitга qo'shimcha `clinic_id` bo'yicha Redis-based limit (noisy neighbor oldini oladi) — bitta klinika butun resursni yeb qo'ymaydi.

**G. Caching pattern (aniq):**

- Cache-aside + har entity uchun aniq key + yangilanganда invalidatsiya + TTL. Tibbiy ma'lumotda stale (eskirgan) qiymat ko'rsatilmasligi shart.

> **Muhim:** Bularning HAMMASI additive — `clinic_id` shard kaliti, stateless backend, modul ajratish allaqachon mavjud. Shuning uchun bu o'zgarishlar bazani QAYTA YOZISHNI talab qilmaydi, faqat infratuzilma qo'shadi.

---

## 2. BIZNES MAQSAD (Asosiy g'oya)

Bu oddiy bitta klinika tizimi EMAS. Bu **bir nechta klinikaga ijaraga beriladigan SaaS platforma**:

1. **Super Admin** (platforma egasi) tizimni boshqaradi.
2. Super Admin yangi klinika qo'shadi va unga **login + parol** beradi.
3. Har bir klinika **alohida tenant** (izolyatsiya qilingan makon) hisoblanadi — bir klinika boshqa klinikaning ma'lumotini hech qachon ko'rmaydi.
4. Klinikalar tizimdan foydalanish uchun **oylik abonent to'lovini** to'laydi.
5. To'lov qilinmasa — klinikaning kirishi **cheklanadi / vaqtincha to'xtatiladi** (suspend), lekin ma'lumotlari o'chmaydi.
6. Tizim minglab klinika va million bemorga moslasha olishi kerak.

---

## 3. MULTI-TENANT ARXITEKTURA (Eng muhim qism)

Ko'p-tenantlik strategiyasini quyidagicha amalga oshir va **trade-off**larini izohla:

**Tavsiya etilgan yondashuv: Shared Database + `tenant_id` (Row-Level Isolation)**

- Klinikaga tegishli har bir jadvalda `clinic_id` (tenant_id) ustuni bo'ladi.
- Har bir so'rovda avtomatik ravishda `WHERE clinic_id = :currentTenant` filtri qo'llaniladi (Prisma middleware / NestJS Interceptor orqali).
- Super Admin barcha tenantlarni ko'ra oladi, oddiy foydalanuvchilar faqat o'z tenantini.

**Kengayish uchun:** Kod shunday yozilsinki, kelajakda **Schema-per-tenant** yoki **Database-per-tenant** ga oson o'tish mumkin bo'lsin (Tenant Resolver abstraksiyasi orqali).

**Tenant aniqlash mexanizmi:**

- JWT token ichida `clinicId` saqlanadi.
- Har bir HTTP so'rovda `TenantMiddleware` orqali `currentClinicId` aniqlanadi va `AsyncLocalStorage` (request context) ga joylanadi.
- Super Admin route'lari bundan mustasno.

**Bir foydalanuvchi — bir nechta klinika (real holat):** Shifokor bir nechta klinikada ishlashi mumkin. Shuning uchun foydalanuvchi identifikatori (`users`) bilan klinikadagi a'zoligi (`clinic_members`: user_id, clinic_id, role) ALOHIDA bo'lsin. Login paytida yoki almashtirishда faol klinika tanlanadi va token'ga yoziladi. (Agar boshlang'ich versiyada soddalashtirsang — buni aniq hujjatlashtir va kelajakda ajratishga tayyor qoldir.)

---

## 4. ROLLAR VA RUXSATLAR (RBAC)

Quyidagi rollarni va ularning ruxsatlarini (permission) granular tarzda amalga oshir:

| Rol                     | Tavsif          | Asosiy ruxsatlar                                                   |
| ----------------------- | --------------- | ------------------------------------------------------------------ |
| `SUPER_ADMIN`           | Platforma egasi | Klinika qo'shish/o'chirish, tariflar, to'lovlar, global statistika |
| `CLINIC_ADMIN`          | Klinika rahbari | O'z klinikasini to'liq boshqarish, xodimlar, hisobotlar            |
| `DOCTOR`                | Shifokor        | Bemorlar, qabullar, tibbiy yozuvlar (EMR), retseptlar              |
| `RECEPTIONIST`          | Registrator     | Bemor ro'yxatga olish, qabulga yozish, navbat                      |
| `NURSE`                 | Hamshira        | Qabul yordami, jarayonlar                                          |
| `CASHIER`               | Kassir          | Bemor to'lovlari, cheklar                                          |
| `PATIENT` _(ixtiyoriy)_ | Bemor portali   | O'z qabullari, natijalari, to'lovlari                              |

- RBAC **rol + permission** modeli asosida (faqat rol nomiga emas, balki aniq permission'larga tekshir).
- NestJS'da `@Roles()` va `@Permissions()` dekoratorlari + `RolesGuard` / `PermissionsGuard` yarat.

---

## 5. ABONENT TO'LOVI VA SUBSCRIPTION MANTIG'I (Biznesning yuragi)

Bu modulni alohida, mustahkam tarzda qur:

**5.1. Tariflar (Plans)**

- `BASIC`, `STANDARD`, `PREMIUM` kabi tariflar.
- Har bir tarifda limitlar: xodimlar soni, bemorlar soni, fayl saqlash hajmi (GB), modullar, SMS soni.

**5.2. Obuna (Subscription)**

- Har bir klinikaning aktiv obunasi bor: `status` (ACTIVE, TRIAL, PAST_DUE, SUSPENDED, CANCELLED).
- `startDate`, `endDate`, `nextBillingDate`, `gracePeriod` (masalan 3 kun muhlat).

**5.3. To'lov jarayoni**

- Super Admin klinika qo'shganda boshlang'ich obuna (trial yoki active) yaratiladi.
- **Cron job (BullMQ)** har kuni obunalarni tekshiradi:
  - `nextBillingDate` yetganda — invoice (hisob-faktura) yaratiladi.
  - To'lanmasa va grace period o'tsa — klinika `SUSPENDED` holatiga o'tadi.
- `SUSPENDED` klinika foydalanuvchilari faqat "To'lov qiling" sahifasini ko'radi, qolgan funksiyalar bloklanadi.

**5.4. To'lov tizimlari (O'zbekiston uchun)**

- **Payme**, **Click**, **Uzum** integratsiyasini abstrakt `PaymentProvider` interfeysi orqali qo'shilishi mumkin bo'lsin.
- **DIQQAT — bular Stripe EMAS:** Payme va Click o'z protokollarini talab qiladi:
  - **Payme:** Merchant API — JSON-RPC metodlari: `CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`, `CheckTransaction`, `GetStatement`. Auth — Basic (merchant key). Holatlar (state) to'g'ri boshqarilsin.
  - **Click:** `Prepare` va `Complete` endpoint'lari, `sign_string` (MD5) tekshiruvi.
- **Idempotency MAJBURIY:** har bir kelgan so'rov `provider_tx_id` bo'yicha tekshiriladi — bir tranzaksiya ikki marta qayd etilmaydi (pul ikki marta yozilib qolmasin).
- Imzo/signature tekshiruvi, summa mosligi, tranzaksiya holati avtomatga emas qo'lда boshqariladi.
- Har bir to'lov `transactions` jadvaliga to'liq (raw payload bilan) yoziladi.

**5.5. Hisob-fakturalar (Invoices)**

- Avtomatik generatsiya, PDF eksport.
- To'lov tarixi.

> **MUHIM FARQ:** Ikki xil to'lov bor va ular ARALASHMASLIGI kerak:
>
> - **Abonent to'lovi** = Klinika → Platformaga (subscriptions, invoices, transactions).
> - **Bemor to'lovi** = Bemor → Klinikaga xizmat uchun (patient_payments, kassir moduli).

---

## 6. FAYL VA HUJJAT BOSHQARUVI (Universal modul — MUHIM)

Bu modul butun tizimning fayl ehtiyojlarini bitta joydan boshqaradi: xodim hujjatlari, bemor hujjatlari, profil rasmlari, kasallik tarixi skanlari va boshqalar.

**6.1. Asosiy prinsip — Polimorfik `files` jadvali**
Har bir hujjat turi uchun alohida ustun YARATMA. Buning o'rniga bitta universal `files` jadvali istalgan obyektga (xodim, bemor, klinika) bog'lanadi:

- `owner_type` — kimga tegishli: `USER`, `PATIENT`, `CLINIC`, `MEDICAL_RECORD`.
- `owner_id` — o'sha obyektning ID si.
- `category` — fayl toifasi (quyida).
- Shunday qilib bitta xodimda cheksiz sondagi sertifikat/diplom bo'lishi mumkin, baza o'zgarmaydi.

**6.2. Fayl toifalari (category enum)**

- Xodim uchun: `PROFILE_PHOTO`, `PASSPORT`, `DIPLOMA`, `CERTIFICATE`, `LICENSE`, `CONTRACT`, `OTHER`.
- Bemor uchun: `PATIENT_PHOTO`, `PATIENT_PASSPORT`, `MEDICAL_HISTORY`, `LAB_RESULT`, `XRAY_SCAN`, `REFERRAL`, `OTHER`.

**6.3. Saqlash strategiyasi**

- Fayllarning o'zi **MinIO/S3** object storage'da (DB ichida EMAS).
- Bazada faqat metadata: `storage_key`, `original_name`, `mime_type`, `size`, `uploaded_by`.
- Yuklash: backend orqali (validatsiya + virus tekshiruvi ixtiyoriy) yoki **presigned upload URL**.
- O'qish: faqat **signed URL** (vaqtinchalik, muddatli havola) — to'g'ridan-to'g'ri public URL BO'LMASIN.

**6.4. Xavfsizlik (tibbiy/shaxsiy ma'lumot)**

- Tenant izolyatsiyasi: faylga kirishda `clinic_id` majburiy tekshiriladi.
- Har bir faylni ochish/yuklash `audit_logs`ga yoziladi.
- Fayl hajmi va MIME turi validatsiya qilinadi (faqat ruxsat etilgan formatlar: jpg, png, pdf, docx...).
- Klinikaning umumiy fayl hajmi tarif limitidan oshmasligi tekshiriladi.

**6.5. Funksional talablar**

- Har bir **xodim profilida** rasmi ko'rinib turadi (`avatar_url`) + rasm qo'shish/almashtirish imkoniyati.
- Xodim profilida uning barcha hujjatlari (pasport, diplom, sertifikat) ro'yxati, ko'rish va yuklab olish imkoniyati bilan.
- Har bir **bemor profilida** rasmi, hujjatlari va skanlangan kasallik tarixi fayllari.
- Drag & drop yuklash, ko'p fayl yuklash, rasm preview.

---

## 7. ASOSIY MODULLAR (Klinika ichidagi funksionallik)

Har birini alohida NestJS moduli sifatida qur:

1. **Auth Module** — login, refresh token, parolni tiklash, 2FA (ixtiyoriy).
2. **Tenant/Clinic Module** — klinika profili, sozlamalari, ish vaqti, filiallar (branches — kengayish uchun).
3. **User/Staff Module** — xodimlarni boshqarish, profil rasmi, shaxsiy hujjatlari (files orqali).
4. **Patient Module** — bemorlar bazasi, qidiruv, rasmi, hujjatlari, tarix.
5. **File/Document Module** — yuqoridagi universal fayl moduli.
6. **Appointment Module** — qabulga yozish, kalendar, navbat, shifokor jadvali, statuslar.
   - **Vaqt to'qnashuvi (double-booking) oldini olish:** bitta shifokor bir vaqtда faqat bitta bemorni qabul qiladi. Slot bandligini transaksiya/lock bilan tekshir.
   - **Shifokor ish jadvali:** `doctor_schedules` orqali bo'sh slotlar hisoblanadi (faqat ish vaqtiga yozish mumkin).
   - Statuslar: kutilmoqda → kelgan → qabulда → yakunlangan / bekor / kelmadi (no-show).
7. **EMR Module** (Electronic Medical Records) — tibbiy yozuvlar, tashxis (ICD-10), retseptlar, tahlil natijalari + bog'langan fayllar.
8. **Services & Pricing Module** — klinika xizmatlari va narxlarini to'liq boshqarish:
   - **Kategoriyalar (alohida jadval):** kategoriya qo'shish, nomini o'zgartirish (update), o'chirish (delete). Har bir xizmat kategoriyaga bog'lanadi.
   - **Xizmatlar (CRUD):** yangi xizmat qo'shish, nomi/narxi/davomiyligini o'zgartirish, o'chirish (soft-delete orqali — ya'ni eski qabullardagi narx tarixiga ta'sir qilmasin).
   - **Narxni o'zgartirish:** klinika admini istalgan vaqtda narxni o'zgartira oladi.
   - **Narx tarixi (price history):** har bir narx o'zgarishi alohida yoziladi (kim, qachon, eski → yangi narx) — hisobot va shaffoflik uchun.
   - Faqat `CLINIC_ADMIN` (yoki ruxsatli rol) narx va kategoriyalarni o'zgartira oladi.
9. **Cashier/Billing Module** — bemorlardan to'lov qabul qilish, cheklar, qarzlar.
10. **Inventory/Pharmacy Module** _(PREMIUM)_ — dori-darmon, omborxona.
11. **Notification Module** — SMS (Eskiz.uz / Play Mobile), Email, Telegram orqali eslatmalar.
12. **Telegram Bot Module** — bemor va shifokor uchun bot (eslatma + so'rov):
    - **Bitta markaziy bot** hamma klinikaga xizmat qiladi (multi-tenant) — har klinikaga alohida bot emas.
    - **Akkaunt bog'lash:** CRM bir martalik token/havola (`t.me/bot?start=<token>`) generatsiya qiladi → foydalanuvchi bosadi → `telegram_chat_id` profilga bog'lanadi. **Faqat tasdiqlangan chat'ga** xabar yuboriladi.
    - **Maxfiylik qoidasi:** tibbiy tafsilot (tashxis, natija, dori) botga YOZILMAYDI — faqat "natija tayyor, ilovaga kiring 👉 havola" turidagi xabar.
    - **Bemorga:** qabul eslatmasi (sana/vaqt/shifokor/manzil), tasdiq/bekor, navbat holati, to'lov eslatmasi, "natija tayyor" bildirishnomasi.
    - **Bemor so'rashi mumkin:** qabullari, yangi qabulga yozilish/bekor, qarz holati, klinika kontakti.
    - **Shifokorga:** yangi/bekor qilingan qabul, kunlik jadval xulosasi, "bemor keldi".
    - **Texnik:** Telegraf yoki grammY, production'da **webhook** (secret token bilan), xabar yuborish **BullMQ navbati** orqali (rate-limit + retry).
13. **Report & Analytics Module** — daromad, bemorlar oqimi, shifokorlar yuklamasi (dashboard).
14. **Audit Log Module** — kim, qachon, nima qildi, qaysi faylni ochdi.

---

## 8. MA'LUMOTLAR BAZASI SXEMASI (To'liq)

Quyidagi jadvallarni Prisma schema sifatida yarat (har birida `created_at`, `updated_at`, kerakli joyda `deleted_at` soft-delete):

```
# ---- PLATFORMA (SaaS) ----
- super_admins (id, full_name, email, password_hash, is_active)

- clinics (id, name, slug, status, logo_url, address, phone, email, settings JSON)

- subscription_plans (id, name, price, billing_cycle,
    limits JSON,      # { maxStaff, maxPatients, storageGb, smsCount }
    features JSON)    # { pharmacy: true, telegram: false }

- subscriptions (id, clinic_id, plan_id, status,
    start_date, end_date, next_billing_date, grace_until)

- invoices (id, clinic_id, subscription_id, amount, status, due_date, paid_at)

- transactions (id, invoice_id, provider, provider_tx_id, amount, status, raw JSON)

# ---- KLINIKA ICHIDAGI FOYDALANUVCHILAR ----
- users (id, full_name, phone, email, password_hash, is_active,
    avatar_url, birth_date, gender)
    # email/phone unique: (clinic_member orqali) — global emas

- clinic_members (id, user_id, clinic_id, role, position, specialization,
    is_active)
    # Bir foydalanuvchi bir nechta klinikaga a'zo bo'la oladi
    # unique (user_id, clinic_id)

# ---- BEMORLAR ----
- patients (id, clinic_id, full_name, birth_date, gender, phone,
    address, blood_type, allergies, avatar_url, notes)

# ---- TIBBIY ----
- appointments (id, clinic_id, patient_id, doctor_id, service_id,
    scheduled_at, ends_at, status, notes)
    # unique/lock: bitta doctor + vaqt oralig'i takrorlanmasin

- doctor_schedules (id, clinic_id, doctor_id, weekday, start_time,
    end_time, slot_minutes, is_active)
    # shifokorning ish vaqti -> bo'sh slotlar shundan hisoblanadi

- appointment_status_history (id, clinic_id, appointment_id,
    old_status, new_status, changed_by, changed_at)
    # holat o'zgarishlari (ML va audit uchun)

- medical_records (id, clinic_id, patient_id, appointment_id, doctor_id,
    diagnosis, icd_code, complaints, treatment, notes)

- prescription_items (id, clinic_id, medical_record_id, drug_name,
    dosage, frequency, duration, instructions)
    # Retsept normallashtirilgan — bir ko'rikда bir nechta dori

- services (id, clinic_id, category_id, name, price, duration,
    is_active)        # category_id -> service_categories

- service_categories (id, clinic_id, name, description, is_active)
    # Kategoriyani mustaqil qo'shish/tahrirlash/o'chirish uchun alohida jadval

- service_price_history (id, clinic_id, service_id, old_price, new_price,
    changed_by, changed_at)   # narx kim tomonidan, qachon o'zgargani

# ---- BEMOR TO'LOVLARI (klinika kassasi) ----
- invoices_patient (id, clinic_id, patient_id, appointment_id,
    total_amount, paid_amount, debt_amount, status)
    # status: UNPAID | PARTIAL | PAID  (qisman to'lov va qarz uchun)

- patient_payments (id, clinic_id, patient_invoice_id, patient_id,
    amount, method, status, paid_at, cashier_id)
    # Bitta hisobga bir nechta to'lov (bo'lib-bo'lib to'lash)

# ---- UNIVERSAL FAYL/HUJJAT JADVALI (eng muhim qo'shimcha) ----
- files (id, clinic_id,
    owner_type,       # 'USER' | 'PATIENT' | 'CLINIC' | 'MEDICAL_RECORD'
    owner_id,
    category,         # 'PROFILE_PHOTO' | 'PASSPORT' | 'DIPLOMA' |
                      # 'CERTIFICATE' | 'LICENSE' | 'MEDICAL_HISTORY' |
                      # 'LAB_RESULT' | 'XRAY_SCAN' | 'OTHER'
    storage_key,      # MinIO/S3 dagi yo'l
    original_name,
    mime_type,
    size,
    uploaded_by)      # user_id

# ---- AUDIT ----
- audit_logs (id, clinic_id, user_id, action, entity, entity_id, metadata JSON)

# ---- TELEGRAM BOT ----
- telegram_links (id, clinic_id,
    owner_type,        # 'PATIENT' | 'USER' (shifokor/xodim)
    owner_id,
    telegram_chat_id,
    link_token,        # bir martalik bog'lash tokeni
    status,            # PENDING | LINKED
    linked_at)
    # Faqat status=LINKED bo'lgan chat'ga xabar yuboriladi
```

> **MUHIM QOIDALAR:**
>
> - Klinikaga tegishli HAR bir jadvalda `clinic_id` bo'lishi va index qo'yilishi shart. Super admin jadvallarida `clinic_id` bo'lmaydi.
> - `files` jadvalida `(clinic_id, owner_type, owner_id)` ustiga composite index qo'y — fayllarni tez topish uchun.
> - Fayllarning o'zi DB'da emas, MinIO/S3 da; bazada faqat metadata.
> - **Pul:** `Decimal` (Float EMAS). **Vaqt:** `timestamptz` (UTC).
> - **Polimorfik `files`:** DB-level foreign key yo'qligini hisobga ol — egasi o'chsa fayllarni tozalovchi (cleanup) job yoz, "orphaned" fayllar qolmasin.
> - **PostgreSQL RLS:** tibbiy/shaxsiy ma'lumotli jadvallarga Row-Level Security yoq — ilova darajasidagi filtrga qo'shimcha ikkinchi himoya qatlami sifatida.

---

## 9. API VA KOD KONVENSIYALARI

- **RESTful API** + global `/api/v1` prefiks.
- Standart javob formati: `{ success, data, message, meta }`.
- Xatoliklar: global `ExceptionFilter`, mazmunli HTTP statuslar.
- Validatsiya: `class-validator` + DTO'lar.
- Fayl yuklash: `multipart/form-data`, hajm va MIME validatsiyasi.
- Swagger/OpenAPI hujjati avtomatik generatsiya.
- Pagination, filtering, sorting standart (`?page=&limit=&search=&sort=`).
- TypeScript strict mode.

---

## 10. XAVFSIZLIK TALABLARI

- Parollar `argon2`/`bcrypt` bilan xeshlanadi.
- JWT: access token 15 min, refresh token 7 kun + Redis blacklist.
- Rate limiting (`@nestjs/throttler`).
- **Tenant izolyatsiyasi** har bir so'rovda majburiy (eng muhim nuqta) + PostgreSQL **RLS** ikkinchi himoya qatlami sifatida.
- Fayllarga faqat signed URL orqali kirish; tibbiy/shaxsiy hujjatlar maxfiy.
- Fayl va tibbiy ma'lumotga kirish audit log'ga yoziladi.
- CORS, Helmet, input sanitizatsiya.
- **Login brute-force himoyasi:** auth endpoint'lariga alohida qattiq rate limit + muvaffaqiyatsiz urinishlarni kuzatish.
- **Maxfiylik (O'zbekiston "Shaxsga doir ma'lumotlar" qonuni):** ma'lumotni saqlash muddati (retention), o'chirish huquqi va shifrlash hisobga olinsin.

**Observability (production uchun majburiy):**

- Strukturalangan loglar (pino), `request-id` bilan kuzatuv.
- Xatoliklar uchun Sentry (yoki muqobil) integratsiyasi.
- `/health` va `/ready` health-check endpoint'lari (Docker/Nginx/K8s uchun).
- Audit loglar tez o'sadi — partitioning yoki retention strategiyasi belgilansin.
- Metrikalar (Prometheus) + dashboard (Grafana) — yuklamani kuzatish uchun.

**Sirlar va himoya quvuri:**

- **Secrets management:** production sirlar Vault / AWS Secrets Manager'da, `.env` faqat dev uchun.
- **CI/CD:** GitHub Actions — lint → type-check → test → build → deploy.
- **Zaiflik skani:** Trivy (konteyner), `npm audit` / Dependabot (paketlar) muntazam.

---

## 11. KENGAYUVCHANLIK (Scalability)

Kod kelajakda quyidagilarga tayyor bo'lsin:

- **Filiallar (multi-branch)** — bitta klinikaning bir nechta filiali.
- **Til (i18n)** — UZ / RU / EN.
- **Horizontal scaling** — stateless backend, sessiya Redis'da.
- **Microservice'larga ajratish** — Notification, Billing, File modullari alohida chiqarilishi oson bo'lsin.
- **Caching** — tez-tez o'qiladigan ma'lumotlar Redis'da.
- **Background jobs** — SMS, hisobot, billing, fayl qayta ishlash BullMQ orqali.

---

## 🤖 11.5. AI / ML-GA TAYYORGARLIK (Kelajak uchun ma'lumot yig'ish)

Hozir model o'qitilmaydi, lekin tizim shunday qurilsinki, kelajakda bashorat (no-show, daromad prognozi, klinika churn) qo'shish silliq bo'lsin. Buning uchun **bugundan to'g'ri ma'lumot yig'ish** kerak:

**Majburiy ma'lumot sifati qoidalari:**

- **Hamma muhim hodisa `timestamp` bilan yoziladi** — yaratilgan, o'zgargan, kelgan, to'langan, bekor qilingan vaqtlari (UTC). Vaqtsiz ma'lumot ML uchun yaroqsiz.
- **Soft-delete majburiy** — hech narsa fizik o'chirilmaydi (`deleted_at`). O'chirilgan yozuv ham tarix sifatida qimmatli.
- **Holat o'zgarishlari saqlanadi** — masalan `appointment_status_history` (kutilmoqda → keldi/kelmadi), `service_price_history` allaqachon bor. Bu "nima sodir bo'lgani"ni o'rgatadi.
- **No-show belgisi** — qabul statusiда `NO_SHOW` aniq saqlanadi (kelmagan bemorlarni bashorat qilish uchun asosiy maydon).

**Arxitektura (kelajakda ulash uchun):**

- ML qismi NestJS ichida EMAS — alohida **Python mikroservis** (FastAPI + scikit-learn / TensorFlow) sifatida ulanadi.
- Oqim: CRM → ma'lumot (read-replica yoki eksport) → Python ML servis → bashorat → NestJS API orqali frontend'ga.
- ML servis bilan aloqа REST yoki message queue (BullMQ/Redis) orqali — bo'sh bog'lanish (loosely coupled).

**Kelajakdagi bashorat imkoniyatlari (eslatma sifatida):**

- No-show ehtimoli, daromad prognozi, klinika churn (obunani to'xtatish xavfi), bemor oqimi (kun/soat), xizmat tavsiyalari.

> **Hozir qilinadigan yagona ish:** ma'lumotni to'liq, timestamp bilan va o'chirmasdan yig'ish. Modellashtirish keyin, ma'lumot to'plangach qo'shiladi.

---

## 12. FRONTEND (Next.js) TALABLARI

- **App Router** + Server/Client Components to'g'ri taqsimlangan.
- **3 ta panel:**
  1. **Super Admin Panel** — klinikalar, tariflar, to'lovlar, global dashboard.
  2. **Klinika Panel** — rolga qarab menyu (admin/shifokor/registrator/kassir).
  3. _(Ixtiyoriy)_ **Bemor portali.**
- **UI:** Tailwind CSS + shadcn/ui, zamonaviy va toza dizayn.
- **Data:** TanStack Query + Zustand.
- **Auth:** Token himoyasi, route middleware.
- Form'lar: React Hook Form + Zod.
- **Profil sahifalari:** xodim/bemor rasmi (avatar) ko'rinadi, rasm yuklash/almashtirish (crop bilan).
- **Hujjatlar bo'limi:** drag & drop yuklash, fayllar ro'yxati, preview, yuklab olish.
- Calendar (qabullar uchun), Recharts (dashboard grafiklari).
- Responsive, mobil-do'st.

---

## 13. PROYEKT STRUKTURASI (Tavsiya)

```
clinic-crm/
├── backend/                 # NestJS
│   ├── src/
│   │   ├── common/          # guards, decorators, filters, interceptors
│   │   ├── config/
│   │   ├── core/tenant/     # tenant resolver, middleware
│   │   ├── core/storage/    # MinIO/S3 servisi, signed URL
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── clinics/
│   │   │   ├── subscriptions/
│   │   │   ├── billing/
│   │   │   ├── users/        # staff + hujjatlar
│   │   │   ├── patients/
│   │   │   ├── files/        # universal fayl moduli
│   │   │   ├── appointments/
│   │   │   ├── emr/
│   │   │   ├── services/
│   │   │   ├── notifications/
│   │   │   └── reports/
│   │   └── main.ts
│   └── prisma/schema.prisma
├── frontend/                # Next.js
│   ├── app/
│   │   ├── (super-admin)/
│   │   ├── (clinic)/
│   │   └── (auth)/
│   ├── components/
│   ├── lib/
│   └── hooks/
└── docker-compose.yml       # postgres + redis + minio + backend + frontend
```

---

## 14. BAJARISH BOSQICHLARI (Roadmap — shu tartibda yetkaz)

**Phase 1 — Asos:** Monorepo, Docker (postgres+redis+minio), Prisma schema, Auth (JWT+RBAC), Tenant middleware, **Audit log infratuzilmasi** (boshqa modullar unga tayanadi), **seed** (birinchi Super Admin).

**Phase 2 — SaaS yadrosi:** Super Admin, Clinic CRUD (login/parol berish), clinic_members, Plans, Subscription mantig'i, Suspend logikasi.

**Phase 3 — Billing:** Invoice, Payme/Click (JSON-RPC) integratsiya, Idempotency, Cron job.

**Phase 4 — Fayl moduli:** MinIO integratsiya, universal `files` moduli, upload/download, signed URL.

**Phase 5 — Klinika funksiyalari:** Staff (rasm+hujjatlar), Patients (rasm+hujjatlar), Service kategoriya + Services, doctor_schedules, Appointments (to'qnashuv tekshiruvi), Cashier (qisman to'lov/qarz).

**Phase 6 — Tibbiy qism:** EMR, prescription_items, kasallik tarixi (struktura + skanlar).

**Phase 7 — Qo'shimcha:** Notifications (SMS), Reports/Dashboard.

**Phase 8 — Frontend:** Panellar UI, profillar, hujjat boshqaruvi, integratsiya.

**Phase 9 — Production:** Testlar (unit + e2e), Swagger, observability, Docker deploy.

---

## 15. YETKAZIB BERISH TALABLARI

Har bir bosqichda quyidagilarni ber:

- ✅ Ishlaydigan kod (to'liq, qisqartmasdan)
- ✅ Qisqa izoh (nima qilindi va nega)
- ✅ `.env.example` fayllari
- ✅ Migratsiyalar
- ✅ Asosiy testlar
- ✅ Keyingi qadam taklifi

---

## 16. DEFINITION OF DONE (Har phase "tayyor" deyilishi mezoni)

Bir phase faqat quyidagilar bajarilganда "tayyor" hisoblanadi:

- ✅ Kod kompilyatsiya bo'ladi, `lint` va `type-check` xatosiz o'tadi.
- ✅ Asosiy biznes-mantiq uchun unit testlar + kamida bitta e2e test yozilgan.
- ✅ Migratsiya ishlaydi, `seed` ma'lumot bilan loyiha noldan ko'tariladi (`docker compose up`).
- ✅ Yangi endpoint'lar Swagger'da hujjatlangan.
- ✅ Tenant izolyatsiyasi tegishli joyda tekshirilgan (boshqa klinika ma'lumoti ochilmaydi).
- ✅ Maxfiy ma'lumotlar (`.env`) commit qilinmagan, `.env.example` yangilangan.

## 17. QILMA (Anti-pattern'lar — bulardan qoch)

- ❌ Pulni `Float`/`Number` da saqlama.
- ❌ Faylni bazaga (`bytea`) yoki public URL bilan ochiq qo'yma.
- ❌ Har bir hujjat turi uchun alohida ustun ochma (universal `files` ishlat).
- ❌ Tenant filtrini har query'da qo'lда yozma — middleware/Prisma extension orqali avtomat qil.
- ❌ Payme/Click'ni oddiy webhook deb yozma — ularning protokolini to'liq amalga oshir.
- ❌ Kodni "..." yoki "qolganini o'zingiz to'ldiring" bilan qisqartirma.
- ❌ Sirlarni (JWT secret, DB parol, merchant key) kodga yozma — faqat `.env`.
- ❌ Soft-delete qilingan yozuvni oddiy unique bilan qoldirma (partial unique index ishlat).
- ❌ Vaqtни timezone'siz (`timestamp`) saqlama — har doim `timestamptz` (UTC).

---

> "Yuqoridagi talablar asosida loyihani boshla. Avval umumiy arxitekturani va papka strukturasini tushuntir, multi-tenant strategiyasi hamda universal fayl/hujjat boshqaruvining trade-off'larini izohla, keyin **Phase 1**'dan boshlab kod yozishni boshla. Har bir faylni to'liq ko'rsat."
