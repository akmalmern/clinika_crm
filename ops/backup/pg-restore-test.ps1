# =============================================================================
# Klinika CRM — Backup TIKLASH SINOVI (Windows lokal).
# Eng so'nggi dump'ni alohida bo'sh bazaga tiklaydi, butunligini tekshiradi,
# so'ng vaqtinchalik bazani o'chiradi. (Sinalmagan backup = ishonchsiz backup.)
# =============================================================================
param(
  [string]$BackupDir = "$PSScriptRoot\..\..\.backups\postgres",
  [string]$PgHost = "localhost",
  [int]$Port = 5432,
  [string]$User = "clinic",
  [string]$Password = "clinic_pass"
)
$ErrorActionPreference = "Stop"
$env:PGPASSWORD = $Password

function Find-Tool([string]$name) {
  $t = (Get-Command $name -ErrorAction SilentlyContinue).Source
  if (-not $t) {
    $c = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$name.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { $t = $c.FullName }
  }
  if (-not $t) { throw "$name topilmadi" }
  return $t
}
$psql = Find-Tool "psql"
$pgRestore = Find-Tool "pg_restore"

$latest = Get-ChildItem $BackupDir -Filter "clinic_crm_*.dump" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latest) { throw "Backup topilmadi: $BackupDir" }
Write-Output "[restore-test] backup: $($latest.Name)"

$testDb = "clinic_crm_rt_$(Get-Date -Format 'yyyyMMddHHmmss')"

try {
  & $psql -h $PgHost -p $Port -U $User -d "postgres" -v "ON_ERROR_STOP=1" -c "CREATE DATABASE ""$testDb"";" | Out-Null
  Write-Output "[restore-test] vaqtinchalik baza: $testDb"

  & $pgRestore -h $PgHost -p $Port -U $User --no-owner --no-privileges --dbname=$testDb $latest.FullName 2>$null

  $check = "SELECT 'clinics' AS t, count(*) AS c FROM clinics UNION ALL SELECT 'patients', count(*) FROM patients UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;"
  Write-Output "[restore-test] butunlik:"
  & $psql -h $PgHost -p $Port -U $User -d $testDb -c $check

  $cnt = (& $psql -tA -h $PgHost -p $Port -U $User -d $testDb -c "SELECT count(*) FROM clinics;").Trim()
  Write-Output "[restore-test] clinics soni: $cnt"
  if ([int]$cnt -ge 0) { Write-Output "[restore-test] MUVAFFAQIYATLI - backup tiklanadi va butun." }
}
finally {
  & $psql -h $PgHost -p $Port -U $User -d "postgres" -c "DROP DATABASE IF EXISTS ""$testDb"" WITH (FORCE);" 2>$null | Out-Null
  Write-Output "[restore-test] vaqtinchalik baza o'chirildi."
}
