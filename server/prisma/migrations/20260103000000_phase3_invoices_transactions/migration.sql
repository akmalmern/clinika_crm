-- =============================================================================
-- Phase 3 — Hisob-fakturalar (invoices) + Tranzaksiyalar (transactions)
-- =============================================================================
-- Hand-authored (Phase 1/2 uslubiga mos): partial unique indekslar
-- (WHERE ...) Prisma schema'da ifodalanmaydi, shu sababli bu yerda.
--   - Pul -> DECIMAL(14,2) (Float EMAS, spec 1.5).
--   - Vaqt -> TIMESTAMPTZ(6) (UTC).
--   - Idempotency: (provider, provider_tx_id) unique; (subscription_id, period_start)
--     unique -> bir obuna sikli uchun ikkinchi invoice yaratilmaydi (dublь yo'q).
-- =============================================================================

-- ---- invoices (tenant: clinic_id bor, soft-delete) ----
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "subscription_id" UUID,
    "invoice_number" TEXT NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "debt_amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "period_start" TIMESTAMPTZ(6),
    "period_end" TIMESTAMPTZ(6),
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- ---- transactions (tenant: clinic_id bor; soft-delete YO'Q — moliyaviy ledger) ----
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "method" TEXT,
    "provider_tx_id" TEXT,
    "reference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "state" INTEGER,
    "cancel_reason" INTEGER,
    "performed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "confirmed_by" UUID,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- ---- Indekslar (performance, spec 1.6.B) ----
CREATE INDEX "invoices_clinic_id_status_idx" ON "invoices" ("clinic_id", "status");
CREATE INDEX "invoices_clinic_id_created_at_idx" ON "invoices" ("clinic_id", "created_at");
CREATE INDEX "invoices_status_due_date_idx" ON "invoices" ("status", "due_date");
CREATE INDEX "transactions_clinic_id_created_at_idx" ON "transactions" ("clinic_id", "created_at");
CREATE INDEX "transactions_invoice_id_idx" ON "transactions" ("invoice_id");
CREATE INDEX "transactions_provider_status_idx" ON "transactions" ("provider", "status");

-- ---- PARTIAL UNIQUE indekslar ----
-- Invoice raqami noyob (soft-delete bilan mos).
CREATE UNIQUE INDEX "invoices_invoice_number_active_key"
    ON "invoices" ("invoice_number") WHERE "deleted_at" IS NULL;

-- IDEMPOTENCY: bir obuna sikli (period_start) uchun faqat bitta faol invoice.
-- Cron har kuni ishlasa ham dublikat invoice yaratilmaydi.
CREATE UNIQUE INDEX "invoices_subscription_period_active_key"
    ON "invoices" ("subscription_id", "period_start")
    WHERE "deleted_at" IS NULL AND "subscription_id" IS NOT NULL AND "period_start" IS NOT NULL;

-- IDEMPOTENCY: bir provayder tranzaksiyasi (Payme id / Click trans_id) bir marta.
CREATE UNIQUE INDEX "transactions_provider_tx_key"
    ON "transactions" ("provider", "provider_tx_id")
    WHERE "provider_tx_id" IS NOT NULL;

-- ---- Foreign keys ----
ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
