# Simple Web App test script

# --- [0.5] 環境変数のロード (.env) ---
if (Test-Path ".env") {
    Write-Host "Loading .env file..." -ForegroundColor Gray
    Get-Content .env | ForEach-Object {
        if ($_ -match "^\s*([^#\s][^=]*)\s*=\s*(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

$url = $env:GAS_DEPLOY_URL
$token = $env:GAS_SECRET_TOKEN

if ([string]::IsNullOrWhiteSpace($url)) {
    Write-Error "Error: GAS_DEPLOY_URL is not set in .env"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Error "Error: GAS_SECRET_TOKEN is not set in .env"
    exit 1
}

Write-Host "=== Web App API Test ===" -ForegroundColor Cyan
Write-Host "Target URL: $url" -ForegroundColor Gray
Write-Host ""

# Test 1: ping
Write-Host "[Test 1] Testing ping action..." -ForegroundColor Yellow
$pingUrl = "$url?token=$token&action=ping"
try {
    $response = Invoke-RestMethod -Uri $pingUrl -Method Get
    Write-Host "✓ Ping successful!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Compress)"
} catch {
    Write-Host "✗ Ping failed: $_" -ForegroundColor Red
}

Write-Host ""

# Test 2: exportAllDataToJson
Write-Host "[Test 2] Testing exportAllDataToJson action..." -ForegroundColor Yellow
$exportUrl = "$url?token=$token&action=exportAllDataToJson"
try {
    $response = Invoke-RestMethod -Uri $exportUrl -Method Get -TimeoutSec 30
    Write-Host "✓ Export successful!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Compress)"
} catch {
    Write-Host "✗ Export failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
