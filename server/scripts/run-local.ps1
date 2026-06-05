# =============================================================================
# Klinika CRM — Docker'siz LOKAL ishga tushirish (Windows, virtualizatsiyasiz)
# =============================================================================
# Redis (portable) + PostgreSQL 18 (Windows xizmati, 5432) + backend.
# Docker/VT-x KERAK EMAS.  Ishlatish:  .\scripts\run-local.ps1
#
# Agar skript bloklansa (ExecutionPolicy):
#   powershell -ExecutionPolicy Bypass -File .\scripts\run-local.ps1
#
# Talab: Node PATH'da (yoki C:\clinic-dev\node), Redis portable C:\clinic-dev\redis,
#        PostgreSQL 18 o'rnatilgan (clinic_crm bazasi, clinic/clinic_pass).
# =============================================================================
param(
  [string]$Root = "C:\clinic-dev",
  [string]$ServerDir = "$PSScriptRoot\.."
)

# Node PATH'da bo'lmasa — portable'ni qo'shamiz
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $nodeDir = (Get-ChildItem "$Root\node" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
  if ($nodeDir) { $env:Path = "$nodeDir;$env:Path" }
}

# Infratuzilma (Redis + PostgreSQL 18)
& "$PSScriptRoot\start-infra.ps1" -Root $Root

# Migratsiya + seed + start
Set-Location $ServerDir
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
Write-Host "Backend: http://localhost:3000/api/v1  (Swagger: /api/docs)" -ForegroundColor Cyan
npm run start:dev
