# deploy.ps1 — Sundgren Realty
# Usage:
#   .\deploy.ps1           → build + deploy to staging
#   .\deploy.ps1 prod      → build + deploy to production

param([string]$target = "staging")

# Load Cloudflare token from credentials.md at runtime — never hardcode tokens here
$credsPath = "C:\Users\KillerGrowth\.openclaw\workspace\References\credentials.md"
$cfToken = (Select-String -Path $credsPath -Pattern 'cfut_[A-Za-z0-9]+' | Select-Object -First 1).Matches[0].Value
if (-not $cfToken) {
    Write-Host "ERROR: Could not read Cloudflare token from credentials.md" -ForegroundColor Red
    exit 1
}
$env:CLOUDFLARE_API_TOKEN = $cfToken
$env:CLOUDFLARE_ACCOUNT_ID = "27cafbbee6f8e1db0d9499405d4755c1"

# Clear wrangler content-hash cache before every deploy to prevent silent skip-upload bugs
$wranglerCache = ".\node_modules\.cache\wrangler"
if (Test-Path $wranglerCache) {
    Remove-Item $wranglerCache -Recurse -Force
    Write-Host "Wrangler cache cleared." -ForegroundColor DarkGray
}

Write-Host "Building Sundgren Realty..." -ForegroundColor Cyan
node build.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Aborting deploy." -ForegroundColor Red
    exit 1
}

# Safety gate — confirm dist/index.html looks like a real page
$indexPath = ".\dist\index.html"
$indexContent = Get-Content $indexPath -Raw -ErrorAction SilentlyContinue
if (-not $indexContent -or -not $indexContent.TrimStart().StartsWith("<!DOCTYPE")) {
    Write-Host "dist/index.html missing or malformed. Aborting deploy." -ForegroundColor Red
    exit 1
}

if ($target -eq "prod") {
    Write-Host "Deploying to PRODUCTION (main)..." -ForegroundColor Yellow
    npx wrangler pages deploy ./dist --project-name sundgren-realty --branch main --commit-dirty=true
} else {
    Write-Host "Deploying to STAGING..." -ForegroundColor Cyan
    npx wrangler pages deploy ./dist --project-name sundgren-realty --branch staging --commit-dirty=true
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deploy complete!" -ForegroundColor Green
} else {
    Write-Host "Deploy failed." -ForegroundColor Red
    exit 1
}
