-- =============================================================================
-- Phase 7A — Telegram akkaunt bog'lash (telegram_links)
-- =============================================================================
-- Bir martalik link_token unikal. Bir owner uchun bitta LINKED bog'lanish.
-- telegram_chat_id bir nechta klinikada takrorlanishi mumkin (bir kishi 2 klinikada).
-- =============================================================================

CREATE TABLE "telegram_links" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "telegram_chat_id" TEXT,
    "link_token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "linked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id")
);

-- ---- Indekslar ----
CREATE INDEX "telegram_links_clinic_id_owner_type_owner_id_idx" ON "telegram_links" ("clinic_id", "owner_type", "owner_id");
CREATE INDEX "telegram_links_telegram_chat_id_idx" ON "telegram_links" ("telegram_chat_id");

-- ---- PARTIAL UNIQUE ----
-- Bir martalik token noyob (faol).
CREATE UNIQUE INDEX "telegram_links_link_token_active_key"
    ON "telegram_links" ("link_token") WHERE "deleted_at" IS NULL;

-- Bir owner (klinika ichida) faqat bitta LINKED bog'lanishga ega.
CREATE UNIQUE INDEX "telegram_links_owner_linked_key"
    ON "telegram_links" ("clinic_id", "owner_type", "owner_id")
    WHERE "status" = 'LINKED' AND "deleted_at" IS NULL;

-- ---- Foreign key ----
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
