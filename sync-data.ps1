param([string]$message = "自動同期アップデート")

$dashboardApiCheckScript = Join-Path $PSScriptRoot "scripts/dashboard-api-check.ps1"
if (-not (Test-Path -LiteralPath $dashboardApiCheckScript)) {
    throw "ダッシュボード API チェックヘルパーが見つかりません: $dashboardApiCheckScript"
}
. $dashboardApiCheckScript

$generatedOutputPaths = @(
    "mahler-search-app/dic.html",
    "mahler-search-app/data/"
)

$syncAllowedExactPaths = @(
    ".claspignore",
    ".gitignore",
    "_config.yml",
    "01_START_SUCCESSOR_SETUP.bat",
    "02_RUN_SYNC.bat",
    "ADMIN_DASHBOARD_API_SPEC.md",
    "ADMIN_DASHBOARD_TASKS.md",
    "CHANGELOG.md",
    "GA4_EVENT_SPEC.md",
    "apple-touch-icon.png",
    "favicon.png",
    "favicon_original.png",
    "google34b939d4db375916.html",
    "index.html",
    "LICENSE",
    "ogp.png",
    "README.md",
    "robots.txt",
    "sitemap.xml",
    "sync-data.ps1"
)

$syncAllowedPathPrefixes = @(
    ".agent/workflows/",
    "mahler-search-app/",
    "manuals/",
    "scripts/",
    "src/"
)

function Get-ChangedPathFromStatusLine {
    param([string]$StatusLine)

    if (-not $StatusLine -or $StatusLine.Length -lt 4) { return $null }
    $path = $StatusLine.Substring(3).Trim()
    if ($path -match " -> ") {
        $path = ($path -split " -> ", 2)[1]
    }
    return $path.Trim('"').Replace("\", "/")
}

function Test-IsGeneratedOutputPath {
    param([string]$Path)

    return (
        $Path -eq "mahler-search-app/dic.html" -or
        $Path -eq "mahler-search-app/data" -or
        $Path.StartsWith("mahler-search-app/data/")
    )
}

function Test-IsAllowedSyncSourcePath {
    param([string]$Path)

    if ($syncAllowedExactPaths -contains $Path) { return $true }
    foreach ($prefix in $syncAllowedPathPrefixes) {
        if ($Path.StartsWith($prefix)) { return $true }
    }
    return $false
}

function Get-ApprovedSyncSourcePaths {
    $changedPaths = @(
        git status --porcelain | ForEach-Object {
            Get-ChangedPathFromStatusLine -StatusLine $_
        } | Where-Object { $_ } | Sort-Object -Unique
    )

    $unexpectedPaths = @(
        $changedPaths | Where-Object {
            -not (Test-IsGeneratedOutputPath -Path $_) -and
            -not (Test-IsAllowedSyncSourcePath -Path $_)
        }
    )
    if ($unexpectedPaths.Count -gt 0) {
        $details = $unexpectedPaths -join ", "
        throw "許可リスト外のファイルの変更が検出されました: $details"
    }

    return @(
        $changedPaths | Where-Object {
            -not (Test-IsGeneratedOutputPath -Path $_)
        }
    )
}

function Add-ApprovedSyncSourceChanges {
    $sourcePaths = @(Get-ApprovedSyncSourcePaths)
    if ($sourcePaths.Count -eq 0) { return }

    Write-Host "許可されたソースパスのみをステージング中:" -ForegroundColor Gray
    $sourcePaths | ForEach-Object {
        Write-Host "  - $_" -ForegroundColor DarkGray
    }
    git add -- $sourcePaths
    if ($LASTEXITCODE -ne 0) {
        throw "許可されたソース変更のステージングに失敗しました。"
    }
}

function Invoke-NodeScriptStrict {
    param([string]$ScriptPath)

    & node $ScriptPath
    if ($LASTEXITCODE -ne 0) {
        throw "$ScriptPath が終了コード $LASTEXITCODE で失敗しました。"
    }
}

function Get-GitHubRepoSlug {
    $remoteUrl = git remote get-url origin 2>$null
    if (-not $remoteUrl) { return $null }

    if ($remoteUrl -match "github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)(?:\.git)?$") {
        $owner = $matches['owner']
        $repo = $matches['repo']
        return "$owner/$repo"
    }

    return $null
}

function Wait-GitHubPagesChecks {
    param(
        [string]$RepoSlug,
        [string]$CommitSha,
        [int]$TimeoutSeconds = 30
    )

    if (-not $RepoSlug -or -not $CommitSha) { return }

    Write-Host "GitHub Pages の中間チェック状態を確認中..." -ForegroundColor Gray
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $apiUrl = "https://api.github.com/repos/$RepoSlug/commits/$CommitSha/check-runs"

    $headers = @{ Accept = "application/vnd.github+json" }
    if ($env:GH_TOKEN) { $headers["Authorization"] = "Bearer $env:GH_TOKEN" }
    elseif ($env:GITHUB_TOKEN) { $headers["Authorization"] = "Bearer $env:GITHUB_TOKEN" }

    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-RestMethod -Headers $headers -Uri $apiUrl
            $checks = @($response.check_runs | Where-Object {
                    $_.app.slug -eq "github-actions" -and
                    ($_.name -eq "build" -or $_.name -eq "deploy" -or $_.name -eq "report-build-status")
                })

            if ($checks.Count -gt 0 -and -not ($checks | Where-Object { $_.status -ne "completed" })) {
                Write-Host "[OK] GitHub Pages の中間チェックが完了しました。" -ForegroundColor Green
                return
            }
        }
        catch {
            Write-Host "GitHub Pages チェックの照会に失敗しました。プッシュを継続します。" -ForegroundColor Gray
            return
        }

        Start-Sleep -Seconds 3
    }

    Write-Host "GitHub Pages チェックがバックグラウンドで実行中です。最終プッシュを継続します。" -ForegroundColor Gray
}

