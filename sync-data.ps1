param(
    [string]$message = "自動同期アップデート",
    [ValidateSet('Auto', 'Data', 'Site', 'All', 'Check', 'Verify')]
    [string]$Mode = 'Auto',
    [switch]$AllowDataRemoval
)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $arguments = @('scripts/sync/main.js', '--mode', $Mode, '--message', $message)
    if ($AllowDataRemoval) { $arguments += '--allow-data-removal' }
    & node @arguments
    $syncExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $syncExitCode
