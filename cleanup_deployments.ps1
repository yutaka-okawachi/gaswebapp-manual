param(
  [switch]$Force
)

# 設定: 2025年9月1日 (Version 560) より前のものを削除対象とする
$thresholdVersion = 560 
$excludeIds = @(
    "AKfycbxWl-KLwo8SnOyqQT84gJyrofRQnIp_GBv8Pg0N5athPAoxp9LBuwj0HDTXkFqh0xiGsw", # Production
    "AKfycbwgYpxpOQ3kez3T_5AAB6b4eFGy2yhjqcc0r84o4NjVVfq8B54RXLRikVo0rgwhtW-eyQ"  # Staging
)

Write-Host "Fetching deployments list..."
# 出力をファイルに保存して解析（エンコーディング問題を避けるためUTF8指定推奨だがclaspの出力依存）
clasp deployments > deployments_temp.txt

# ファイル読み込み
$content = Get-Content deployments_temp.txt -Raw

# 正規表現でデプロイIDとバージョンを抽出
# パターン: "- <ID> ... @<Version> ..."
# 改行が含まれる場合も考慮して抽出
$matches = [regex]::Matches($content, "- ([A-Za-z0-9_-]+)[\s\S]*?@(\d+)")

$targets = @()

foreach ($match in $matches) {
    $id = $match.Groups[1].Value
    $version = [int]$match.Groups[2].Value

    # 指定バージョン未満 かつ 除外IDに含まれない場合
    if ($version -lt $thresholdVersion -and $id -notin $excludeIds) {
        $targets += @{ ID = $id; Version = $version }
    }
}

Write-Host "Found $($targets.Count) deployments created before Sep 2025 (Version < $thresholdVersion)."

if ($targets.Count -gt 0) {
    # 対象リストを表示
    $targets | Format-Table

    if (-not $Force) {
        $confirmation = Read-Host "Do you want to DELETE these $($targets.Count) deployments? (y/n)"
        if ($confirmation -ne 'y') {
            Write-Host "Operation cancelled."
            Remove-Item deployments_temp.txt
            exit
        }
    }

    # 削除実行
    foreach ($target in $targets) {
        Write-Host "Deleting deployment $($target.ID) (Version $($target.Version))..."
        # エラーが出ても続行するように try-catch またはエラー無視
        try {
            # 標準エラー出力を抑制しつつ実行
            $null = clasp undeploy $target.ID 2>&1
            Write-Host "  -> Deleted." -ForegroundColor Green
        } catch {
            Write-Host "  -> Failed to delete (might be in use)." -ForegroundColor Yellow
        }
    }
    Write-Host "Cleanup complete."
} else {
    Write-Host "No deployments found to delete."
}

Remove-Item deployments_temp.txt
