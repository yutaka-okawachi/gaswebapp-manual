# Simple Web App test script
$url = "https://script.google.com/macros/s/AKfycbxXrpTOFxkBnR__yuekObS9UroJ-7UxX2FVl56MUCEIKmPufOhH6_L-C57mAs-elpfTiQ/exec"
$token = "f14d3d3a-88f9-49b7-abcb-9da7a870f18b"

Write-Host "=== Web App API Test ===" -ForegroundColor Cyan
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
