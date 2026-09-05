param([Parameter(Mandatory=$true)][string]$BaseUrl)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'dashboard-api-check.ps1')
$pending = @(7, 30, 90)
foreach ($seconds in @(0, 10, 20, 40, 60)) {
    if ($seconds) { Start-Sleep -Seconds $seconds }
    $next = @()
    foreach ($period in $pending) {
        $result = Invoke-DashboardApiCheck -BaseUrl $BaseUrl -Period $period
        if (-not $result.Success) {
            Write-Host "period=$period : $($result.Message)"
            $next += $period
        }
    }
    $pending = $next
    if ($pending.Count -eq 0) { Write-Host 'Dashboard API: OK (7/30/90)'; exit 0 }
}
Write-Error "ダッシュボード API の確認が未完了です。再実行すると確認から再開します。"
exit 1