# ========================================
# 統合データ同期・出力スクリプト (Enhanced v5)
# ========================================
# 
# 用途: ローカルの変更 (HTML/JS/GAS) を GAS と GitHub に同期し、
#       最新のデータを生成して GitHub Pages に反映させます。
#
# 実行順序:
#   [1/8] 前準備：環境設定と Git 状態の確認 (.env のロード / ブランチ確認)
#   [2/8] GAS ソースコードのアップロード (clasp push & デプロイ設定更新)
#   [3/8] ローカル変更のコミット (Git commit)
#   [4/8] GAS による最新データ生成処理の実行 (exportAllDataToJson)
#   [5/8] Web App 設定更新のコミット (app.js の変更コミット)
#   [6/8] 最新データのローカル同期 (git pull --rebase)
#   [7/8] sitemap.xml の自動更新とコミット
#   [8/8] GitHub への公開とダッシュボード API 検証 (git push & Dashboard API check)
# ========================================

Write-Host "================================" -ForegroundColor Cyan
Write-Host "統合データ同期・出力スクリプト" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Node.js接続エラー対策: IPv4を優先
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"

# --- [1/8] 前準備：環境設定と Git 状態の確認 ---
Write-Host "[1/8] 前準備：環境設定と Git 状態を確認中..." -ForegroundColor Yellow

$currentBranch = git branch --show-current
if (-not $currentBranch) {
    Write-Error "[エラー] Git が detached HEAD 状態です (rebase 実行中の可能性があります)。"
    Write-Host "'git status' を実行し、現在の状態を解消 (例: git rebase --abort) してから再実行してください。" -ForegroundColor Yellow
    exit 1
}

if ($currentBranch -ne "main") {
    Write-Host "[警告] 現在のブランチは '$currentBranch' です。" -ForegroundColor Yellow
    $status = git status --porcelain

    if ($status) {
        $branchGeneratedChanges = git status --porcelain -- $generatedOutputPaths
        if ($branchGeneratedChanges) {
            Write-Error "[エラー] main 以外のブランチで生成ファイルが変更されています。マージ前に中止します。"
            Write-Host ($branchGeneratedChanges | Out-String) -ForegroundColor DarkGray
            exit 1
        }

        Write-Host "未コミットの変更が検出されました。" -ForegroundColor Yellow
        $resp = Read-Host "これらの変更をコミットし、'$currentBranch' を 'main' にマージしますか？ (Y/N)"
        
        if ($resp -match "^[Yy]") {
            Write-Host "変更をコミット中..." -ForegroundColor Gray
            try {
                Add-ApprovedSyncSourceChanges
            }
            catch {
                Write-Error "[エラー] $($_.Exception.Message)"
                exit 1
            }
            git commit -m "sync-data による $currentBranch からの自動コミット/マージ"
            if ($LASTEXITCODE -ne 0) {
                Write-Error "[エラー] ブランチ変更のコミットに失敗しました。"
                exit 1
            }
            
            Write-Host "main ブランチに切り替えてマージ中..." -ForegroundColor Gray
            git checkout main
            git merge $currentBranch
            if ($LASTEXITCODE -ne 0) {
                Write-Error "[エラー] マージに失敗しました (競合が発生した可能性があります)。手動で解決してください。"
                exit 1
            }
        }
        else {
            $stashResp = Read-Host "変更を退避 (stash) して main ブランチに切り替えますか？ (Y/N)"
            if ($stashResp -match "^[Yy]") {
                Write-Host "変更を退避中..." -ForegroundColor Gray
                git stash push -u -m "sync-data による自動退避"
                git checkout main
            }
            else {
                Write-Error "[エラー] 中止しました。未コミットの変更を手動で処理してください。"
                exit 1
            }
        }
    }
    else {
        # Clean state
        $resp = Read-Host "'$currentBranch' を 'main' にマージしますか？ (Y=マージする, N=切替のみ)"
        if ($resp -match "^[Yy]") {
            Write-Host "main ブランチに切り替えてマージ中..." -ForegroundColor Gray
            git checkout main
            git merge $currentBranch
        }
        else {
            Write-Host "main ブランチに切り替え中..." -ForegroundColor Gray
            git checkout main
        }
    }

    # Ensure we are on main now
    $newBranch = git branch --show-current
    if ($newBranch -ne "main") {
        Write-Error "[エラー] main ブランチへの切り替えに失敗しました。"
        exit 1
    }
    Write-Host "[OK] main ブランチに切り替えました。" -ForegroundColor Green
}

