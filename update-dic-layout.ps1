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
Write-Host "[0/5] Checking for local changes..." -ForegroundColor Yellow
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
Write-Host "[1/5] Uploading to GAS..." -ForegroundColor Yellow
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

# ステップ 1.5: デプロイメントの更新 (重要: exec URLの場合、デプロイ更新が必要)
Write-Host "[1.5/5] Updating Web App deployment..." -ForegroundColor Yellow
$deploymentId = $null
    if ($DEPLOY_URL -match '/s/([^/]+)/exec') {
        $deploymentId = $matches[1]
        Write-Host "Detected Deployment ID from URL: $deploymentId" -ForegroundColor Gray
    } else {
        Write-Warning "URL does not match standard /exec pattern. Checking for /dev or other formats..."
        if ($DEPLOY_URL -match '/s/([^/]+)/') {
             $possibleId = $matches[1]
             Write-Host "Potential ID found: $possibleId" -ForegroundColor Gray
             # /devの場合はデプロイ更新不要だが、execの場合は必要。念のため警告を出す。
             if ($DEPLOY_URL -like "*/dev*") {
                 Write-Host "Using /dev URL. Skipping deployment update." -ForegroundColor Gray
             } else {
                 $deploymentId = $possibleId
                 Write-Host "Assuming this ID needs update." -ForegroundColor Yellow
             }
        }
    }

    if ($deploymentId) {
        # 既存のデプロイIDに対して上書きデプロイを行う
        Write-Host "Running: clasp deploy -i $deploymentId" -ForegroundColor Gray
        
        # カレントディレクトリがルートであることを確認（.clasp.jsonがある場所）
        if (-not (Test-Path ".clasp.json")) {
            Write-Warning "⚠ .clasp.json not found in current directory. Setting deployment might fail."
        }

        # エラーハンドリング付きで実行
        try {
            # 出力をキャプチャしてエラー判定
            $deployOutput = clasp deploy -i $deploymentId 2>&1
            Write-Host "$deployOutput" -ForegroundColor DarkGray
            
            if ($LASTEXITCODE -ne 0) {
                 Write-Warning "⚠ clasp deploy failed."
            } else {
                 Write-Host "✓ Deployment updated successfully" -ForegroundColor Green
                 # デプロイ反映待ち
                 Start-Sleep -Seconds 5
            }
        } catch {
            Write-Warning "⚠ Exception during clasp deploy: $_"
        }
    } else {
        if (-not ($DEPLOY_URL -like "*/dev*")) {
             Write-Warning "⚠ Could not extract Deployment ID from URL. Skipping deployment update."
        }
    }
    Write-Host ""

# ステップ 2: Web App 経由で GAS 関数を実行
Write-Host "[2/5] Triggering GAS function via Web App..." -ForegroundColor Yellow
try {
    $url = "${DEPLOY_URL}?token=${SECRET_TOKEN}&action=exportDic"
    Write-Host "Calling URL: $url" -ForegroundColor DarkGray
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
    $result = $null
    
    # 200 OKでもHTMLが返ってくる場合があるのでチェック
    if ($response.ContentType -notmatch "application/json" -and $response.Content -notmatch "^{.*}$") {
         Write-Error "❌ Invalid response format. Expected JSON but got content type: $($response.ContentType)"
         Write-Host "Response preview (first 200 chars):" -ForegroundColor Gray
         Write-Host $response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)) -ForegroundColor Gray
         Write-Host ""
         Write-Host "Possible causes:" -ForegroundColor Yellow
         Write-Host "1. Web App permissions are not set to 'Anyone'" -ForegroundColor White
         Write-Host "2. Script error formatting (returning HTML error page)" -ForegroundColor White
         exit 1
    }

    try {
        $result = $response.Content | ConvertFrom-Json
    } catch {
         Write-Error "❌ JSON Parsing Failed. Response was not valid JSON."
         Write-Host "Response content:" -ForegroundColor Gray
         Write-Host $response.Content -ForegroundColor Gray
         exit 1
    }
    
    if ($result.success) {
        Write-Host "✓ dic.html exported successfully" -ForegroundColor Green
        Write-Host "  Timestamp: $($result.timestamp)" -ForegroundColor Gray
    } else {
        Write-Error "❌ GAS execution failed: $($result.error)"
        exit 1
    }
} catch {
    Write-Error "❌ Failed to call Web App: $_"
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        # レスポンス本文を読む
        $reader = New-Object System.IO.StreamReader $_.Exception.Response.GetResponseStream()
        $respBody = $reader.ReadToEnd()
        Write-Host "Response Body Preview:" -ForegroundColor Gray
        Write-Host $respBody.Substring(0, [Math]::Min(500, $respBody.Length)) -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check that GAS_DEPLOY_URL is correct" -ForegroundColor White 
    Write-Host "2. Check that GAS_SECRET_TOKEN matches the token in web_trigger.js" -ForegroundColor White
    Write-Host "3. Verify the Web App is deployed as 'Me' and accessible by 'Anyone'" -ForegroundColor White
    exit 1
}
Write-Host ""

# ステップ 3: GitHub から最新の dic.html を取得
Write-Host "[3/6] Getting latest dic.html from GitHub..." -ForegroundColor Yellow
git pull --rebase
if ($LASTEXITCODE -ne 0) {
    Write-Warning "⚠ git pull had issues, but continuing..."
} else {
    Write-Host "✓ git pull complete" -ForegroundColor Green
}
Write-Host ""

# ステップ 3.5: dic.htmlのCSS検証
Write-Host "[3.5/6] Verifying CSS in dic.html..." -ForegroundColor Yellow
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
Write-Host "[4/6] Committing other changes..." -ForegroundColor Yellow
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
