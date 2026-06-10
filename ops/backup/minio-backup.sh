#!/usr/bin/env bash
# =============================================================================
# Klinika CRM — MinIO (fayl/hujjat) backup (spec 9B / 6.3)
# =============================================================================
# Fayllar (bemor/xodim hujjatlari, skanlar) MinIO bucket'da. `mc mirror` bilan
# backup joyiga ko'chiriladi (--overwrite + --remove o'chirilganlarni ham
# sinxronlaydi; tarixiy nusxa kerak bo'lsa versiyalashni MinIO'da yoqing).
#
# Ishlatish:
#   MINIO_ENDPOINT=http://minio:9000 MINIO_ROOT_USER=... MINIO_ROOT_PASSWORD=... \
#   MINIO_BUCKET=clinic-files ./minio-backup.sh
# =============================================================================
set -euo pipefail

ENDPOINT="${MINIO_ENDPOINT:-http://127.0.0.1:9000}"
ACCESS="${MINIO_ROOT_USER:-minioadmin}"
SECRET="${MINIO_ROOT_PASSWORD:-minioadmin}"
BUCKET="${MINIO_BUCKET:-clinic-files}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/clinic-crm/minio}"

mkdir -p "${BACKUP_DIR}"

# mc alias (CI/konteynerda mc o'rnatilgan bo'lsa).
mc alias set clinicbk "${ENDPOINT}" "${ACCESS}" "${SECRET}" >/dev/null

echo "[minio-backup] $(date -Is) mirror ${BUCKET} -> ${BACKUP_DIR}"
mc mirror --overwrite "clinicbk/${BUCKET}" "${BACKUP_DIR}/${BUCKET}"
echo "[minio-backup] tugadi (objects: $(mc ls --recursive "clinicbk/${BUCKET}" | wc -l))"
