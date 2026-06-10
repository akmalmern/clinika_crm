# =============================================================================
# Klinika CRM — PostgreSQL backup (Windows lokal). Linux/prod uchun pg-backup.sh.
# =============================================================================
#   .\pg-backup.ps1                      # .env dagi DATABASE_URL ishlatiladi
#   $env:DATABASE_URL="..."; .\pg-backup.ps1
# =============================================================================
param(
  [string]$BackupDir = "$PSScriptRoot\..\..\.backups\postgres",
  [int]$RetentionDays = 14,
  [string]$DatabaseUrl = $env:DATABASE_URL
)
$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  # server/.env dan o'qishga urinish
  $envFile = Join-Path $PSScriptRoot "..\..\server\.env"
  if (Test-Path $envFile) {
    $line = (Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
    if ($line) { $DatabaseUrl = ($line -replace '^DATABASE_URL=', '').Trim() }
  }
}
if (-not $DatabaseUrl) { throw "DATABASE_URL topilmadi (.env yoki -DatabaseUrl)" }

# pg_dump'ni topish (PATH yoki PG18 standart bin).
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
  $cand = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cand) { $pgDump = $cand.FullName }
}
if (-not $pgDump) { throw "pg_dump topilmadi (PATH yoki C:\Program Files\PostgreSQL\*\bin)" }

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$out = Join-Path $BackupDir "clinic_crm_$ts.dump"

# pg_dump (libpq URI) Prisma'ning `?schema=` parametrini tushunmaydi -> olib tashlaymiz.
$cleanUrl = $DatabaseUrl -replace '([?&])schema=[^&]*', '$1' -replace '[?&]$', ''

Write-Output "[backup] $pgDump -> $out"
& $pgDump --format=custom --no-owner --no-privileges --file=$out $cleanUrl
if ($LASTEXITCODE -ne 0) { throw "pg_dump xato ($LASTEXITCODE)" }

$size = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Output "[backup] OK (${size} KB)"

# Retention
Get-ChildItem $BackupDir -Filter "clinic_crm_*.dump" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
  ForEach-Object { Write-Output "[backup] retention: $($_.Name)"; Remove-Item $_.FullName -Force }

Write-Output "[backup] tugadi."
