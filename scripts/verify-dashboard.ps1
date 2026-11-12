param([Parameter(Mandatory=$true)][string]$BaseUrl)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'dashboard-api-check.ps1')
$dashboardToken = $env:DASHBOARD_API_TOKEN
if (-not $dashboardToken) {
    $localEnvPath = Join-Path $PSScriptRoot '../.env'
    if (Test-Path -LiteralPath $localEnvPath) {
        foreach ($line in [System.IO.File]::ReadAllLines($localEnvPath)) {
            if ($line -match '^\s*DASHBOARD_API_TOKEN\s*=\s*(.*?)\s*$') {
                $dashboardToken = $Matches[1].Trim().Trim([char]34, [char]39)
            }
        }
    }
}
if (-not $dashboardToken -or $dashboardToken.Length -lt 32) { throw 'DASHBOARD_API_TOKEN を非公開の .env に設定してください。' }
$pending = @(7, 30, 90, 180)
foreach ($seconds in @(0, 10, 20, 40, 60)) {
    if ($seconds) { Start-Sleep -Seconds $seconds }
    $next = @()
    foreach ($period in $pending) {
        $result = Invoke-DashboardApiCheck -BaseUrl $BaseUrl -Period $period -DashboardToken $dashboardToken
        if (-not $result.Success) {
            Write-Host "[注意] ダッシュボードAPIの$($period)日分の応答を確認できませんでした。詳細（原文）: $($result.Message)"
            $next += $period
        }
    }
    $pending = $next
    if ($pending.Count -eq 0) { Write-Host '[完了] ダッシュボードAPIの7・30・90・180日分の応答を確認しました。'; exit 0 }
}
Write-Error 'ダッシュボード API の確認が未完了です。再実行すると確認から再開します。'
exit 1
