-- =============================================================================
-- Klinika CRM — audit_logs partition BOSHQARUVI (Phase 9B)
-- =============================================================================
-- Cron orqali (masalan oyiga bir marta) ishlatiladi: kelgusi oylar uchun
-- partitionlar oldindan yaratiladi (insert DEFAULT'ga tushib qolmasligi uchun)
-- + retention (eski partitionlarni arxivlab/o'chirib tashlash — IXTIYORIY).
--
--   psql "$DATABASE_URL" -f ops/db/partition-maintain.sql
--   yoki:  psql -h host -U user -d clinic_crm -f ops/db/partition-maintain.sql
-- =============================================================================

-- 1) Kelgusi 3 oy uchun partition (idempotent).
DO $$
DECLARE
  cur date := date_trunc('month', now())::date;
  i int;
  pname text;
BEGIN
  FOR i IN 0..3 LOOP
    pname := 'audit_logs_' || to_char(cur, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF "audit_logs" FOR VALUES FROM (%L) TO (%L)',
      pname, cur, (cur + interval '1 month')::date
    );
    cur := (cur + interval '1 month')::date;
  END LOOP;
END $$;

-- 2) RETENTION (IXTIYORIY — diqqat!). Eski partitionlarni o'chirishdan OLDIN
--    arxivlang (pg_dump alohida partition). Quyida 24 oydan eski partitionlar
--    ro'yxati ko'rsatiladi; o'chirish uchun DROP qatorini oching.
DO $$
DECLARE
  r record;
  cutoff date := (date_trunc('month', now()) - interval '24 months')::date;
BEGIN
  FOR r IN
    SELECT c.relname AS partition_name
    FROM pg_inherits i
    JOIN pg_class c   ON c.oid = i.inhrelid
    JOIN pg_class p   ON p.oid = i.inhparent
    WHERE p.relname = 'audit_logs'
      AND c.relname ~ '^audit_logs_[0-9]{4}_[0-9]{2}$'
      AND to_date(substring(c.relname from 'audit_logs_(\d{4}_\d{2})'), 'YYYY_MM') < cutoff
  LOOP
    RAISE NOTICE 'Retention nomzodi (24 oydan eski): %', r.partition_name;
    -- O'chirish (arxivlangach yoqing):
    -- EXECUTE format('DROP TABLE %I', r.partition_name);
  END LOOP;
END $$;