# --- .env のロード ---
if (Test-Path ".env") {
    Write-Host ".env ファイルを読み込んでいます..." -ForegroundColor Gray
    Get-Content .env | ForEach-Object {
        if ($_ -match "^\s*([^#\s][^=]*)\s*=\s*(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
    if ($env:GAS_DEPLOY_URL) {
        Write-Host "  GAS_DEPLOY_URL を読み込みました (文字数: $($env:GAS_DEPLOY_URL.Length))" -ForegroundColor DarkGray
    }
    if ($env:GAS_SECRET_TOKEN) {
        Write-Host "  GAS_SECRET_TOKEN を読み込みました (文字数: $($env:GAS_SECRET_TOKEN.Length))" -ForegroundColor DarkGray
    }
}
Write-Host ""

# --- [2/8] GAS ソースコードのアップロード (clasp push) ---
Write-Host "[2/8] GASソースコードをアップロード中 (clasp push)..." -ForegroundColor Yellow

# Gitのステータスにかかわらず、常にアップロードを試行して整合性を保つ
Write-Host "GASソースコード (src/) の変更チェックを強制実行中..." -ForegroundColor Gray
$gasChanges = $true 

Write-Host "clasp push を実行中..." -ForegroundColor Gray
Push-Location "src"

# clasp push を実行（エラー出力をキャプチャ）
$pushOutput = clasp push -f 2>&1
$pushExitCode = $LASTEXITCODE

if ($pushExitCode -ne 0) {
    # "No valid files to push" は実質的な成功（変更なし）とみなす
    if ($pushOutput -match "No valid files to push") {
        Write-Host "[OK] GASへアップロードする変更はありません。" -ForegroundColor Green
    }
    else {
        # 変更があるのに失敗した場合、または予期せぬエラー
        if ($gasChanges) {
            Write-Host ""
            Write-Error "[エラー] 致命的: GASソースコードに変更が存在しますが clasp push に失敗しました。"
            Write-Host "GASコード (ロジック) を変更しましたが、アップロードできませんでした。" -ForegroundColor Red
            Write-Host "同期の不整合を防ぐため、スクリプトを中止します。" -ForegroundColor Red
            Write-Host ""
            Write-Host "エラー詳細:" -ForegroundColor DarkGray
            Write-Host ($pushOutput | Out-String) -ForegroundColor DarkGray
            Write-Host ""
            
            # 認証エラーの場合はログインを促す
            if ($pushOutput -match "permission|unauthorized|credentials|not logged in|Insufficient") {
                Write-Host "要対応: 認証に失敗しました。" -ForegroundColor Yellow
                Write-Host "今すぐログインを実行すると、アップロードを再試行して処理を再開できます。" -ForegroundColor Cyan
                $loginChoice = Read-Host "'clasp login' を実行して再開しますか？ (Y/N)"
                if ($loginChoice -match "^[Yy]") {
                    Write-Host "'clasp login' を実行中..." -ForegroundColor Cyan
                    clasp login
                    Write-Host "clasp push を再試行中..." -ForegroundColor Cyan
                    $pushOutput = clasp push -f 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "[OK] GASソースコードの更新が成功しました (再試行)。" -ForegroundColor Green
                    }
                    else {
                        Write-Error "[エラー] 再試行に失敗しました。中止します。"
                        Pop-Location
                        exit 1
                    }
                }
                else {
                    Write-Host "中止します。" -ForegroundColor Red
                    Pop-Location
                    exit 1
                }
            }
            else {
                # 認証以外のエラーで、かつ変更がある場合 -> 中止
                Pop-Location
                exit 1
            }
        }
        else {
            # 変更がない場合は警告のみで続行
            Write-Host ""
            Write-Warning "[警告] clasp push に失敗しましたが、ローカルのGAS変更は検出されませんでした。"
            Write-Host "ロジックに変更がないため、データ同期を継続します。" -ForegroundColor Gray
            Write-Host "エラー概要: $($pushOutput | Select-Object -First 1)" -ForegroundColor DarkGray
            Write-Host ""
        }
    }
}
else {
    Write-Host "[OK] GASソースコードの更新が完了しました。" -ForegroundColor Green
}

# デプロイの自動更新
Write-Host "Web App デプロイ設定を更新中..." -ForegroundColor Cyan
try {
    Invoke-NodeScriptStrict -ScriptPath "manage_deploy.js"
    Invoke-NodeScriptStrict -ScriptPath "update_env.js"
}
catch {
    Write-Error "[エラー] Web App デプロイ設定の更新に失敗しました: $($_.Exception.Message)"
    Pop-Location
    exit 1
}

Pop-Location
Write-Host ""

# --- [3/8] ローカル変更のコミット ---
Write-Host "[3/8] ローカル変更をコミット中..." -ForegroundColor Yellow
$appChanges = git status --porcelain
if ($appChanges) {
    Write-Host "[OK] ローカルの変更を検出しました。安全なリバース/マージのためコミットします..." -ForegroundColor Gray
    try {
        Add-ApprovedSyncSourceChanges
    }
    catch {
        Write-Error "[エラー] $($_.Exception.Message)"
        exit 1
    }

    # 自動生成ファイルはGASから取得するため、ローカルコミットには含めない。
    git restore --staged -- $generatedOutputPaths 2>$null
    
    # コミットすべきステージされた変更があるか確認
    $stagedChanges = git diff --name-only --cached
    if ($stagedChanges) {
        $commitMsg = if ($message -eq "自動同期アップデート" -or $message -eq "automated sync update") { "Sync: App update and data refresh [$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))]" } else { $message }
        git commit -m $commitMsg -q
        if ($LASTEXITCODE -ne 0) {
            Write-Error "[エラー] ローカルソースコードのコミットに失敗しました。GAS出力前に中止します。"
            exit 1
        }
        Write-Host "[OK] ローカルの変更をコミットしました。" -ForegroundColor Green
    }
    else {
        Write-Host "[OK] コミット対象のソースコード変更はありません (ステージングされたファイルはスキップされました)。" -ForegroundColor Gray
    }
}
else {
    Write-Host "[OK] コミット対象のローカル変更はありません。" -ForegroundColor Gray
}

# GASが同じファイルを生成してGitHubへプッシュするため、ローカル生成物をリセット
$generatedOutputChanges = git status --porcelain -- $generatedOutputPaths
if ($generatedOutputChanges) {
    Write-Host "GAS出力実行前にローカルの生成ファイルをリセット中..." -ForegroundColor Gray
    git restore --worktree -- $generatedOutputPaths
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[エラー] 生成ファイルのリセットに失敗しました。競合を回避するため中止します。"
        exit 1
    }

    $remainingGeneratedChanges = git status --porcelain -- $generatedOutputPaths
    if ($remainingGeneratedChanges) {
        Write-Error "[エラー] 未追跡または未解決の生成ファイルが残っています。GAS出力前に中止します。"
        Write-Host ($remainingGeneratedChanges | Out-String) -ForegroundColor DarkGray
        exit 1
    }
    Write-Host "[OK] ローカル生成ファイルをリセットしました（GASから最新版が提供されます）。" -ForegroundColor Green
}
Write-Host ""

