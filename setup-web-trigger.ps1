# ========================================
# Web Trigger セットアップスクリプト
# ========================================
# 
# 用途: Web App 経由で GAS 関数を実行するための初回セットアップ
# 
# このスクリプトは以下を行います:
# 1. 秘密トークンの生成
# 2. 環境変数の設定
# 3. Web App への接続テスト
# 
# 使い方:
#   .\setup-web-trigger.ps1
# ========================================

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Web Trigger Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# ステップ 1: 現在の設定を確認
Write-Host "Step 1: Checking current configuration..." -ForegroundColor Yellow
Write-Host ""

$currentUrl = $env:GAS_DEPLOY_URL
$currentToken = $env:GAS_SECRET_TOKEN

if ($currentUrl) {
    Write-Host "  Current GAS_DEPLOY_URL: $currentUrl" -ForegroundColor Gray
} else {
    Write-Host "  GAS_DEPLOY_URL: Not set" -ForegroundColor Gray
}

if ($currentToken) {
    Write-Host "  Current GAS_SECRET_TOKEN: ***${currentToken.Substring([Math]::Max(0, $currentToken.Length - 4))}" -ForegroundColor Gray
} else {
    Write-Host "  GAS_SECRET_TOKEN: Not set" -ForegroundColor Gray
}
Write-Host ""

# ステップ 2: Web App のデプロイ手順を表示
Write-Host "Step 2: Deploy Web App in Google Apps Script" -ForegroundColor Yellow
Write-Host ""
Write-Host "Before setting up environment variables, you need to deploy the Web App:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Run: clasp push" -ForegroundColor Cyan
Write-Host "       (from: c:\Users\okawa\gaswebapp-manual\src)" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Open GAS Editor:" -ForegroundColor Cyan
Write-Host "       clasp open" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. In GAS Editor, run 'generateSecretToken' function:" -ForegroundColor Cyan
Write-Host "       - Select 'generateSecretToken' from function dropdown" -ForegroundColor Gray
Write-Host "       - Click 'Run' button" -ForegroundColor Gray
Write-Host "       - Copy the token from the execution log" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Update web_trigger.js:" -ForegroundColor Cyan
Write-Host "       - Replace SECRET_TOKEN with the generated token" -ForegroundColor Gray
Write-Host "       - Run 'clasp push' again" -ForegroundColor Gray
Write-Host ""
Write-Host "  5. Create new deployment:" -ForegroundColor Cyan
Write-Host "       - Click 'Deploy' > 'New deployment'" -ForegroundColor Gray
Write-Host "       - Select type: 'Web app'" -ForegroundColor Gray
Write-Host "       - Execute as: 'Me'" -ForegroundColor Gray
Write-Host "       - Who has access: 'Anyone'" -ForegroundColor Gray
Write-Host "       - Click 'Deploy'" -ForegroundColor Gray
Write-Host "       - Copy the 'Web app URL'" -ForegroundColor Gray
Write-Host ""

$continue = Read-Host "Have you completed the deployment? (y/n)"
if ($continue -ne 'y' -and $continue -ne 'Y') {
    Write-Host ""
    Write-Host "Setup cancelled. Please complete the deployment first." -ForegroundColor Yellow
    exit 0
}

# ステップ 3: 環境変数の入力
Write-Host ""
Write-Host "Step 3: Enter Web App configuration" -ForegroundColor Yellow
Write-Host ""

# デプロイ URL の入力
if ($currentUrl) {
    Write-Host "Current Deploy URL: $currentUrl" -ForegroundColor Gray
    $useCurrentUrl = Read-Host "Use current URL? (y/n)"
    if ($useCurrentUrl -eq 'y' -or $useCurrentUrl -eq 'Y') {
        $deployUrl = $currentUrl
    } else {
        $deployUrl = Read-Host "Enter Web App Deploy URL"
    }
} else {
    $deployUrl = Read-Host "Enter Web App Deploy URL"
}

# 秘密トークンの入力
if ($currentToken) {
    Write-Host "Current Secret Token: ***${currentToken.Substring([Math]::Max(0, $currentToken.Length - 4))}" -ForegroundColor Gray
    $useCurrentToken = Read-Host "Use current token? (y/n)"
    if ($useCurrentToken -eq 'y' -or $useCurrentToken -eq 'Y') {
        $secretToken = $currentToken
    } else {
        $secretToken = Read-Host "Enter Secret Token (from generateSecretToken output)"
    }
} else {
    $secretToken = Read-Host "Enter Secret Token (from generateSecretToken output)"
}

# 環境変数を設定（ユーザーレベル）
Write-Host ""
Write-Host "Setting environment variables..." -ForegroundColor Yellow
[System.Environment]::SetEnvironmentVariable("GAS_DEPLOY_URL", $deployUrl, [System.EnvironmentVariableTarget]::User)
[System.Environment]::SetEnvironmentVariable("GAS_SECRET_TOKEN", $secretToken, [System.EnvironmentVariableTarget]::User)

# 現在のセッション用にも設定
$env:GAS_DEPLOY_URL = $deployUrl
$env:GAS_SECRET_TOKEN = $secretToken

Write-Host "✓ Environment variables set" -ForegroundColor Green
Write-Host ""

# ステップ 4: 接続テスト
Write-Host "Step 4: Testing connection..." -ForegroundColor Yellow
Write-Host ""

try {
    $testUrl = "${deployUrl}?token=${secretToken}&action=ping"
    $response = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -ErrorAction Stop
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "✓ Connection test successful!" -ForegroundColor Green
        Write-Host "  Message: $($result.message)" -ForegroundColor Gray
        Write-Host "  Timestamp: $($result.timestamp)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Connection test failed: $($result.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Connection test failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. Deploy URL is correct" -ForegroundColor White
    Write-Host "  2. Secret token matches the token in web_trigger.js" -ForegroundColor White
    Write-Host "  3. Web App is deployed and accessible" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✓ Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now use:" -ForegroundColor White
Write-Host "  .\update-dic-layout.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "Environment variables are set permanently for your user account." -ForegroundColor Gray
