param(
    [string]$message = "自動同期アップデート",
    [ValidateSet('Auto', 'Data', 'Site', 'All', 'Check', 'Verify', 'Recover')]
    [string]$Mode = 'Auto',
    [switch]$AllowDataRemoval,
    [switch]$ApplyRecovery
)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $arguments = @('scripts/sync/main.js', '--mode', $Mode, '--message', $message)
    if ($AllowDataRemoval) { $arguments += '--allow-data-removal' }
    if ($ApplyRecovery) { $arguments += '--apply-recovery' }
    & node @arguments
    $syncExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $syncExitCode
