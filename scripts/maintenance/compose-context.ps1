# Dot-source to define helpers. Loading this file runs no Docker commands.
function Invoke-PnkCompose {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('dev', 'qa')][string]$Target,
        [Parameter(Mandatory = $true)][string[]]$ComposeArgs
    )
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $envFile = if ($Target -eq 'dev') { '.env' } else { '.env.qa' }
    $controlled = @('APP_ENV', 'NODE_ENV', 'PORT', 'DB_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'DATABASE_URL', 'COMPOSE_FILE', 'COMPOSE_PROJECT_NAME', 'COMPOSE_PROFILES', 'COMPOSE_ENV_FILES')
    $previous = @{}
    Push-Location -LiteralPath $repoRoot
    try {
        foreach ($key in $controlled) {
            $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
            [Environment]::SetEnvironmentVariable($key, $null, 'Process')
        }
        & node --input-type=module -e "import{readFileSync}from'node:fs';import{configFor,parseEnvFile}from'./scripts/stack.mjs';const target=process.argv[1];configFor(target,parseEnvFile(readFileSync(target==='dev'?'.env':'.env.qa','utf8')));" $Target
        if ($LASTEXITCODE -ne 0) { throw 'Archivo de entorno no valido; operacion cancelada' }
        $env:APP_ENV = $Target
        $env:NODE_ENV = if ($Target -eq 'dev') { 'development' } else { 'test' }
        $env:PORT = if ($Target -eq 'dev') { '3101' } else { '3201' }
        $env:DB_PORT = if ($Target -eq 'dev') { '5433' } else { '5434' }
        & docker compose --project-name "pnksecurity-$Target" --env-file $envFile --file compose.yaml @ComposeArgs
        if ($LASTEXITCODE -ne 0) { throw "Fallo Docker Compose en $Target; detener el procedimiento" }
    }
    finally {
        foreach ($key in $controlled) {
            if ($previous.ContainsKey($key)) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
        }
        Pop-Location
    }
}

function Invoke-PnkDocker {
    param([Parameter(Mandatory = $true)][string[]]$DockerArgs)
    & docker @DockerArgs
    if ($LASTEXITCODE -ne 0) { throw 'Fallo Docker; detener el procedimiento' }
}

function Invoke-PnkNode {
    param([Parameter(Mandatory = $true)][string[]]$NodeArgs)
    & node @NodeArgs
    if ($LASTEXITCODE -ne 0) { throw 'Fallo una comprobacion Node; detener el procedimiento' }
}

function Get-PnkSourceFingerprint {
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $paths = @('Dockerfile', '.dockerignore', 'compose.yaml', 'compose.production.yaml', 'package.json', 'package-lock.json', 'scripts/create-admin.js', 'scripts/stack.mjs')
    foreach ($tree in @('backend', 'frontend', 'database', 'scripts/maintenance')) {
        $paths += Get-ChildItem -LiteralPath (Join-Path $repoRoot $tree) -Recurse -File -Force |
            Where-Object { $_.FullName -notmatch '[\\/]frontend[\\/]dist[\\/]' -and $_.FullName -notmatch '[\\/](playwright-report|test-results|node_modules)[\\/]' -and $_.Name -notmatch '^\.env(?:\.|$)' } |
            ForEach-Object { $_.FullName.Substring($repoRoot.Length + 1).Replace('\', '/') }
    }
    $rows = foreach ($path in ($paths | Sort-Object -Unique)) {
        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $repoRoot $path)).Hash
        "$path=$hash"
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($rows -join "`n"))
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
}
