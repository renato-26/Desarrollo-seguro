# Ejecutar desde la raíz: powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Falta Docker Desktop. Instálalo y ejecútalo antes de continuar.' }
if (-not (Test-Path .env)) { Copy-Item .env.example .env; Write-Host 'Se creó .env. COMPLETA POSTGRES_PASSWORD antes de reintentar.'; exit 1 }
$envFile = Get-Content .env -Raw
if ($envFile -match '(?m)^POSTGRES_PASSWORD\s*=\s*$') { throw 'Completar POSTGRES_PASSWORD en .env' }
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose inválido' }
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw 'No fue posible iniciar los contenedores' }
docker compose run --rm migrate node database/run.js seed
if ($LASTEXITCODE -ne 0) { throw 'No fue posible importar el seed' }
Write-Host 'Frontend: http://localhost:3000'
Write-Host 'API: http://localhost:3000/api/restaurantes'
Write-Host 'Salud: http://localhost:3000/api/health'
