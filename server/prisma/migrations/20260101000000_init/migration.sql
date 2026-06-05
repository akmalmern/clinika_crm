-- =============================================================================
-- Phase 1 — boshlang'ich (init) migratsiya (hand-authored)
-- =============================================================================
-- IZOH: Bu migratsiya qo'lda yozilgan, chunki spec PARTIAL unique indekslarni
-- (WHERE deleted_at IS NULL) talab qiladi — buni Prisma schema ifodalay olmaydi.
-- `prisma migrate deploy` bu SQL'ni o'zgarishsiz qo'llaydi (shadow DB shart emas).
-- Kelajakdagi schema o'zgarishlarida `prisma migrate dev --create-only` ishlatib,
-- avtomatik generatsiyani ko'rib chiqing va partial indekslarni saqlang.
-- =============================================================================

-- ---- super_admins ----
CREATE TABLE "super_admins" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- ---- clinics ----
CREATE TABLE "clinics" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "logo_url" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- ---- users ----
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "avatar_url" TEXT,
    "birth_date" DATE,
    "gender" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- ---- clinic_members ----
CREATE TABLE "clinic_members" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "position" TEXT,
    "specialization" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "clinic_members_pkey" PRIMARY KEY ("id")
);

-- ---- audit_logs (append-only) ----
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "clinic_id" UUID,
    "user_id" UUID,
    "actor_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- ---- Indekslar (performance) ----
CREATE INDEX "clinics_status_idx" ON "clinics" ("status");
CREATE INDEX "users_email_idx" ON "users" ("email");
CREATE INDEX "users_phone_idx" ON "users" ("phone");
CREATE INDEX "clinic_members_clinic_id_idx" ON "clinic_members" ("clinic_id");
CREATE INDEX "clinic_members_user_id_idx" ON "clinic_members" ("user_id");
CREATE INDEX "audit_logs_clinic_id_created_at_idx" ON "audit_logs" ("clinic_id", "created_at");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs" ("entity", "entity_id");

-- ---- PARTIAL UNIQUE indekslar (soft-delete bilan mos) ----
-- Soft-delete qilingan yozuvlar takror kalitга to'sqinlik qilmaydi.
CREATE UNIQUE INDEX "super_admins_email_active_key"
    ON "super_admins" ("email") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "clinics_slug_active_key"
    ON "clinics" ("slug") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "clinic_members_user_clinic_active_key"
    ON "clinic_members" ("user_id", "clinic_id") WHERE "deleted_at" IS NULL;

-- ---- Foreign key cheklovlari ----
ALTER TABLE "clinic_members"
    ADD CONSTRAINT "clinic_members_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clinic_members"
    ADD CONSTRAINT "clinic_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
