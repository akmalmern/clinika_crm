-- =============================================================================
-- Phase 2 — Tariflar (subscription_plans) + Obunalar (subscriptions)
-- =============================================================================
-- Hand-authored (Phase 1 uslubiga mos): partial unique indekslar
-- (WHERE deleted_at IS NULL) Prisma schema'da ifodalanmaydi, shu sababli bu yerda.
-- =============================================================================

-- ---- subscription_plans (platforma darajasida, clinic_id YO'Q) ----
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "billing_cycle" TEXT NOT NULL,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "features" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- ---- subscriptions (tenant: clinic_id bor) ----
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6),
    "next_billing_date" TIMESTAMPTZ(6),
    "grace_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- ---- Indekslar ----
CREATE INDEX "subscription_plans_is_active_idx" ON "subscription_plans" ("is_active");
CREATE INDEX "subscriptions_clinic_id_idx" ON "subscriptions" ("clinic_id");
CREATE INDEX "subscriptions_status_next_billing_date_idx" ON "subscriptions" ("status", "next_billing_date");

-- ---- PARTIAL UNIQUE (soft-delete bilan mos) ----
CREATE UNIQUE INDEX "subscription_plans_name_active_key"
    ON "subscription_plans" ("name") WHERE "deleted_at" IS NULL;

-- ---- Foreign keys ----
ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "subscription_plans" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
