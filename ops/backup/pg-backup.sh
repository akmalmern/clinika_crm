#!/usr/bin/env bash
# =============================================================================
# Klinika CRM — PostgreSQL backup (spec 9B / 10: "sinalmagan backup = ishonchsiz")
# =============================================================================
# pg_dump custom (-Fc) formati: siqilgan + tanlab tiklash (pg_restore) imkonini
# beradi. Har kuni cron orqali chaqiriladi. Eski nusxalar RETENTION_DAYS dan
# keyin o'chiriladi.
#
# Ishlatish:
#   DATABASE_URL=postgres://user:pass@host:5432/db ./pg-backup.sh
#   yoki PG* env (PGHOST/PGUSER/PGPASSWORD/PGDATABASE).
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/clinic-crm/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TS="$(date +%Y%m%d_%H%M%S)"
DB_NAME="${PGDATABASE:-clinic_crm}"
OUT="${BACKUP_DIR}/${DB_NAME}_${TS}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[backup] $(date -Is) -> ${OUT}"

# DATABASE_URL berilgan bo'lsa: pg_dump (libpq URI) Prisma'ning `?schema=`
# parametrini tushunmaydi -> olib tashlaymiz.
if [[ -n "${DATABASE_URL:-}" ]]; then
  CLEAN_URL="$(printf '%s' "${DATABASE_URL}" | sed -E 's/([?&])schema=[^&]*/\1/; s/[?&]$//')"
  pg_dump --format=custom --no-owner --no-privileges --file="${OUT}" "${CLEAN_URL}"
else
  pg_dump --format=custom --no-owner --no-privileges --file="${OUT}"
fi

# Butunlik: dump fayl o'qiladimi (TOC ro'yxati).
pg_restore --list "${OUT}" > /dev/null
echo "[backup] OK (size: $(du -h "${OUT}" | cut -f1))"

# Retention — eski nusxalarni tozalash.
find "${BACKUP_DIR}" -name "${DB_NAME}_*.dump" -type f -mtime "+${RETENTION_DAYS}" -print -delete \
  | sed 's/^/[backup] retention o`chirildi: /' || true

echo "[backup] tugadi."
