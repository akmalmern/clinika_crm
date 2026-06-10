# 💾 Backup va tiklash (Phase 9B)

> **Tamoyil:** sinalmagan backup = ishonchsiz backup. Shuning uchun `pg-restore-test`
> har kuni backup'ni **bo'sh bazaga tiklab** butunligini tekshiradi.

## Skriptlar

| Skript | Vazifa |
|---|---|
| `pg-backup.sh` / `.ps1` | PostgreSQL `pg_dump -Fc` (siqilgan, tanlab tiklanadi) + retention |
| `pg-restore-test.sh` / `.ps1` | So'nggi backup'ni vaqtinchalik bazaga tiklab, jadval/qatorlarni tekshiradi |
| `minio-backup.sh` | MinIO bucket (fayllar/skanlar) `mc mirror` |

## Saqlash siyosati (retention)

- PostgreSQL: kunlik dump, **14 kun** (`RETENTION_DAYS`). Haftalik/oylik uzoq saqlash
  uchun alohida cron + uzoqroq retention papkasi qo'shing (GFS: kunlik 14, haftalik 8, oylik 12).
- MinIO: `mc mirror` joriy holatni aks ettiradi; tarixiy versiyalar uchun MinIO
  **versioning**ni yoqing (`mc version enable`).
- Backup'larni **boshqa joyda** (boshqa disk / S3 / oflayn) ham saqlang (3-2-1 qoidasi).

## RTO / RPO

| Ko'rsatkich | Qiymat | Izoh |
|---|---|---|
| **RPO** (ma'lumot yo'qotish) | ≤ 24 soat | Kunlik backup. Kamaytirish: WAL arxivlash / PITR (oqim replikatsiya) |
| **RTO** (tiklash vaqti) | ~15–30 daq | `pg_restore` + ilova qayta ishga tushishi (baza hajmiga bog'liq) |

Qattiqroq RPO kerak bo'lsa: PostgreSQL **streaming replication** + WAL arxivlash
(Point-In-Time Recovery) — spec 1.7.A (primary + replica + failover).

## Rejalashtirish (schedule)

**Linux cron** (har kuni 02:30 backup, 03:00 tiklash sinovi):

```cron
30 2 * * *  DATABASE_URL=postgres://clinic:***@localhost:5432/clinic_crm BACKUP_DIR=/var/backups/clinic-crm/postgres /opt/clinic-crm/ops/backup/pg-backup.sh   >> /var/log/clinic-backup.log 2>&1
 0 3 * * *  PGHOST=localhost PGUSER=clinic PGPASSWORD=*** /opt/clinic-crm/ops/backup/pg-restore-test.sh   >> /var/log/clinic-restore-test.log 2>&1
15 2 * * *  MINIO_ENDPOINT=http://minio:9000 MINIO_ROOT_USER=*** MINIO_ROOT_PASSWORD=*** /opt/clinic-crm/ops/backup/minio-backup.sh   >> /var/log/clinic-minio-backup.log 2>&1
```

**Docker (prod):** `docker-compose.prod.yml` ga `backup` xizmati (postgres:16-alpine
image, cron yoki `ofelia`/`deck-chores` scheduler) qo'shib, `pg-backup.sh` ni volume
sifatida ulang. Sirlar env injection orqali.

**Windows (lokal sinov):**

```powershell
.\ops\backup\pg-backup.ps1
.\ops\backup\pg-restore-test.ps1
```

## Tiklash (haqiqiy avariya)

```bash
# 1) Ilovani to'xtating (yozuvni to'xtatish)
# 2) Bazani tiklang
createdb clinic_crm_restored
pg_restore --no-owner --no-privileges -d clinic_crm_restored /var/backups/.../clinic_crm_YYYYmmdd.dump
# 3) DATABASE_URL ni yangi bazaga yo'naltiring yoki nomini almashtiring
# 4) MinIO: mc mirror backup -> bucket
# 5) Ilovani ishga tushiring, /api/v1/ready bilan tekshiring
```
