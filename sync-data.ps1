param([string]$message = "automated sync update")

# ========================================
# 統合データ同期スクリプト (Enhanced v4)
# ========================================
# 
# 用途: ローカルの変更 (HTML/JS/GAS) を GAS と GitHub に同期し、
#       最新のデータを生成して GitHub Pages に反映させます。
#
# 実行順序:
#   1. ローカルの GAS 変更を clasp push (src/ 以下の変更がある場合)
#   2. ローカルの変更を git commit (clean working directory ensure)
#   3. GAS 関数 (exportAllDataToJson) を実行して最新データを GitHub にプッシュ
#   4. GitHub から最新のデータ (dic.html 等) を git pull --rebase で取得
#   5. 全ての変更を git push で公開
# ========================================

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Unified Sync & Export Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Node.js接続エラー対策: IPv4を優先
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"

# --- [1/5] GAS へのアップロード (clasp push) ---
Write-Host "[1/5] Checking GAS source changes (src/)..." -ForegroundColor Yellow
$gasChanges = git status --porcelain src/
if ($gasChanges) {
    Write-Host "✓ Detected changes in GAS source. Uploading..." -ForegroundColor Gray
    Push-Location "src"
    
    # clasp push を実行（エラー出力をキャプチャ）
    $pushOutput = clasp push -f 2>&1
    $pushExitCode = $LASTEXITCODE
    
    if ($pushExitCode -ne 0) {
        # 権限エラーを検出
        if ($pushOutput -match "permission|unauthorized|credentials|not logged in") {
            Write-Host ""
            Write-Warning "⚠ Authentication error detected. Please re-login to clasp."
            Write-Host ""
            Write-Host "Run the following commands:" -ForegroundColor Cyan
            Write-Host "  1. clasp logout" -ForegroundColor White
            Write-Host "  2. clasp login" -ForegroundColor White
            Write-Host "  3. .\sync-data.ps1" -ForegroundColor White
            Write-Host ""
            Pop-Location
            exit 1
        }
        Write-Error "❌ clasp push failed."
        Pop-Location
        exit 1
    }
    
    Pop-Location
    Write-Host "✓ GAS source updated successfully." -ForegroundColor Green
} else {
    Write-Host "✓ No changes in src/ detected. Skipping clasp push." -ForegroundColor Gray
}
Write-Host ""

# --- [2/5] ローカル変更のコミット (Git Commit) ---
Write-Host "[2/5] Committing local changes..." -ForegroundColor Yellow
$appChanges = git status --porcelain
if ($appChanges) {
    Write-Host "✓ Detected local changes. Committing to ensure clean rebase..." -ForegroundColor Gray
    git add .
    # ユーザー指定のメッセージがない場合は自動生成
    $commitMsg = if ($message -eq "automated sync update") { "Sync: App update and data refresh [$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))]" } else { $message }
    git commit -m $commitMsg -q
    Write-Host "✓ Local changes committed." -ForegroundColor Green
} else {
    Write-Host "✓ No local changes to commit." -ForegroundColor Gray
}
Write-Host ""

# --- [3/5] GAS 関数の実行 (最新データ生成) ---
Write-Host "[3/5] Triggering GAS function (exportAllDataToJson)..." -ForegroundColor Yellow
Write-Host "This will update data files and dic.html on GitHub..." -ForegroundColor Gray

# clasp run を実行（エラー出力をキャプチャ）
$runOutput = clasp run exportAllDataToJson 2>&1
$runExitCode = $LASTEXITCODE

if ($runExitCode -ne 0) {
    # 権限エラーまたは関数が見つからないエラーを検出
    if ($runOutput -match "permission|unauthorized|credentials|not logged in") {
        Write-Host ""
        Write-Warning "⚠ Authentication error detected. Please re-login to clasp."
        Write-Host ""
        Write-Host "Run the following commands:" -ForegroundColor Cyan
        Write-Host "  1. clasp logout" -ForegroundColor White
        Write-Host "  2. clasp login" -ForegroundColor White
        Write-Host "  3. .\sync-data.ps1" -ForegroundColor White
        Write-Host ""
        exit 1
    }
    if ($runOutput -match "Script function not found") {
        Write-Host ""
        Write-Warning "⚠ Function not found. This may be due to Apps Script API not being enabled."
        Write-Host ""
        Write-Host "To fix this issue:" -ForegroundColor Cyan
        Write-Host "  1. Open the GAS editor: https://script.google.com" -ForegroundColor White
        Write-Host "  2. Manually execute 'exportAllDataToJson' function once" -ForegroundColor White
        Write-Host "  3. Then run: git pull" -ForegroundColor White
        Write-Host ""
        Write-Host "Alternatively, check that appsscript.json has 'executionApi' configured." -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
    Write-Error "❌ clasp run failed. Make sure you are logged in with 'clasp login' and Apps Script API is enabled."
    exit 1
}
Write-Host "✓ GAS function executed successfully. Files pushed to GitHub." -ForegroundColor Green
Write-Host ""

# --- [4/5] 最新データのローカル同期 (git pull) ---
Write-Host "[4/5] Pulling latest data from GitHub..." -ForegroundColor Yellow
git pull --rebase
if ($LASTEXITCODE -ne 0) {
    Write-Warning "⚠ git pull failed or has conflicts. Please resolve manually."
    exit 1
}
Write-Host "✓ Local repository is now up to date." -ForegroundColor Green
Write-Host ""

# --- [5/5] 全ての変更を GitHub に公開 (git push) ---
Write-Host "[5/5] Pushing all changes to GitHub..." -ForegroundColor Yellow
Write-Host "Pushing to GitHub..." -ForegroundColor Gray
git push
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ git push failed."
    exit 1
}
Write-Host "✓ All changes published to GitHub Pages!" -ForegroundColor Green

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✓ COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "App and Data are now synchronized." -ForegroundColor White
Write-Host "Check the live site in a few minutes:" -ForegroundColor Gray
Write-Host "https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/home.html" -ForegroundColor Blue
Write-Host ""
