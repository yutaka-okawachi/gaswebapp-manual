param([string]$message = "dic.html layout update")

# ========================================
# dic.html Layout Update Script (完全自動化版)
# ========================================
# 
# 用途: generate_dic_html.js のレイアウト変更を dic.html に反映し、
#       GitHub にプッシュします。
# 
# 必要な環境変数:
#   GAS_DEPLOY_URL    - Web App のデプロイ URL
#   GAS_SECRET_TOKEN  - 認証用の秘密トークン
# 
# 初回セットアップ:
#   .\setup-web-trigger.ps1
# 
# 使い方:
#   .\update-dic-layout.ps1
#   .\update-dic-layout.ps1 -message "Custom commit message"
# ========================================

Write-Host "================================" -ForegroundColor Cyan
Write-Host "dic.html Layout Update Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 環境変数のチェック
$DEPLOY_URL = $env:GAS_DEPLOY_URL
$SECRET_TOKEN = $env:GAS_SECRET_TOKEN

if (-not $DEPLOY_URL -or -not $SECRET_TOKEN) {
    Write-Host "❌ Error: Environment variables not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run the setup script first:" -ForegroundColor Yellow
    Write-Host "  .\setup-web-trigger.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Or set the variables manually:" -ForegroundColor Yellow
    Write-Host "  `$env:GAS_DEPLOY_URL = 'https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec'" -ForegroundColor White
    Write-Host "  `$env:GAS_SECRET_TOKEN = 'your_secret_token'" -ForegroundColor White
    exit 1
}

# ステップ 1: GAS にアップロード
Write-Host "[1/4] Uploading to GAS..." -ForegroundColor Yellow
Push-Location "c:\Users\okawa\gaswebapp-manual\src"
clasp push
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ clasp push failed"
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✓ clasp push complete" -ForegroundColor Green
Write-Host ""

# ステップ 2: Web App 経由で GAS 関数を実行
Write-Host "[2/4] Triggering GAS function via Web App..." -ForegroundColor Yellow
try {
    $url = "${DEPLOY_URL}?token=${SECRET_TOKEN}&action=exportDic"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "✓ dic.html exported successfully" -ForegroundColor Green
        Write-Host "  Timestamp: $($result.timestamp)" -ForegroundColor Gray
    } else {
        Write-Error "❌ GAS execution failed: $($result.error)"
        exit 1
    }
} catch {
    Write-Error "❌ Failed to call Web App: $_"
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check that GAS_DEPLOY_URL is correct" -ForegroundColor White
    Write-Host "2. Check that GAS_SECRET_TOKEN matches the token in web_trigger.js" -ForegroundColor White
    Write-Host "3. Verify the Web App is deployed and accessible" -ForegroundColor White
    exit 1
}
Write-Host ""

# ステップ 3: GitHub から最新の dic.html を取得
Write-Host "[3/4] Getting latest dic.html from GitHub..." -ForegroundColor Yellow
git pull --rebase
if ($LASTEXITCODE -ne 0) {
    Write-Warning "⚠ git pull had issues, but continuing..."
} else {
    Write-Host "✓ git pull complete" -ForegroundColor Green
}
Write-Host ""

# ステップ 4: 変更を GitHub にプッシュ
Write-Host "[4/4] Pushing changes to GitHub..." -ForegroundColor Yellow
git add .
git commit -m $message
git push
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Push complete" -ForegroundColor Green
} else {
    Write-Warning "⚠ Push may have failed"
}
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "✓ Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "dic.html has been updated" -ForegroundColor White
Write-Host "Check: mahler-search-app/dic.html" -ForegroundColor Gray
Write-Host ""
Write-Host "GitHub Pages will update in a few minutes:" -ForegroundColor White
Write-Host "  https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/dic.html" -ForegroundColor Blue