# 事前に最新のリモートコミットを取得しておく
git fetch origin -q
$initialRemoteSha = git rev-parse origin/main 2>$null

# --- [4/8] GAS最新データ生成処理の実行 (exportAllDataToJson) ---
Write-Host "[4/8] GAS関数 (exportAllDataToJson) を実行中..." -ForegroundColor Yellow
Write-Host "スプレッドシートから最新データを抽出し、GitHub上のデータファイルと dic.html を更新します..." -ForegroundColor Gray
Write-Host ""

# 実行時間計測開始
$startTime = Get-Date

# clasp run を実行（エラー出力をキャプチャ）
Write-Host "clasp run によるダイレクト実行を試行中..." -ForegroundColor Gray
$runOutput = clasp run exportAllDataToJson 2>&1
$runExitCode = $LASTEXITCODE

# clasp runは失敗しても Exit code 0 を返すことがあるため、出力テキストもチェック
$runFailed = ($runExitCode -ne 0) -or ($runOutput -match "Unable to run|function not found|Script function not found")

if ($runFailed) {
    # エラーではなく「切り替え案内」としてマイルドに表示
    Write-Host "[情報] clasp run (Execution API) が利用できないため、Web App 方式に切り替えます。" -ForegroundColor Cyan
    
    # 認証切れの場合の案内
    if ($runOutput -match "unauthorized|credentials|not logged in" -or ($runOutput -match "permission" -and $runOutput -notmatch "Unable to run script function")) {
        Write-Host ""
        Write-Host "[警告] clasp run が認証エラーにより失敗しました。" -ForegroundColor Yellow
        
        $loginChoice = Read-Host "今すぐ 'clasp login' を実行しますか？ (Y: ログインする / N: Web App フォールバックを試す)"
        if ($loginChoice -match "^[Yy]") {
            Push-Location "src"
            Write-Host "'clasp login' を実行中... (ブラウザが開きます)" -ForegroundColor Cyan
            clasp login
            Pop-Location
            
            Write-Host "clasp run を再試行中..." -ForegroundColor Cyan
            $runOutput = clasp run exportAllDataToJson 2>&1
            $runExitCode = $LASTEXITCODE
            $runFailed = ($runExitCode -ne 0) -or ($runOutput -match "Unable to run|function not found|Script function not found")
            
            if (-not $runFailed) {
                Write-Host "[OK] GAS関数が正常に実行されました (再試行)。" -ForegroundColor Green
                $runFailed = $false
            }
        }
    }

    # デバッグ用に clasp run の出力を表示（控えめなグレー）
    if ($runFailed -and $runOutput) {
        Write-Host "  (参考) clasp run の出力ログ:" -ForegroundColor DarkGray
        Write-Host ($runOutput | Out-String) -ForegroundColor DarkGray
    }

    # Web App経由で実行を試みる
    if ($runFailed) {
        Write-Host "→ Web App 方式でデータ生成を実行中..." -ForegroundColor Yellow
        Write-Host "[OK] 検証済みの Web App デプロイメントを使用します。" -ForegroundColor Green
    
        # .envの再読み込み (新しいURLを反映するため)
        if (Test-Path ".env") {
            Write-Host ".env ファイルを再読み込み中..." -ForegroundColor Gray
            Get-Content .env | ForEach-Object {
                if ($_ -match "^\s*([^#\s][^=]*)\s*=\s*(.*)$") {
                    $envKey = $matches[1].Trim()
                    $envVal = $matches[2].Trim()
                    Set-Item -Path "env:$envKey" -Value $envVal
                }
            }
        }

        # Web App環境変数をチェック
        if ($env:GAS_DEPLOY_URL -and $env:GAS_SECRET_TOKEN) {
            $urlDisplay = if ($env:GAS_DEPLOY_URL.Length -gt 60) { $env:GAS_DEPLOY_URL.Substring(0, 60) + "..." } else { $env:GAS_DEPLOY_URL }
            Write-Host "使用する Web App エンドポイント: $urlDisplay" -ForegroundColor Gray
            
            try {
                $webStartTime = Get-Date
                
                $webAction = "exportAllDataToJson"
                $baseUrl = $env:GAS_DEPLOY_URL.Trim()
                $tokenParam = $env:GAS_SECRET_TOKEN.Trim()
                $webUrl = "${baseUrl}?action=${webAction}&token=${tokenParam}"
                
                Write-Host "Web App にリクエストを送信中..." -ForegroundColor Gray
                
                $webExportRetryDelays = @(0, 10, 20, 30)
                $curlOutput = ""
                for ($webAttemptIndex = 0; $webAttemptIndex -lt $webExportRetryDelays.Count; $webAttemptIndex++) {
                    $webDelaySeconds = $webExportRetryDelays[$webAttemptIndex]
                    if ($webDelaySeconds -gt 0) {
                        Write-Host "  [再試行] Web App リクエスト試行 $($webAttemptIndex + 1)/$($webExportRetryDelays.Count) ($webDelaySeconds 秒後)..." -ForegroundColor Yellow
                        Start-Sleep -Seconds $webDelaySeconds
                    }

                    $curlOutputLines = & curl.exe -s -L "$webUrl"
                    $curlOutput = $curlOutputLines -join "`n"
                    if ($curlOutput -match '"status":\s*"success"') {
                        break
                    }
                }
                
                $webDuration = (Get-Date) - $webStartTime
                
                if ($curlOutput -match '"status":\s*"success"') {
                    Write-Host "[OK] Web App 経由で GAS 関数の実行に成功しました。" -ForegroundColor Green
                    Write-Host "  実行時間: $([math]::Round($webDuration.TotalSeconds, 1)) 秒" -ForegroundColor Gray
                }
                else {
                    Write-Host ""
                    Write-Error "[エラー] Web App の実行に失敗したか、予期せぬ応答が返されました。"
                    $outputSummary = if ($curlOutput -and $curlOutput.Length -gt 0) { 
                        $curlOutput.Substring(0, [math]::Min(500, $curlOutput.Length)) 
                    }
                    else { 
                        "(空の応答)" 
                    }
                    Write-Host "応答概要: $outputSummary" -ForegroundColor DarkGray
                    Write-Host ""
                    Write-Host "以下をご確認ください:" -ForegroundColor Yellow
                    Write-Host "  1. Web App デプロイメントが最新であること" -ForegroundColor White
                    Write-Host "  2. .env 内の GAS_DEPLOY_URL と GAS_SECRET_TOKEN が正確であること" -ForegroundColor White
                    Write-Host "  3. Web App のアクセス権限が '全員' (Anyone) に設定されていること" -ForegroundColor White
                    Write-Host ""
                    exit 1
                }
            }
            catch {
                Write-Host "" 
                Write-Error "[エラー] Web App リクエストに失敗しました: $($_.Exception.Message)"
                exit 1
            }
        }
        else {
            # Web App未設定の場合
            Write-Host ""
            Write-Warning "[警告] Web App が設定されていません。"
            Write-Host ""
            Write-Host "解決方法:" -ForegroundColor Cyan
            Write-Host "  方法1: Google Apps Script API を有効化する (script.google.com/home/usersettings)" -ForegroundColor White
            Write-Host "  方法2: Web App トリガーをセットアップする (.\setup-web-trigger.ps1 を実行)" -ForegroundColor White
            Write-Host ""
            exit 1
        }
    }
}
else {
    $duration = (Get-Date) - $startTime
    Write-Host "[OK] clasp run 経由で GAS 関数を実行完了しました。" -ForegroundColor Green
    Write-Host "  実行時間: $([math]::Round($duration.TotalSeconds, 1)) 秒" -ForegroundColor Gray
}

