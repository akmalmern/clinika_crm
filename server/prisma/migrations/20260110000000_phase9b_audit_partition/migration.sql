-- =============================================================================
-- Phase 9B — audit_logs'ni VAQT bo'yicha (oylik) PARTITION qilish
-- =============================================================================
-- Tez o'sadigan, append-only jadval (spec 1.6.B / 9B). audit_logs'da tashqi FK
-- yo'q (na inbound, na outbound) — shu sababli xavfsiz table-swap.
--
-- EXPAND-CONTRACT / MA'LUMOT SAQLASH:
--   1) eski jadval -> _old
--   2) partition qilingan yangi audit_logs (composite PK: id + created_at)
--   3) DEFAULT partition (catch-all — insert hech qachon yiqilmaydi) + oylik
--      partitionlar (eng eski ma'lumotdan +6 oy)
--   4) INSERT ... SELECT bilan butun ma'lumot ko'chiriladi
--   5) _old o'chiriladi
--
-- REVERSIBLE: teskari skript ops/db/audit-departition.sql (qayta oddiy jadval).
--
-- ⚠️ Partition CHILD jadvallari (audit_logs_YYYY_MM) Prisma modelda EMAS — prod'da
--    `prisma migrate deploy` ishlatiladi (drift tekshiruvi yo'q). `migrate dev`
--    ularni drift deb ko'rsatishi mumkin (kutilgan; ops/db/ skriptlari boshqaradi).
-- =============================================================================

ALTER TABLE "audit_logs" RENAME TO "audit_logs_old";

-- Eski jadval indeks/constraint nomlarini bo'shatamiz (yangi jadval bilan
-- to'qnashmasligi uchun — indeks nomlari schema bo'yicha noyob).
ALTER TABLE "audit_logs_old" RENAME CONSTRAINT "audit_logs_pkey" TO "audit_logs_old_pkey";
ALTER INDEX "audit_logs_clinic_id_created_at_idx" RENAME TO "audit_logs_old_clinic_id_created_at_idx";
ALTER INDEX "audit_logs_user_id_idx" RENAME TO "audit_logs_old_user_id_idx";
ALTER INDEX "audit_logs_entity_entity_id_idx" RENAME TO "audit_logs_old_entity_entity_id_idx";

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
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

CREATE INDEX "audit_logs_clinic_id_created_at_idx" ON "audit_logs" ("clinic_id", "created_at");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs" ("entity", "entity_id");

-- Catch-all: hech bir oylik partition mos kelmasa shu yerga tushadi.
CREATE TABLE "audit_logs_default" PARTITION OF "audit_logs" DEFAULT;

-- Oylik partitionlar (eng eski ma'lumotdan hozir + 6 oygacha).
DO $$
DECLARE
  cur date;
  end_m date;
  pname text;
BEGIN
  SELECT COALESCE(date_trunc('month', min(created_at)), date_trunc('month', now()))::date
    INTO cur FROM "audit_logs_old";
  end_m := (date_trunc('month', now()) + interval '6 months')::date;
  WHILE cur < end_m LOOP
    pname := 'audit_logs_' || to_char(cur, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF "audit_logs" FOR VALUES FROM (%L) TO (%L)',
      pname, cur, (cur + interval '1 month')::date
    );
    cur := (cur + interval '1 month')::date;
  END LOOP;
END $$;

-- Butun ma'lumotni ko'chirish (saqlash).
INSERT INTO "audit_logs"
  ("id","clinic_id","user_id","actor_type","action","entity","entity_id","metadata","ip","user_agent","created_at")
SELECT
  "id","clinic_id","user_id","actor_type","action","entity","entity_id","metadata","ip","user_agent","created_at"
FROM "audit_logs_old";

DROP TABLE "audit_logs_old";
