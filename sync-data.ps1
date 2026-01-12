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

# --- [0.1] Git状態チェック ---
Write-Host "Checking git status..." -ForegroundColor Gray
$currentBranch = git branch --show-current
if (-not $currentBranch) {
    Write-Error "❌ Error: Git is in a detached HEAD state (e.g., rebase in progress)."
    Write-Host "Please run 'git status' and resolve the current state (e.g., git rebase --abort) before running this script." -ForegroundColor Yellow
    exit 1
}

if ($currentBranch -ne "main") {
    Write-Host "⚠ Currently on branch '$currentBranch'." -ForegroundColor Yellow
    $status = git status --porcelain

    if ($status) {
        Write-Host "Uncommitted changes detected." -ForegroundColor Yellow
        $resp = Read-Host "Do you want to COMMIT these changes and MERGE '$currentBranch' into 'main'? (Y/N)"
        
        if ($resp -match "^[Yy]") {
            Write-Host "Committing changes..." -ForegroundColor Gray
            git add .
            git commit -m "Auto-commit/merge via sync-data from $currentBranch"
            
            Write-Host "Switching to main and merging..." -ForegroundColor Gray
            git checkout main
            git merge $currentBranch
            if ($LASTEXITCODE -ne 0) {
                Write-Error "❌ Merge failed (Conflict?). Please resolve manually."
                exit 1
            }
        } else {
             $stashResp = Read-Host "Do you want to STASH changes and switch to main? (Y/N)"
             if ($stashResp -match "^[Yy]") {
                 Write-Host "Stashing changes..." -ForegroundColor Gray
                 git stash push -u -m "Auto-stash by sync-data"
                 git checkout main
             } else {
                 Write-Error "❌ Aborted. Please handle uncommitted changes manually."
                 exit 1
             }
        }
    } else {
        # Clean state
        $resp = Read-Host "Do you want to MERGE '$currentBranch' into 'main'? (Y=Merge, N=Just Switch)"
        if ($resp -match "^[Yy]") {
            Write-Host "Switching to main and merging..." -ForegroundColor Gray
            git checkout main
            git merge $currentBranch
        } else {
            Write-Host "Switching to main..." -ForegroundColor Gray
            git checkout main
        }
    }

    # Ensure we are on main now
    $newBranch = git branch --show-current
    if ($newBranch -ne "main") {
         Write-Error "❌ Failed to switch to main branch."
         exit 1
    }
    Write-Host "✓ Switched to main." -ForegroundColor Green
}

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
    # Debug: Show loaded env vars (masked for security)
    if ($env:GAS_DEPLOY_URL) {
        Write-Host "  GAS_DEPLOY_URL loaded (length: $($env:GAS_DEPLOY_URL.Length))" -ForegroundColor DarkGray
    }
    if ($env:GAS_SECRET_TOKEN) {
        Write-Host "  GAS_SECRET_TOKEN loaded (length: $($env:GAS_SECRET_TOKEN.Length))" -ForegroundColor DarkGray
    }
}

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
        if ($pushOutput -match "permission|unauthorized|credentials|not logged in|Insufficient") {
            Write-Host ""
            Write-Error "❌ clasp push failed: Authentication error detected."
            Write-Host "Your Google Apps Script credentials have expired or are missing." -ForegroundColor Yellow
            Write-Host "Code changes in 'src/' cannot be uploaded without logging in." -ForegroundColor Yellow
            Write-Host ""

            # ユーザーにログインを促す
            $loginChoice = Read-Host "Do you want to run 'clasp login' now? (Y to login, N to abort)"
            if ($loginChoice -match "^[Yy]") {
                Write-Host "Running 'clasp login'... (A browser tab will open)" -ForegroundColor Cyan
                clasp login
                
                Write-Host "Retrying clasp push..." -ForegroundColor Cyan
                # 再試行
                $pushOutput = clasp push -f 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✓ GAS source updated successfully (Retry)." -ForegroundColor Green
                    Pop-Location
                } else {
                    Write-Error "❌ clasp push failed again."
                    Write-Host "Error output: $($pushOutput | Out-String)" -ForegroundColor DarkGray
                    Pop-Location
                    exit 1
                }
            } else {
                Write-Host "Aborted. Please run 'cd src; clasp login' manually." -ForegroundColor Red
                Pop-Location
                exit 1
            }
        } else {
            # 認証以外のエラー
            Write-Host ""
            Write-Warning "⚠ clasp push failed with an unexpected error."
            Write-Host "Error output: $($pushOutput | Out-String)" -ForegroundColor DarkGray
            Write-Host ""
            Write-Host "Continuing with Web App execution..." -ForegroundColor Gray
            Pop-Location
        }
    } else {
        # ★★★ Deploymentの自動更新 (Auto-Deploy) ★★★
        Write-Host "Updating Web App deployment..." -ForegroundColor Cyan
        try {
            cmd /c "node manage_deploy.js"
            cmd /c "node update_env.js"
        } catch {
            Write-Warning "Failed to update deployment: $_"
        }

        Pop-Location
        Write-Host "✓ GAS source updated successfully." -ForegroundColor Green
    }
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
Write-Host ""

