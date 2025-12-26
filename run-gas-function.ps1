param([switch]$Force)

# Web App経由でexportAllDataToJsonを実行する
$url = $env:GAS_DEPLOY_URL
$token = $env:GAS_SECRET_TOKEN

if (-not $url -or -not $token) {
    Write-Error "環境変数 GAS_DEPLOY_URL と GAS_SECRET_TOKEN が設定されていません"
    Write-Host "setup-web-trigger.ps1 を実行してセットアップしてください" -ForegroundColor Yellow
    exit 1
}

Write-Host "Web App経由でexportAllDataToJsonを実行中..." -ForegroundColor Cyan

try {
    $body = @{
        function = "exportAllDataToJson"
        token = $token
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json" -TimeoutSec 300

    if ($response.status -eq "success") {
        Write-Host "✓ 実行成功" -ForegroundColor Green
        if ($response.result) {
            Write-Host "結果:" -ForegroundColor Gray
            $response.result | ConvertTo-Json -Depth 3 | Write-Host
        }
        exit 0
    } else {
        Write-Error "実行失敗: $($response.error)"
        exit 1
    }
} catch {
    Write-Error "HTTP リクエスト失敗: $_"
    exit 1
}