Write-Host "[OK] GAS 関数の実行が完了しました。最新データが GitHub へプッシュされるのを確認します。" -ForegroundColor Green
Write-Host ""

# --- [5/8] Web App 設定更新のコミット ---
$autoDeployPaths = @("mahler-search-app/js/app.js")
$autoDeployChanges = git status --porcelain -- $autoDeployPaths
if ($autoDeployChanges) {
    Write-Host "[5/8] app.js の Web App URL 設定更新をコミット中..." -ForegroundColor Cyan
    git add -- $autoDeployPaths
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[エラー] app.js のステージングに失敗しました。pull 前に中止します。"
        exit 1
    }
    git commit -m "Update Web App URL in app.js (Auto-sync)"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[エラー] app.js のコミットに失敗しました。pull 前に中止します。"
        exit 1
    }
    Write-Host "[OK] app.js の変更をコミットしました。" -ForegroundColor Green
    Write-Host ""
}
else {
    Write-Host "[5/8] Web App 設定更新のコミットチェック: 変更なし" -ForegroundColor Gray
    Write-Host ""
}

# 想定外の変更が残っているかチェック
$unexpectedChanges = git status --porcelain
if ($unexpectedChanges) {
    Write-Error "[エラー] git pull --rebase 前に予期せぬローカル変更が残っています。安全のため中止します。"
    Write-Host ($unexpectedChanges | Out-String) -ForegroundColor DarkGray
    exit 1
}