# 実行時間計測開始
$startTime = Get-Date

# clasp run を実行（エラー出力をキャプチャ）
Write-Host "Attempting clasp run..." -ForegroundColor Gray
$runOutput = clasp run exportAllDataToJson 2>&1
$runExitCode = $LASTEXITCODE

# clasp runは失敗しても Exit code 0 を返すことがあるため、出力テキストもチェック
$runFailed = ($runExitCode -ne 0) -or ($runOutput -match "Unable to run|function not found|Script function not found")

if ($runFailed) {
    Write-Host "✗ clasp run failed or unavailable (exit code: $runExitCode)" -ForegroundColor Yellow
    
    # 認証エラーチェックと再ログイン
    if ($runOutput -match "permission|unauthorized|credentials|not logged in|Insufficient") {
        Write-Host ""
        Write-Host "⚠ clasp run failed due to authentication error." -ForegroundColor Yellow
        
        $loginChoice = Read-Host "Do you want to run 'clasp login' now? (Y to login, N to verify Web App fallback)"
        if ($loginChoice -match "^[Yy]") {
            Push-Location "src"
            Write-Host "Running 'clasp login'... (A browser tab will open)" -ForegroundColor Cyan
            clasp login
            Pop-Location
            
            Write-Host "Retrying clasp run..." -ForegroundColor Cyan
            $runOutput = clasp run exportAllDataToJson 2>&1
            $runExitCode = $LASTEXITCODE
            $runFailed = ($runExitCode -ne 0) -or ($runOutput -match "Unable to run|function not found|Script function not found")
            
            if (-not $runFailed) {
                Write-Host "✓ GAS function executed successfully (Retry)." -ForegroundColor Green
            }
        }
    }

    if ($runFailed) {
        # clasp runの出力を表示（デバッグ用）
        if ($runOutput) {
            Write-Host "clasp run output:" -ForegroundColor DarkGray
            Write-Host ($runOutput | Out-String) -ForegroundColor DarkGray
        }

        # Web App経由で実行を試みる
        
        # Web App経由で実行を試みる
        Write-Host ""
        Write-Host "→ Falling back to Web App method..." -ForegroundColor Yellow
    
    # ★★★ Deploymentの自動更新 (Auto-Deploy) - フォールバック時にも念のため実施 ★★★
    Write-Host "Updating Web App deployment to ensure latest code is used..." -ForegroundColor Cyan
    Push-Location "src"
    try {
        # nodeコマンドの出力を表示しながら実行
        cmd /c "node manage_deploy.js"
        cmd /c "node update_env.js"
    } catch {
        Write-Warning "Failed to update deployment: $_"
    } finally {
        Pop-Location
    }
    
    # .envの再読み込み (新しいURLを反映するため)
    if (Test-Path ".env") {
        Write-Host "Reloading .env..." -ForegroundColor Gray
        Get-Content .env | ForEach-Object {
            if ($_ -match "^\s*([^#\s][^=]*)\s*=\s*(.*)$") {
                Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
            }
        }
    }

    Write-Host ""
    
    # Web App環境変数をチェック
    if ($env:GAS_DEPLOY_URL -and $env:GAS_SECRET_TOKEN) {
        $urlDisplay = if ($env:GAS_DEPLOY_URL.Length -gt 60) { $env:GAS_DEPLOY_URL.Substring(0, 60) + "..." } else { $env:GAS_DEPLOY_URL }
        Write-Host "Using Web App endpoint: $urlDisplay" -ForegroundColor Gray
        
        try {
            $webStartTime = Get-Date
            
            # Using curl.exe as requested for robust parameter handling
            $webAction = "exportAllDataToJson"
            $baseUrl = $env:GAS_DEPLOY_URL.Trim()
            $tokenParam = $env:GAS_SECRET_TOKEN.Trim()
            $webUrl = "${baseUrl}?action=${webAction}&token=${tokenParam}"
            
            Write-Host "Sending request to Web App..." -ForegroundColor Gray
            Write-Host "URL: $($baseUrl.Substring(0, [math]::Min(60, $baseUrl.Length)))..." -ForegroundColor DarkGray
            
            # Use curl.exe with explicit quoting to handle URL parameters correctly
            # -L: Follow redirects, -s: Silent
            $curlOutputLines = & curl.exe -s -L "$webUrl"
            $curlOutput = $curlOutputLines -join "`n"
            
            # Save response for debugging
            $curlOutput | Out-File -FilePath "webapp_response.txt" -Encoding UTF8
            
            $webDuration = (Get-Date) - $webStartTime
            
            # Check if output looks like success JSON
            if ($curlOutput -match '"status":\s*"success"') {
                Write-Host "✓ GAS function executed successfully via Web App." -ForegroundColor Green
                Write-Host "  Execution time: $([math]::Round($webDuration.TotalSeconds, 1)) seconds" -ForegroundColor Gray
            } else {
                Write-Host ""
                Write-Error "❌ Web App execution failed or returned unexpected format."
                $outputSummary = if ($curlOutput -and $curlOutput.Length -gt 0) { 
                    $curlOutput.Substring(0, [math]::Min(500, $curlOutput.Length)) 
                } else { 
                    "(empty response)" 
                }
                Write-Host "Output summary: $outputSummary" -ForegroundColor DarkGray
                Write-Host "Full response saved to: webapp_response.txt" -ForegroundColor Gray
                Write-Host ""
                Write-Host "Please check the following:" -ForegroundColor Yellow
                Write-Host "  1. Web App deployment is up to date" -ForegroundColor White
                Write-Host "  2. GAS_DEPLOY_URL and GAS_SECRET_TOKEN are correct in .env" -ForegroundColor White
                Write-Host "  3. Web App is deployed with 'Anyone' access" -ForegroundColor White
                Write-Host ""
                Write-Host "Or try manual execution:" -ForegroundColor Yellow
                Write-Host "  1. Open GAS editor: https://script.google.com" -ForegroundColor White
                Write-Host "  2. Run 'exportAllDataToJson' function" -ForegroundColor White
                Write-Host "  3. Then run: git pull" -ForegroundColor White
                Write-Host ""
                exit 1
            }
        } catch {
            Write-Host "" 
            Write-Error "❌ Web App request failed: $($_.Exception.Message)"
            Write-Host "Error details: $($_.Exception.GetType().FullName)" -ForegroundColor DarkGray
            if ($_.Exception.Response) {
                Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor DarkGray
            }
            Write-Host ""
            Write-Host "Please try manual execution:" -ForegroundColor Yellow
            Write-Host "  1. Open GAS editor: https://script.google.com" -ForegroundColor White
            Write-Host "  2. Run 'exportAllDataToJson' function" -ForegroundColor White
            Write-Host "  3. Then run: git pull" -ForegroundColor White
            Write-Host ""
            exit 1
        }
    } else {
        # Web App未設定の場合
        Write-Host ""
        Write-Warning "⚠ Web App is not configured. clasp run requires Apps Script API."
        Write-Host ""
        Write-Host "To fix this issue:" -ForegroundColor Cyan
        Write-Host "  Option 1: Enable Apps Script API" -ForegroundColor White
        Write-Host "    • Visit: https://script.google.com/home/usersettings" -ForegroundColor Gray
        Write-Host "    • Enable 'Google Apps Script API'" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  Option 2: Setup Web App (recommended)" -ForegroundColor White
        Write-Host "    • Run: .\setup-web-trigger.ps1" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  Option 3: Manual execution" -ForegroundColor White
        Write-Host "    1. Open GAS editor: https://script.google.com" -ForegroundColor Gray
        Write-Host "    2. Run 'exportAllDataToJson' function" -ForegroundColor Gray
        Write-Host "    3. Then run: git pull" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
    }
} else {
    $duration = (Get-Date) - $startTime
    Write-Host "✓ GAS function executed successfully via clasp run." -ForegroundColor Green
    Write-Host "  Execution time: $([math]::Round($duration.TotalSeconds, 1)) seconds" -ForegroundColor Gray
}

Write-Host "✓ GAS function completed. Files should be pushed to GitHub." -ForegroundColor Green
Write-Host ""

# --- [3.5/5] 中間コミット (Intermediate Commit) ---
# Step 3 (Web Appフォールバック) で app.js 等が更新された場合、git pull --rebase が失敗するため、ここでコミットする
$localStatusStart = git status --porcelain
if ($localStatusStart) {
    Write-Host "[3.5/5] Committing app.js updates..." -ForegroundColor Cyan
    git add .
    git commit -m "Update Web App URL in app.js (Auto-sync)"
    Write-Host "✓ Local changes committed." -ForegroundColor Green
    Write-Host ""
}

# --- [4/5] 最新データのローカル同期 (git pull) ---
Write-Host "[4/5] Pulling latest data from GitHub..." -ForegroundColor Yellow

# GASからのGitHubプッシュが完了するまで少し待機
Write-Host "Waiting for GAS to push data to GitHub (15s)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# git pullを実行（出力をキャプチャ）
$pullOutput = git pull --rebase 2>&1
$pullExitCode = $LASTEXITCODE

if ($pullExitCode -ne 0) {
    Write-Host ""
    Write-Warning "⚠ git pull failed."
    Write-Host "Pull output:" -ForegroundColor DarkGray
    Write-Host ($pullOutput | Out-String) -ForegroundColor DarkGray
    Write-Host ""
    
    # コンフリクトかその他のエラーかを判定
    if ($pullOutput -match "conflict|CONFLICT") {
        Write-Host "Conflict detected. Attempting to resolve..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "To resolve manually:" -ForegroundColor Cyan
        Write-Host "  1. git status  # Check conflicts" -ForegroundColor White
        Write-Host "  2. git checkout --theirs <file>  # Accept GitHub version" -ForegroundColor White
        Write-Host "  3. git rebase --continue" -ForegroundColor White
        Write-Host ""
        exit 1
    } else {
        # その他のエラー: リトライ
        Write-Host "Retrying pull in 5 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        
        $pullOutput2 = git pull --rebase 2>&1
        $pullExitCode2 = $LASTEXITCODE
        
        if ($pullExitCode2 -ne 0) {
            Write-Error "❌ git pull failed after retry."
            Write-Host "Pull output:" -ForegroundColor DarkGray
            Write-Host ($pullOutput2 | Out-String) -ForegroundColor DarkGray
            Write-Host ""
            Write-Host "Please run manually: git pull --rebase" -ForegroundColor Yellow
            exit 1
        } else {
            Write-Host "✓ Pull succeeded on retry." -ForegroundColor Green
        }
    }
} else {
    # git pullの詳細を表示
    if ($pullOutput -match "Fast-forward|Updating|Already up to date") {
        Write-Host "✓ Local repository is now up to date." -ForegroundColor Green
        
        # 更新されたファイルを表示（情報提供）
        if ($pullOutput -match "mahler-search-app/dic.html") {
            Write-Host "  • dic.html updated from GitHub" -ForegroundColor Gray
        }
        if ($pullOutput -match "mahler-search-app/data/") {
            Write-Host "  • Data files updated from GitHub" -ForegroundColor Gray
        }
    } else {
        Write-Host "✓ Local repository is now up to date." -ForegroundColor Green
    }
}
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
