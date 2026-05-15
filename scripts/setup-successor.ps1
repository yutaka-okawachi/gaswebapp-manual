param(
    [switch]$SkipSyncTest
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Ask-YesNo {
    param(
        [string]$Question,
        [bool]$DefaultYes = $true
    )

    $suffix = if ($DefaultYes) { "[Y=はい / n=いいえ]" } else { "[y=はい / N=いいえ]" }
    while ($true) {
        $answer = Read-Host "$Question $suffix"
        if ([string]::IsNullOrWhiteSpace($answer)) {
            return $DefaultYes
        }
        if ($answer -match "^[Yy]") { return $true }
        if ($answer -match "^[Nn]") { return $false }
        if ($answer -match "^はい$") { return $true }
        if ($answer -match "^いいえ$") { return $false }
        Write-Host "Y または N で入力してください。" -ForegroundColor Yellow
    }
}

function Test-CommandExists {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Install-WithWinget {
    param(
        [string]$Name,
        [string]$PackageId
    )

    if (-not (Test-CommandExists "winget")) {
        Write-Host "winget が見つかりません。$Name は手動でインストールしてください。" -ForegroundColor Yellow
        return
    }

    Write-Host "$Name を winget でインストールします。" -ForegroundColor Gray
    winget install --id $PackageId -e
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$Name のインストールに失敗した可能性があります。必要な場合は手動でインストールしてください。" -ForegroundColor Yellow
    }
}

function Read-RequiredValue {
    param(
        [string]$Prompt,
        [bool]$Secret = $false
    )

    while ($true) {
        if ($Secret) {
            $secure = Read-Host $Prompt -AsSecureString
            $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
            try {
                $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
            } finally {
                [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
            }
        } else {
            $value = Read-Host $Prompt
        }

        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }
        Write-Host "空欄にはできません。" -ForegroundColor Yellow
    }
}

function Read-GasWebAppUrl {
    while ($true) {
        $value = Read-RequiredValue "GAS Web App URL を入力してください"
        if ($value -match "^https://script\.google\.com/macros/s/.+/exec$") {
            return $value
        }

        Write-Host "入力された値が GAS Web App URL の形式ではない可能性があります。" -ForegroundColor Yellow
        Write-Host "通常は https://script.google.com/macros/s/.../exec の形です。" -ForegroundColor Yellow
        if (Ask-YesNo "この値のまま続けますか？" $false) {
            return $value
        }
    }
}

function Read-GasSecretToken {
    Write-Host "GAS_SECRET_TOKEN は画面に表示されません。前任者から受け取った値を貼り付けて Enter を押してください。" -ForegroundColor Yellow
    return Read-RequiredValue "GAS_SECRET_TOKEN を入力してください" -Secret $true
}

function Write-EnvFile {
    param(
        [string]$Path,
        [string]$GasDeployUrl,
        [string]$GasSecretToken
    )

    $content = @"
# Google Apps Script Web App URL
GAS_DEPLOY_URL=$GasDeployUrl

# Same value as GAS script property GAS_SECRET_TOKEN
GAS_SECRET_TOKEN=$GasSecretToken
"@

    Set-Content -Encoding UTF8 -Path $Path -Value $content
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

Write-Section "継承者向けセットアップ"
Write-Host "このスクリプトは、後継者の Windows PC で必要な環境を確認します。"
Write-Host "分からない項目が出た場合は、前任者または管理者に確認してください。"
Write-Host "質問では y が「はい」、n が「いいえ」です。迷った場合は n を選んで止めてください。"

Write-Section "1. 基本ツールの確認"

if (Test-CommandExists "node") {
    $nodeVersion = node --version
    Write-Host "Node.js: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "Node.js が見つかりません。" -ForegroundColor Yellow
    Write-Host "通常はインストールが必要です。Google Apps Script 管理ツール clasp を動かすために使います。" -ForegroundColor Yellow
    if (Ask-YesNo "Node.js LTS をインストールしますか？" $false) {
        Install-WithWinget -Name "Node.js LTS" -PackageId "OpenJS.NodeJS.LTS"
        Write-Host "インストール後は PowerShell を開き直す必要がある場合があります。" -ForegroundColor Yellow
    }
}

if (Test-CommandExists "git") {
    $gitVersion = git --version
    Write-Host "Git: $gitVersion" -ForegroundColor Green
} else {
    Write-Host "Git が見つかりません。" -ForegroundColor Yellow
    Write-Host "通常はインストールが必要です。GitHub からプロジェクトを取得・更新するために使います。" -ForegroundColor Yellow
    if (Ask-YesNo "Git for Windows をインストールしますか？" $false) {
        Install-WithWinget -Name "Git for Windows" -PackageId "Git.Git"
        Write-Host "インストール後は PowerShell を開き直す必要がある場合があります。" -ForegroundColor Yellow
    }
}

Write-Section "2. clasp の確認"

if (Test-CommandExists "clasp") {
    $claspVersion = clasp --version
    Write-Host "clasp: $claspVersion" -ForegroundColor Green
} elseif (Test-CommandExists "npm") {
    Write-Host "clasp が見つかりません。" -ForegroundColor Yellow
    Write-Host "通常はインストールが必要です。Google Apps Script にログインし、GAS のコードを更新するために使います。" -ForegroundColor Yellow
    if (Ask-YesNo "Google Apps Script 管理ツール clasp をインストールしますか？" $false) {
        npm install -g @google/clasp
    }
} else {
    Write-Host "npm が見つかりません。Node.js をインストールしてから、もう一度このスクリプトを実行してください。" -ForegroundColor Yellow
}

Write-Section "3. .env の作成"

$envPath = Join-Path $repoRoot ".env"
if (Test-Path $envPath) {
    Write-Host ".env は既に存在します。" -ForegroundColor Green
    if (Ask-YesNo ".env を作り直しますか？" $false) {
        $gasDeployUrl = Read-GasWebAppUrl
        $gasSecretToken = Read-GasSecretToken
        Write-EnvFile -Path $envPath -GasDeployUrl $gasDeployUrl -GasSecretToken $gasSecretToken
        Write-Host ".env を更新しました。" -ForegroundColor Green
    }
} else {
    Write-Host ".env は、この PC だけで使う秘密情報のメモファイルです。" -ForegroundColor Yellow
    Write-Host "前任者から受け取った GAS Web App URL と GAS_SECRET_TOKEN を入力します。" -ForegroundColor Yellow
    $gasDeployUrl = Read-GasWebAppUrl
    $gasSecretToken = Read-GasSecretToken
    Write-EnvFile -Path $envPath -GasDeployUrl $gasDeployUrl -GasSecretToken $gasSecretToken
    Write-Host ".env を作成しました。" -ForegroundColor Green
}

Write-Section "4. Google Apps Script 認証"

if (Test-CommandExists "clasp") {
    if (Ask-YesNo "ブラウザを開いて clasp login を実行しますか？" $false) {
        Write-Host "ブラウザが開いたら、前任者から指定された Google アカウントでログインしてください。" -ForegroundColor Yellow
        Write-Host "どのアカウントを使うか分からない場合は、許可せずに前任者へ確認してください。" -ForegroundColor Yellow
        clasp login
    }
} else {
    Write-Host "clasp が見つからないため、この手順をスキップします。" -ForegroundColor Yellow
}

Write-Section "5. 動作確認"

if ($SkipSyncTest) {
    Write-Host "-SkipSyncTest が指定されているため、同期テストをスキップしました。" -ForegroundColor Yellow
} elseif (Test-Path (Join-Path $repoRoot "sync-data.ps1")) {
    if (Ask-YesNo "最後に .\sync-data.ps1 を実行して同期テストを行いますか？" $false) {
        & (Join-Path $repoRoot "sync-data.ps1")
    } else {
        Write-Host "同期テストはスキップしました。必要になったら .\sync-data.ps1 を実行してください。" -ForegroundColor Yellow
    }
} else {
    Write-Host "sync-data.ps1 が見つかりません。" -ForegroundColor Yellow
}

Write-Section "完了"
Write-Host "セットアップ確認が完了しました。通常の更新では .\sync-data.ps1 を使います。"
Write-Host "説明を確認する場合は manuals\SUCCESSOR_START_HERE.md を開いてください。"