# --- [6/8] GitHub からの最新データ取得 (git pull) ---
Write-Host "[6/8] GitHub から最新データを取得中 (git pull)..." -ForegroundColor Yellow

Write-Host "GAS による GitHub へのデータ出力完了を待機中 (リモートを監視中)..." -ForegroundColor Gray
$pollStartTime = Get-Date
$timeoutSeconds = 60
$gasCommitDetected = $false

while (((Get-Date) - $pollStartTime).TotalSeconds -lt $timeoutSeconds) {
    git fetch origin -q
    $currentRemoteSha = git rev-parse origin/main 2>$null
    if ($currentRemoteSha -and $currentRemoteSha -ne $initialRemoteSha) {
        $commitMsg = git log -1 --pretty=%B origin/main
        if ($commitMsg -match "自動更新|スプレッドシート|skip ci") {
            Write-Host "リモートで GAS による新しいコミットを検出しました: $currentRemoteSha" -ForegroundColor Green
            $gasCommitDetected = $true
            break
        }
    }
    Start-Sleep -Seconds 5
}

if (-not $gasCommitDetected) {
    Write-Warning "GAS コミットの待機がタイムアウトしました。そのまま pull を続行します。"
}

$beforePullHead = git rev-parse HEAD

# git pull を実行
$pullOutput = git pull --rebase 2>&1
$pullExitCode = $LASTEXITCODE

if ($pullExitCode -ne 0) {
    Write-Host ""
    Write-Warning "[警告] git pull に失敗しました。"
    Write-Host "Pull 出力:" -ForegroundColor DarkGray
    Write-Host ($pullOutput | Out-String) -ForegroundColor DarkGray
    Write-Host ""
    
    if ($pullOutput -match "conflict|CONFLICT") {
        Write-Error "[エラー] 競合 (Conflict) が検出されました。手動で解決してください。"
        exit 1
    }
    else {
        Write-Host "5秒後に pull を再試行します..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        
        $pullOutput2 = git pull --rebase 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "[エラー] 再試行後も git pull に失敗しました。手動で 'git pull --rebase' を実行してください。"
            exit 1
        }
        else {
            Write-Host "[OK] 再試行で pull が成功しました。" -ForegroundColor Green
        }
    }
}
else {
    Write-Host "[OK] ローカルリポジトリが最新の状態になりました。" -ForegroundColor Green
    if ($pullOutput -match "mahler-search-app/dic.html") {
        Write-Host "  - dic.html を GitHub から更新しました" -ForegroundColor Gray
    }
    if ($pullOutput -match "mahler-search-app/data/") {
        Write-Host "  - データファイルを GitHub から更新しました" -ForegroundColor Gray
    }
}
Write-Host ""

# 「実例を見る」専用データは exportAllDataToJson が毎回再生成する。
# pull 後に3作曲家×16ファイルが揃っていることを確認し、不完全な公開を防ぐ。
$dictionaryExampleDirectory = Join-Path $PSScriptRoot "mahler-search-app/data/dictionary-examples"
$dictionaryExampleExpectedComposers = @("gm", "rw", "rs")
$dictionaryExampleFiles = @(
    Get-ChildItem -LiteralPath $dictionaryExampleDirectory -Filter "*.json" -File -ErrorAction SilentlyContinue
)
if ($dictionaryExampleFiles.Count -ne 48) {
    Write-Error "[エラー] dictionary-example JSON は48ファイル必要ですが、$($dictionaryExampleFiles.Count)ファイルでした。"
    exit 1
}
foreach ($composer in $dictionaryExampleExpectedComposers) {
    $composerFiles = @(
        Get-ChildItem -LiteralPath $dictionaryExampleDirectory -Filter "$composer-*.json" -File -ErrorAction SilentlyContinue
    )
    if ($composerFiles.Count -ne 16) {
        Write-Error "[エラー] dictionary-example JSON ($composer) は16ファイル必要ですが、$($composerFiles.Count)ファイルでした。"
        exit 1
    }
}
Write-Host "[OK] dictionary-example JSON を確認しました（GM/RW/RS 各16、合計48ファイル）。" -ForegroundColor Green
Write-Host ""

