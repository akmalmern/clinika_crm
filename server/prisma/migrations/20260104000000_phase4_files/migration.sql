-- =============================================================================
-- Phase 4 — Universal fayl/hujjat jadvali (files), polimorfik (spec 6)
-- =============================================================================
-- Fayllarning O'ZI MinIO/S3'da; bazada faqat metadata.
--  - owner_type / owner_id — polimorfik bog'lanish (DB-level FK YO'Q).
--  - size BIGINT — klinika umumiy hajmini xavfsiz yig'ish (tarif limiti) uchun.
--  - (clinic_id, owner_type, owner_id) composite index — tez topish (spec 8).
--  - Soft-delete (deleted_at) + cleanup job storage'ni tozalaydi.
-- =============================================================================

CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- ---- Indekslar (spec 1.6.B / 8) ----
CREATE INDEX "files_clinic_id_owner_type_owner_id_idx"
    ON "files" ("clinic_id", "owner_type", "owner_id");
CREATE INDEX "files_clinic_id_created_at_idx"
    ON "files" ("clinic_id", "created_at");
CREATE INDEX "files_owner_type_owner_id_idx"
    ON "files" ("owner_type", "owner_id");

-- ---- Foreign key (faqat clinics; owner polimorfik -> FK yo'q) ----
ALTER TABLE "files"
    ADD CONSTRAINT "files_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
