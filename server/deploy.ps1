# Redeploy Lambda via SAM.
# Reads MongoDbUri, JwtSecret, GoogleClientId from server/.env.
# Pass AllowedOrigin as arg (defaults to .env value).
#
# Usage:
#   ./deploy.ps1                                       # use .env ALLOWED_ORIGIN
#   ./deploy.ps1 https://my-app.vercel.app             # override origin
#   ./deploy.ps1 -SkipBuild                            # skip sam build
#   ./deploy.ps1 https://my-app.vercel.app -SkipBuild

param(
  [string]$AllowedOrigin,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path .env)) {
  Write-Error '.env not found in server/. Cannot read secrets.'
  exit 1
}

$envMap = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') {
    $envMap[$matches[1]] = $matches[2]
  }
}

$required = @('MONGODB_URI', 'JWT_SECRET', 'GOOGLE_CLIENT_ID')
foreach ($k in $required) {
  if (-not $envMap[$k]) {
    Write-Error "Missing $k in .env"
    exit 1
  }
}

if (-not $AllowedOrigin) {
  $AllowedOrigin = $envMap['ALLOWED_ORIGIN']
}
if (-not $AllowedOrigin) {
  Write-Error 'AllowedOrigin not provided and ALLOWED_ORIGIN missing from .env'
  exit 1
}

Write-Host "Deploying with AllowedOrigin=$AllowedOrigin" -ForegroundColor Cyan

if (-not $SkipBuild) {
  Write-Host '==> sam build' -ForegroundColor Yellow
  sam build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host '==> sam deploy' -ForegroundColor Yellow
sam deploy `
  --no-confirm-changeset `
  --parameter-overrides `
    "MongoDbUri=$($envMap['MONGODB_URI'])" `
    "JwtSecret=$($envMap['JWT_SECRET'])" `
    "GoogleClientId=$($envMap['GOOGLE_CLIENT_ID'])" `
    "AllowedOrigin=$AllowedOrigin"

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> Done. Health check:' -ForegroundColor Green
Write-Host 'https://q2l7ptd9hb.execute-api.us-east-2.amazonaws.com/api/health'
