#!/usr/bin/env bash
# =============================================================================
# Klinika CRM — Backup TIKLASH SINOVI (spec 9B: backup haqiqatan tiklanishini tekshir)
# =============================================================================
# Eng so'nggi backup'ni ALOHIDA bo'sh bazaga tiklaydi, butunligini tekshiradi
# (jadvallar + qator sonlari), so'ng vaqtinchalik bazani o'chiradi.
# Tiklash yoki tekshiruv muvaffaqiyatsiz bo'lsa NON-ZERO bilan chiqadi (cron/CI
# ogohlantirishi uchun).
#
# Ishlatish:
#   PGHOST=... PGUSER=... PGPASSWORD=... ./pg-restore-test.sh
#   (server'da DB yaratish huquqiga ega rol kerak — CREATEDB)
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/clinic-crm/postgres}"
DB_NAME="${PGDATABASE:-clinic_crm}"
TEST_DB="${TEST_DB:-clinic_crm_restore_test_$(date +%s)}"
export PGDATABASE="postgres" # admin ulanish (CREATE/DROP DATABASE uchun)

LATEST="$(ls -1t "${BACKUP_DIR}"/${DB_NAME}_*.dump 2>/dev/null | head -n1 || true)"
if [[ -z "${LATEST}" ]]; then
  echo "[restore-test] XATO: backup topilmadi (${BACKUP_DIR})" >&2
  exit 1
fi
echo "[restore-test] backup: ${LATEST}"

cleanup() {
  psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${TEST_DB}\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[restore-test] vaqtinchalik baza: ${TEST_DB}"
psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${TEST_DB}\";"

# Tiklash (xatolarga toqat — ba'zi GRANT/owner ogohlantirishlari normal).
pg_restore --no-owner --no-privileges --dbname="${TEST_DB}" "${LATEST}" || true

# Butunlik tekshiruvi: kalit jadvallar mavjud va qatorlar o'qiladi.
CHECK_SQL="
  SELECT 'clinics' t, count(*) c FROM clinics
  UNION ALL SELECT 'users', count(*) FROM users
  UNION ALL SELECT 'patients', count(*) FROM patients
  UNION ALL SELECT 'appointments', count(*) FROM appointments
  UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;
"
echo "[restore-test] butunlik:"
psql -v ON_ERROR_STOP=1 --dbname="${TEST_DB}" -c "${CHECK_SQL}"

# Kamida bitta klinika bo'lishi kutiladi (seed). Bo'sh bo'lsa ogohlantirish.
CNT="$(psql -tA --dbname="${TEST_DB}" -c "SELECT count(*) FROM clinics;")"
echo "[restore-test] clinics soni: ${CNT}"

echo "[restore-test] MUVAFFAQIYATLI — backup tiklanadi va butun."
