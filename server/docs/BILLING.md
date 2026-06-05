# Phase 3 — Billing (Hisob-faktura + To'lov)

Abonent to'lovi: **Klinika → Platforma**. (Bemor to'lovi — Phase 5, alohida.)

## Modullar

- `modules/billing/billing.module.ts` — asosiy modul (BullMQ'siz, test'da ham yuklanadi).
- `modules/billing/billing-scheduler.module.ts` — BullMQ cron (faqat `NODE_ENV !== test`).

## Ma'lumotlar bazasi

| Jadval         | Tavsif                                                                    |
| -------------- | ------------------------------------------------------------------------- |
| `invoices`     | total/paid/debt (Decimal), status, period, due_date, paid_at. Soft-delete. |
| `transactions` | provider, method, provider_tx_id, amount, status, state, raw. Ledger (soft-delete YO'Q). |

**Idempotency indekslari (partial unique):**

- `transactions (provider, provider_tx_id) WHERE provider_tx_id IS NOT NULL` — bir provayder tranzaksiyasi bir marta.
- `invoices (subscription_id, period_start) WHERE deleted_at IS NULL ...` — bir obuna sikli uchun bitta invoice (cron dublь yaratmaydi).
- `invoices (invoice_number) WHERE deleted_at IS NULL`.

Pul — **Decimal(14,2)** (Float EMAS). Vaqt — **timestamptz (UTC)**.

## Oqim (lifecycle)

1. **Cron** (`SubscriptionBillingService.runDailyBilling`) har kuni:
   - `next_billing_date <= now` obunalarga `UNPAID` invoice yaratadi, obunani `PAST_DUE` + `grace_until` qiladi.
   - `grace_until < now` va hali to'lanmagan klinikani `SUSPENDED` qiladi (+ invoice `OVERDUE`).
2. **To'lov** (`PaymentApplicationService.confirmPayment`) — Payme/Click/Manual hammasi shu yerdan:
   - tranzaksiya `PAID` (idempotent), `paid_amount` oshadi → `PARTIAL`/`PAID`.
   - to'liq to'langanda: obuna `ACTIVE` + `next_billing_date` uzayadi, `SUSPENDED → ACTIVE`.

## Endpoint'lar

### Super Admin (`@Roles(SUPER_ADMIN)`, `BILLING_MANAGE`)

| Method | Path                                | Tavsif                          |
| ------ | ----------------------------------- | ------------------------------- |
| GET    | `/api/v1/super-admin/invoices`      | Barcha invoice (filter)         |
| GET    | `/api/v1/super-admin/invoices/:id`  | Bitta invoice                   |
| GET    | `/api/v1/super-admin/invoices/:id/pdf` | Invoice PDF                  |
| POST   | `/api/v1/super-admin/payments/manual`  | Qo'lda (naqd/bank) to'lov    |
| GET    | `/api/v1/super-admin/payments/stats`   | To'lov usuli statistikasi    |

`POST payments/manual` body:

```json
{ "invoiceId": "uuid", "amount": "199000.00", "method": "CASH", "reference": "PKO-12", "paidAt": "2026-06-05T10:00:00Z" }
```

### Klinika (`BILLING_READ`, `@AllowSuspended`)

| Method | Path                            | Tavsif                       |
| ------ | ------------------------------- | ---------------------------- |
| GET    | `/api/v1/billing/invoices`      | O'z klinikasi invoice'lari   |
| GET    | `/api/v1/billing/invoices/:id`  | Bitta                        |
| GET    | `/api/v1/billing/invoices/:id/pdf` | PDF                       |
| GET    | `/api/v1/billing/status`        | Obuna holati (Phase 2)       |

### Webhook'lar (`@Public`, `@SkipThrottle`, raw javob)

| Method | Path                              | Himoya               |
| ------ | --------------------------------- | -------------------- |
| POST   | `/api/v1/billing/payme`           | Basic auth (merchant key) |
| POST   | `/api/v1/billing/click/prepare`   | sign_string (MD5)    |
| POST   | `/api/v1/billing/click/complete`  | sign_string (MD5)    |

## Payme (JSON-RPC 2.0)

Bitta endpoint, metodlar: `CheckPerformTransaction`, `CreateTransaction`,
`PerformTransaction`, `CancelTransaction`, `CheckTransaction`, `GetStatement`.

- Auth: HTTP Basic `Paycom:<PAYME_MERCHANT_KEY>` (yoki `PAYME_TEST_KEY`). Xato → `-32504`.
- Summa **tiyinda** (1 so'm = 100 tiyin). Vaqt **epoch-ms**.
- `account.<PAYME_ACCOUNT_FIELD>` → invoice id (kabinetda sozlanadi, default `invoice_id`).
- Holatlar: `1` created, `2` performed, `-1`/`-2` cancelled.
- Error kodlari: `-31050` account, `-31001` amount, `-31003` tx not found, `-31008` can't perform.

## Click (Prepare/Complete)

- `sign_string` (MD5):
  - Prepare: `md5(click_trans_id + service_id + SECRET + merchant_trans_id + amount + action + sign_time)`
  - Complete: `md5(click_trans_id + service_id + SECRET + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)`
- `merchant_trans_id` = invoice id. Error kodlari: `-1` sign, `-2` amount, `-4` already paid, `-5` invoice yo'q, `-6` tx yo'q, `-9` cancelled.

## Konfiguratsiya (.env)

```
GRACE_DAYS=3
BILLING_CRON=0 2 * * *           # UTC, har kuni 02:00
PAYME_MERCHANT_ID= / PAYME_MERCHANT_KEY= / PAYME_TEST_KEY= / PAYME_ACCOUNT_FIELD=invoice_id
CLICK_SERVICE_ID= / CLICK_MERCHANT_ID= / CLICK_SECRET_KEY= / CLICK_MERCHANT_USER_ID=
```

> Sirlar (merchant key, secret key) **faqat `.env`'da** — kodda emas.

## Testlar

```bash
npx prisma generate          # yangi modellar (Invoice/Transaction)
npx prisma migrate dev       # 20260103000000_phase3_invoices_transactions
npm run test                 # unit (billing.util, payment-application, subscription-billing,
                             #        manual-payment, payme, click)
npm run test:e2e             # payme-webhook (raw JSON-RPC kontrakti)
```

## Cheklovlar (kelajak)

- Payme `CancelTransaction` (state -2) invoice kreditini qaytaradi, lekin obuna uzaytirishini
  avtomatik teskari qaytarmaydi (kam uchraydigan refund — qo'lda ko'rib chiqiladi).
- PDF — standart Helvetica (latin1). To'liq Unicode/embedded shrift — Phase 9.
