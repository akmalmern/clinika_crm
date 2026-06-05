# Faqat portable Redis'ni to'xtatadi. `npm run db:down` orqali.
# PostgreSQL 18 — sizning Windows xizmatingiz, unga TEGMAYDI (boshqa dasturlar ham
# ishlatishi mumkin). Kerak bo'lsa qo'lda: Stop-Service postgresql-x64-18
Get-Process redis-server -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process minio -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Redis va MinIO to'xtatildi (PostgreSQL 18 xizmatiga tegilmadi)" -ForegroundColor Yellow
