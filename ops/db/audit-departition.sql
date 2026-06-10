-- =============================================================================
-- Klinika CRM — audit_logs PARTITIONNI QAYTARISH (Phase 9B reversible)
-- =============================================================================
-- Partition qilingan audit_logs'ni QAYTA oddiy (partitionsiz) jadvalga
-- aylantiradi. Ma'lumot saqlanadi. Avval immutable triggerlarni o'chiring
-- (20260111000000 migratsiya DOWN qismi), so'ng shuni qo'llang.
--
--   psql "$DATABASE_URL" -f ops/db/audit-departition.sql
-- =============================================================================

BEGIN;

ALTER TABLE "audit_logs" RENAME TO "audit_logs_part";

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
CREATE INDEX "audit_logs_clinic_id_created_at_idx" ON "audit_logs" ("clinic_id", "created_at");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs" ("entity", "entity_id");

INSERT INTO "audit_logs"
  ("id","clinic_id","user_id","actor_type","action","entity","entity_id","metadata","ip","user_agent","created_at")
SELECT
  "id","clinic_id","user_id","actor_type","action","entity","entity_id","metadata","ip","user_agent","created_at"
FROM "audit_logs_part";

DROP TABLE "audit_logs_part";  -- CASCADE bilan partitionlar ham o'chadi

COMMIT;
