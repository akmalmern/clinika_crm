-- =============================================================================
-- Phase 5A — Bemorlar + Xizmatlar (kategoriya, xizmat, narx tarixi)
-- =============================================================================
-- Pul DECIMAL(14,2) (Float EMAS), vaqt TIMESTAMPTZ (UTC), soft-delete.
-- Narx tarixi append-only (soft-delete YO'Q). Xodimlar -> mavjud clinic_members.
-- =============================================================================

-- ---- patients (tenant: clinic_id) ----
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "birth_date" DATE,
    "gender" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "blood_type" TEXT,
    "allergies" TEXT,
    "avatar_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- ---- service_categories (tenant) ----
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- ---- services (tenant) ----
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "category_id" UUID,
    "name" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "duration" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- ---- service_price_history (tenant, append-only) ----
CREATE TABLE "service_price_history" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "old_price" DECIMAL(14,2) NOT NULL,
    "new_price" DECIMAL(14,2) NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_price_history_pkey" PRIMARY KEY ("id")
);

-- ---- Indekslar ----
CREATE INDEX "patients_clinic_id_created_at_idx" ON "patients" ("clinic_id", "created_at");
CREATE INDEX "patients_clinic_id_full_name_idx" ON "patients" ("clinic_id", "full_name");
CREATE INDEX "patients_clinic_id_phone_idx" ON "patients" ("clinic_id", "phone");
CREATE INDEX "service_categories_clinic_id_idx" ON "service_categories" ("clinic_id");
CREATE INDEX "services_clinic_id_is_active_idx" ON "services" ("clinic_id", "is_active");
CREATE INDEX "services_clinic_id_category_id_idx" ON "services" ("clinic_id", "category_id");
CREATE INDEX "service_price_history_clinic_id_service_id_idx" ON "service_price_history" ("clinic_id", "service_id");
CREATE INDEX "service_price_history_service_id_changed_at_idx" ON "service_price_history" ("service_id", "changed_at");

-- ---- PARTIAL UNIQUE (soft-delete bilan mos) ----
CREATE UNIQUE INDEX "service_categories_clinic_name_active_key"
    ON "service_categories" ("clinic_id", "name") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "services_clinic_name_active_key"
    ON "services" ("clinic_id", "name") WHERE "deleted_at" IS NULL;

-- ---- Foreign keys ----
ALTER TABLE "patients"
    ADD CONSTRAINT "patients_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_categories"
    ADD CONSTRAINT "service_categories_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "services"
    ADD CONSTRAINT "services_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "services"
    ADD CONSTRAINT "services_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "service_categories" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_price_history"
    ADD CONSTRAINT "service_price_history_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
