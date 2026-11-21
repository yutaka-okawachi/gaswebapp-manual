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
if (-not $dashboardToken -or $dashboardToken.Length -lt 32) {
    Write-Output 'DASHBOARD_CHECK preflight=missing_token'
    throw 'DASHBOARD_API_TOKEN を非公開の .env に設定してください。'
}
$checked = @{}
Invoke-DashboardApiVerification -BaseUrl $BaseUrl -DashboardToken $dashboardToken | ForEach-Object {
    Write-Output $_.Telemetry
    $checked[$_.Period] = $_.Success
}
if ($checked.Count -eq $script:DashboardApiPeriods.Count -and $checked.Values -notcontains $false) {
    Write-Host '[完了] ダッシュボードAPIの7・30・90・180日分の応答を確認しました。'
    exit 0
}
Write-Error 'ダッシュボード API の確認が未完了です。再実行すると確認から再開します。'
exit 1
