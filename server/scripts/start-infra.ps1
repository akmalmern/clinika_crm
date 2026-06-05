# Redis (portable) ni ishga tushiradi va PostgreSQL 18 (Windows xizmati, 5432) ishlab
# turganini tekshiradi. `npm run db:up` orqali chaqiriladi. Docker/VT-x KERAK EMAS.
#
# Eslatma: PostgreSQL 18 — Windows xizmati (postgresql-x64-18, Automatic), kompyuter
# yonganda o'zi ishga tushadi. clinic_crm bazasi shu yerda (port 5432).
param([string]$Root = "C:\clinic-dev")

# --- Redis (portable) ---
if (-not (Get-Process redis-server -ErrorAction SilentlyContinue)) {
  Start-Process "$Root\redis\redis-server.exe" `
    -ArgumentList '--port','6379','--requirepass','redis_pass' -WindowStyle Hidden
  Start-Sleep 2
}
Write-Host "Redis tayyor (6379)" -ForegroundColor Green

# --- MinIO (portable, S3-mos fayl saqlash) ---
if (-not (Get-Process minio -ErrorAction SilentlyContinue)) {
  $env:MINIO_ROOT_USER = 'minioadmin'
  $env:MINIO_ROOT_PASSWORD = 'minioadmin'
  Start-Process "$Root\minio\minio.exe" `
    -ArgumentList 'server', "$Root\minio-data", '--address', ':9000', '--console-address', ':9001' `
    -WindowStyle Hidden
  Start-Sleep 3
}
Write-Host "MinIO tayyor (S3: 9000, Console: 9001)" -ForegroundColor Green

# --- PostgreSQL 18 xizmati (kerak bo'lsa ishga tushiramiz) ---
$svc = Get-Service postgresql-x64-18 -ErrorAction SilentlyContinue
if ($svc) {
  if ($svc.Status -ne 'Running') { Start-Service postgresql-x64-18 -ErrorAction SilentlyContinue; Start-Sleep 2 }
  Write-Host "PostgreSQL 18: $((Get-Service postgresql-x64-18).Status) (port 5432, db=clinic_crm)" -ForegroundColor Green
} else {
  Write-Host "DIQQAT: postgresql-x64-18 xizmati topilmadi. PostgreSQL ishlab turganiga ishonch hosil qiling (5432)." -ForegroundColor Yellow
}
