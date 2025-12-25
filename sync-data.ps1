param([string]$message = "automated sync update")

# ========================================
# 統合データ同期スクリプト (Enhanced v3)
# ========================================
# 
# 用途: ローカルの変更 (HTML/JS/GAS) を GAS と GitHub に同期し、
#       最新のデータを生成して GitHub Pages に反映させます。
#
# 実行順序:
#   1. ローカルの GAS 変更を clasp push (src/ 以下の変更がある場合)
#   2. GAS 関数 (exportAllDataToJson) を実行して最新データを GitHub にプッシュ
#   3. GitHub から最新のデータ (dic.html 等) を git pull で取得
#   4. 全ての変更 (アプリ本体 + 更新データ) を git push で公開
# ========================================

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Unified Sync & Export Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Node.js接続エラー対策: IPv4を優先
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"

# --- [1/4] GAS へのアップロード (clasp push) ---
Write-Host "[1/4] Checking GAS source changes (src/)..." -ForegroundColor Yellow
$gasChanges = git status --porcelain src/
if ($gasChanges) {
    Write-Host "✓ Detected changes in GAS source. Uploading..." -ForegroundColor Gray
    Push-Location "src"
    clasp push -f
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ clasp push failed. Script aborted."
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "✓ GAS source updated successfully." -ForegroundColor Green
} else {
    Write-Host "✓ No changes in src/ detected. Skipping clasp push." -ForegroundColor Gray
}
Write-Host ""

# --- [2/4] GAS 関数の実行 (最新データ生成) ---
Write-Host "[2/4] Triggering GAS function (exportAllDataToJson)..." -ForegroundColor Yellow
Write-Host "This will update data files and dic.html on GitHub..." -ForegroundColor Gray

# clasp run を実行
clasp run exportAllDataToJson
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ clasp run failed. Make sure you are logged in with 'clasp login' and Apps Script API is enabled."
    exit 1
}
Write-Host "✓ GAS function executed successfully. Files pushed to GitHub." -ForegroundColor Green
Write-Host ""

# --- [3/4] 最新データのローカル同期 (git pull) ---
Write-Host "[3/4] Pulling latest data from GitHub..." -ForegroundColor Yellow
git pull --rebase
if ($LASTEXITCODE -ne 0) {
    Write-Warning "⚠ git pull failed or has conflicts. Please resolve manually."
    exit 1
}
Write-Host "✓ Local repository is now up to date." -ForegroundColor Green
Write-Host ""

# --- [4/4] 全ての変更を GitHub に公開 (git push) ---
Write-Host "[4/4] Committing and Pushing all changes..." -ForegroundColor Yellow
$appChanges = git status --porcelain
if ($appChanges) {
    Write-Host "✓ Detected local changes (App code or updated data)." -ForegroundColor Gray
    git add .
    # ユーザー指定のメッセージがない場合は自動生成
    $commitMsg = if ($message -eq "automated sync update") { "Sync: App update and data refresh [$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))]" } else { $message }
    git commit -m $commitMsg -q
    
    Write-Host "Pushing to GitHub..." -ForegroundColor Gray
    git push
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ git push failed."
        exit 1
    }
    Write-Host "✓ All changes published to GitHub Pages!" -ForegroundColor Green
} else {
    Write-Host "✓ Nothing new to push to GitHub." -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✓ COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "App and Data are now synchronized." -ForegroundColor White
Write-Host "Check the live site in a few minutes:" -ForegroundColor Gray
Write-Host "https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/home.html" -ForegroundColor Blue
Write-Host ""