# --- [7/8] sitemap.xml の自動更新 ---
Write-Host "[7/8] 変更されたファイルに対応する sitemap.xml を更新中..." -ForegroundColor Yellow
$pulledFiles = git diff --name-only $beforePullHead HEAD
$unpushedFiles = git diff --name-only origin/main HEAD
$changedFiles = @($pulledFiles + $unpushedFiles) | Where-Object { $_ } | Sort-Object -Unique
$today = (Get-Date).ToString("yyyy-MM-dd")
$sitemapPath = "sitemap.xml"

if (Test-Path $sitemapPath) {
    $sitemapContent = Get-Content $sitemapPath -Raw -Encoding UTF8
    $sitemapUpdated = $sitemapContent
    $hasSitemapUpdates = $false

    $pathMappings = @{
        'src/index.html'                              = @('/')
        'index.html'                                  = @('/')
        'src/mahler.html'                             = @('mahler-search-app/mahler.html')
        'src/dic.html'                                = @('mahler-search-app/dic.html')
        'src/terms_search.html'                       = @('mahler-search-app/terms_search.html')
        'src/rs_terms_search.html'                    = @('mahler-search-app/rs_terms_search.html')
        'src/rw_terms_search.html'                    = @('mahler-search-app/rw_terms_search.html')
        'src/richard_strauss.html'                    = @('mahler-search-app/richard_strauss.html')
        'src/richard_wagner.html'                     = @('mahler-search-app/richard_wagner.html')
        'src/notes.html'                              = @('mahler-search-app/notes.html')
        'src/other.html'                              = @('mahler-search-app/other.html')
        'mahler-search-app/mahler.html'               = @('mahler-search-app/mahler.html')
        'mahler-search-app/dic.html'                  = @('mahler-search-app/dic.html')
        'mahler-search-app/terms_search.html'         = @('mahler-search-app/terms_search.html')
        'mahler-search-app/rs_terms_search.html'      = @('mahler-search-app/rs_terms_search.html')
        'mahler-search-app/rw_terms_search.html'      = @('mahler-search-app/rw_terms_search.html')
        'mahler-search-app/richard_strauss.html'      = @('mahler-search-app/richard_strauss.html')
        'mahler-search-app/richard_wagner.html'       = @('mahler-search-app/richard_wagner.html')
        'mahler-search-app/rs_synopsis.html'          = @('mahler-search-app/rs_synopsis.html')
        'mahler-search-app/rw_synopsis.html'          = @('mahler-search-app/rw_synopsis.html')
        'mahler-search-app/notes.html'                = @('mahler-search-app/notes.html')
        'mahler-search-app/other.html'                = @('mahler-search-app/other.html')
        
        # JSON data files mappings
        'mahler-search-app/data/mahler.json'          = @('mahler-search-app/mahler.html', 'mahler-search-app/terms_search.html')
        'mahler-search-app/data/richard_strauss.json' = @('mahler-search-app/richard_strauss.html', 'mahler-search-app/rs_terms_search.html')
        'mahler-search-app/data/richard_wagner.json'  = @('mahler-search-app/richard_wagner.html', 'mahler-search-app/rw_terms_search.html')
        'mahler-search-app/data/rs_scenes.json'       = @('mahler-search-app/rs_synopsis.html')
        'mahler-search-app/data/rw_scenes.json'       = @('mahler-search-app/rw_synopsis.html')
        'mahler-search-app/data/dic_notes.json'       = @('mahler-search-app/dic.html')
        'mahler-search-app/data/dic_terms_index.json' = @('mahler-search-app/dic.html')
        'mahler-search-app/data/abbr_list.json'       = @('mahler-search-app/dic.html')
    }

    foreach ($file in $changedFiles) {
        if ($file -match "\.(html|json)$") {
            $targetPaths = if ($pathMappings.ContainsKey($file)) { $pathMappings[$file] } else { @($file.Replace("\", "/")) }
            foreach ($targetPath in $targetPaths) {
                if ($targetPath -eq '/') {
                    $escapedFile = '/'
                }
                else {
                    $escapedFile = [regex]::Escape($targetPath)
                }
                $pattern = "(?i)(<loc>[^<]*?$escapedFile</loc>\s*<lastmod>)\d{4}-\d{2}-\d{2}(</lastmod>)"
                
                if ($sitemapUpdated -match $pattern) {
                    $sitemapUpdated = $sitemapUpdated -replace $pattern, "`${1}$today`${2}"
                    Write-Host "  - <lastmod> 更新: $file -> $targetPath" -ForegroundColor Gray
                    $hasSitemapUpdates = $true
                }
            }
        }
    }

    if ($hasSitemapUpdates) {
        [System.IO.File]::WriteAllText((Resolve-Path $sitemapPath).Path, $sitemapUpdated, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "[OK] sitemap.xml の最終更新日時 (<lastmod>) を更新しました。" -ForegroundColor Green
        
        git add $sitemapPath
        git commit -m "chore: auto-update sitemap lastmod for modified files" -q
    }
    else {
        Write-Host "[OK] sitemap.xml の更新が必要な HTML ファイルはありません。" -ForegroundColor Gray
    }
}
Write-Host ""

# --- [8/8] GitHub への公開とダッシュボード API 検証 ---
Write-Host "[8/8] すべての変更を GitHub に公開し、ダッシュボード API を検証中..." -ForegroundColor Yellow

$remoteHead = git rev-parse origin/main 2>$null
$localHead = git rev-parse HEAD 2>$null
$remoteHeadMsg = if ($remoteHead) { git log -1 --pretty=%B origin/main } else { "" }
if ($remoteHead -and $localHead -and $remoteHead -ne $localHead -and $remoteHeadMsg -match "\[skip ci\]") {
    Wait-GitHubPagesChecks -RepoSlug (Get-GitHubRepoSlug) -CommitSha $remoteHead
}

# 最新コミットが [skip ci] (GAS更新) の場合、デプロイ用コミットを追加
$lastMsg = git log -1 --pretty=%B
if ($lastMsg -match "\[skip ci\]") {
    Write-Host "デプロイを確実にするトリガーコミットを作成中..." -ForegroundColor Cyan
    git commit --allow-empty -m "Deploy: Update data files"
}

Write-Host "GitHub へプッシュ中..." -ForegroundColor Gray
git push
if ($LASTEXITCODE -ne 0) {
    Write-Error "[エラー] git push に失敗しました。"
    exit 1
}
Write-Host "[OK] すべての変更が GitHub Pages に公開されました！" -ForegroundColor Green
Write-Host ""

# ダッシュボード集計 API の検証
Write-Host "ダッシュボード集計 API の動作用検証を実行中..." -ForegroundColor Yellow
$dashboardPeriods = @(7, 30, 90)
$dashboardApiRetryDelays = @(0, 10, 20, 40, 60)
$pendingDashboardPeriods = @($dashboardPeriods)
$dashboardApiResultByPeriod = @{}
for (
    $attemptIndex = 0;
    $attemptIndex -lt $dashboardApiRetryDelays.Count -and $pendingDashboardPeriods.Count -gt 0;
    $attemptIndex++
) {
    $attempt = $attemptIndex + 1
    $delaySeconds = $dashboardApiRetryDelays[$attemptIndex]
    if ($delaySeconds -gt 0) {
        $pendingLabel = $pendingDashboardPeriods -join ","
        Write-Host "  [待機中] period=$pendingLabel - $delaySeconds 秒後に再試行..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $delaySeconds
    }

    $nextPendingPeriods = @()
    foreach ($period in $pendingDashboardPeriods) {
        $result = Invoke-DashboardApiCheck -BaseUrl $env:GAS_DEPLOY_URL -Period $period
        $dashboardApiResultByPeriod[$period] = $result
        if ($result.Success) {
            Write-Host "  [OK] period=$period" -ForegroundColor Green
        }
        else {
            $nextPendingPeriods += $period
        }
        if (-not $result.Success -and $attemptIndex -lt $dashboardApiRetryDelays.Count - 1) {
            Write-Host "  [再試行] period=$period 試行=$attempt - $($result.Message)" -ForegroundColor Yellow
        }
    }
    $pendingDashboardPeriods = @($nextPendingPeriods)
}

$dashboardApiResults = foreach ($period in $dashboardPeriods) {
    $result = $dashboardApiResultByPeriod[$period]
    if (-not $result.Success) {
        Write-Host "  [失敗] period=$period - $($result.Message)" -ForegroundColor Red
    }
    $result
}
$dashboardApiHealthy = -not ($dashboardApiResults | Where-Object { -not $_.Success })
Write-Host ""

if ($dashboardApiHealthy) {
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "[OK] 正常に完了しました" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "アプリ、生成データ、およびダッシュボード API の同期が完了しました。" -ForegroundColor White
}
else {
    Write-Host "================================" -ForegroundColor Yellow
    Write-Host "[一部完了] サイト同期は成功しましたが、ダッシュボード API の検証に失敗しました" -ForegroundColor Yellow
    Write-Host "================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "GitHub Pages は更新されましたが、ダッシュボード API の動作が確認できていません。" -ForegroundColor Yellow
}
Write-Host "数分後に公開サイトをご確認ください:" -ForegroundColor Gray
Write-Host "https://yutaka-okawachi.github.io/gaswebapp-manual/" -ForegroundColor Blue
Write-Host ""

# --- デプロイ警告のチェック ---
if (Test-Path ".deploy_warning") {
    $count = [int](Get-Content ".deploy_warning")
    $remaining = [Math]::Max(0, 200 - $count)
    $warningColor = if ($count -ge 195) { "Red" } else { "Yellow" }
    $warningLabel = if ($count -ge 195) { "危険" } else { "警告" }
    Write-Host "[$warningLabel] Apps Script バージョン数が上限に近づいています ($count/200; 残り $remaining)。" -ForegroundColor $warningColor -BackgroundColor Black
    Write-Host "上限に達する前に Apps Script 管理画面不要なバージョンやデプロイメントを整理してください。" -ForegroundColor $warningColor -BackgroundColor Black
    Remove-Item ".deploy_warning" -ErrorAction SilentlyContinue
    Write-Host ""
}

if (-not $dashboardApiHealthy) {
    exit 1
}
