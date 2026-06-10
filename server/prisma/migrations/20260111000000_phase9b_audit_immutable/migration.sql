-- =============================================================================
-- Phase 9B — audit_logs IMMUTABLE (append-only): UPDATE/DELETE bloklanadi
-- =============================================================================
-- Kim ko'rgani/o'zgartirgani isboti o'zgartirib bo'lmasin (spec 1.6.D / 10).
-- BEFORE ROW trigger partition qilingan jadvalda BARCHA partitionlarga (mavjud
-- va kelajakdagi) avtomatik tarqaladi (PostgreSQL).
--
-- Eslatma: TRUNCATE ham bloklanadi (statement-level). Faqat super/owner rol
-- triggerni o'chirib (yoki DISABLE qilib) ataylab o'zgartira oladi — bu audit
-- izi qoldiradi va kamdan-kam ops amali.
--
-- REVERSIBLE: down -> DROP TRIGGER + DROP FUNCTION (quyida izohda).
-- =============================================================================

CREATE OR REPLACE FUNCTION "audit_logs_block_modify"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs immutable (append-only): % rad etildi', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "audit_logs_no_update" ON "audit_logs";
CREATE TRIGGER "audit_logs_no_update"
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_block_modify"();

DROP TRIGGER IF EXISTS "audit_logs_no_delete" ON "audit_logs";
CREATE TRIGGER "audit_logs_no_delete"
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_block_modify"();

DROP TRIGGER IF EXISTS "audit_logs_no_truncate" ON "audit_logs";
CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_logs_block_modify"();

-- =============================================================================
-- DOWN (reversible) — kerak bo'lsa qo'lda qo'llang:
--   DROP TRIGGER IF EXISTS "audit_logs_no_update"   ON "audit_logs";
--   DROP TRIGGER IF EXISTS "audit_logs_no_delete"   ON "audit_logs";
--   DROP TRIGGER IF EXISTS "audit_logs_no_truncate" ON "audit_logs";
--   DROP FUNCTION IF EXISTS "audit_logs_block_modify"();
-- =============================================================================
