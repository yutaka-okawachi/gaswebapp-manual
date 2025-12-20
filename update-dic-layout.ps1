param([string]$message = "dic.html layout update")

# ========================================
# dic.html Layout Update Script (完全自動化版 v2)
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

# 環境変数の取得（現在のセッションまたはユーザー環境変数から）
$DEPLOY_URL = $env:GAS_DEPLOY_URL
$SECRET_TOKEN = $env:GAS_SECRET_TOKEN

# Node.js接続エラー対策: IPv4を優先
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"

# 環境変数が見つからない場合、ユーザー環境変数から読み込み
if (-not $DEPLOY_URL) {
    $DEPLOY_URL = [Environment]::GetEnvironmentVariable("GAS_DEPLOY_URL", "User")
    if ($DEPLOY_URL) {
        $env:GAS_DEPLOY_URL = $DEPLOY_URL
        Write-Host "✓ Loaded GAS_DEPLOY_URL from user environment" -ForegroundColor Gray
    }
}

if (-not $SECRET_TOKEN) {
    $SECRET_TOKEN = [Environment]::GetEnvironmentVariable("GAS_SECRET_TOKEN", "User")
    if ($SECRET_TOKEN) {
        $env:GAS_SECRET_TOKEN = $SECRET_TOKEN
        Write-Host "✓ Loaded GAS_SECRET_TOKEN from user environment" -ForegroundColor Gray
    }
}

# トリム処理（余計な改行や空白を除去）
if ($DEPLOY_URL) { $DEPLOY_URL = $DEPLOY_URL.Trim() }
if ($SECRET_TOKEN) { $SECRET_TOKEN = $SECRET_TOKEN.Trim() }

# それでも見つからない場合はエラー
if (-not $DEPLOY_URL -or -not $SECRET_TOKEN) {
    Write-Host "❌ Error: Environment variables not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run the setup script first:" -ForegroundColor Yellow
    Write-Host "  .\setup-web-trigger.ps1" -ForegroundColor White
    exit 1
}

# ステップ 0: ローカル変更を先にコミット（ワークフロー競合を回避）

Write-Host "[0/4] Checking for local changes..." -ForegroundColor Yellow
$hasChanges = git status --porcelain src/generate_dic_html.js
if ($hasChanges) {
    Write-Host "✓ Found local changes in generate_dic_html.js" -ForegroundColor Gray
    git add src/generate_dic_html.js
    git commit -m "Update dic.html template: $message" -q
    Write-Host "✓ Local changes committed" -ForegroundColor Green
} else {
    Write-Host "✓ No local changes to commit" -ForegroundColor Gray
}
Write-Host ""

# ステップ 1: GAS にアップロード
Write-Host "[1/4] Uploading to GAS..." -ForegroundColor Yellow
Push-Location "c:\Users\okawa\gaswebapp-manual\src"
clasp push -f
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ clasp push failed"
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✓ clasp push complete" -ForegroundColor Green
Write-Host ""

# ステップ 2: GAS関数の実行 (clasp run)
Write-Host "[2/4] Triggering GAS function (exportAllDataToJson)..." -ForegroundColor Yellow

# clasp run を実行
Write-Host "Running: clasp run exportAllDataToJson" -ForegroundColor Gray
clasp run exportAllDataToJson
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ clasp run failed. Please ensure 'Apps Script API' is enabled in GCP project."
    Pop-Location
    exit 1
}

Write-Host "✓ GAS function executed successfully." -ForegroundColor Green
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

# ステップ 3.5: dic.htmlのCSS検証
Write-Host "[3.5/4] Verifying CSS in dic.html..." -ForegroundColor Yellow
$dicHtmlPath = "mahler-search-app\dic.html"
if (Test-Path $dicHtmlPath) {
    $dicHtmlContent = Get-Content $dicHtmlPath -Raw -Encoding UTF8
    
    # .abbr-titleのfont-sizeをチェック
    if ($dicHtmlContent -match '\.abbr-title\s*\{[^}]*font-size:\s*1\.0rem') {
        Write-Host "✓ CSS verified: .abbr-title is 1.0rem" -ForegroundColor Green
    } elseif ($dicHtmlContent -match '\.abbr-title\s*\{[^}]*font-size:\s*0\.8rem') {
        Write-Warning "⚠ CSS mismatch detected!"
        Write-Warning ".abbr-title is still 0.8rem (expected 1.0rem)"
        Write-Host ""
        Write-Host "This may indicate:" -ForegroundColor Yellow
        Write-Host "  1. GAS did not regenerate dic.html" -ForegroundColor White
        Write-Host "  2. GAS is using an old version of generate_dic_html.js" -ForegroundColor White
        Write-Host ""
        Write-Host "Please manually verify in GAS Editor:" -ForegroundColor Yellow
        Write-Host "  https://script.google.com/home" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host "✓ CSS check: .abbr-title found (unable to determine exact font-size)" -ForegroundColor Gray
    }
} else {
    Write-Warning "⚠ dic.html not found at $dicHtmlPath"
}
Write-Host ""


# ステップ 4: その他の変更を確認してコミット
Write-Host "[4/4] Committing other changes..." -ForegroundColor Yellow
$otherChanges = git status --porcelain
if ($otherChanges) {
    Write-Host "✓ Found other changes to commit" -ForegroundColor Gray
    git add .
    git commit -m $message -q
    Write-Host "✓ Changes committed" -ForegroundColor Green
} else {
    Write-Host "✓ No other changes to commit" -ForegroundColor Gray
}
Write-Host ""

# ステップ 5: 変更を GitHub にプッシュ
Write-Host "[5/6] Pushing to GitHub..." -ForegroundColor Yellow
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
Write-Host ""

