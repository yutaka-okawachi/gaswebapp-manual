param(
    [switch]$Force = $false
)

# Active Deployment ID (from GAS_DEPLOY_URL)
# User's URL: https://script.google.com/macros/s/AKfycbzsgiXGZ3ptAGqR-qMDR26tRNI235IYUVBox-quohfqvNlnkxGSqNb9yY8DiD41JB8qWA/exec
$ACTIVE_DEPLOYMENT_ID = "AKfycbzsgiXGZ3ptAGqR-qMDR26tRNI235IYUVBox-quohfqvNlnkxGSqNb9yY8DiD41JB8qWA"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "GAS Deployment Cleanup Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Active Deployment ID (Protected): $ACTIVE_DEPLOYMENT_ID" -ForegroundColor Gray
Write-Host ""
Write-Host "Fetching deployments..." -ForegroundColor Yellow

Push-Location "src"

try {
    # Get deployments list
    # clasp deployments output looks like:
    # - <ID> @<Version> - <Description>
    $deploymentsOutput = clasp deployments 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to fetch deployments. Make sure you are logged in (clasp login)."
    }

    $lines = $deploymentsOutput -split "`n"
    $toDelete = @()

    foreach ($line in $lines) {
        if ($line -match '- ([A-Za-z0-9_-]+) @\d+') {
            $id = $matches[1]
            
            # Skip if it's the active deployment
            if ($id -eq $ACTIVE_DEPLOYMENT_ID) {
                Write-Host "KEEPING: $id (Active)" -ForegroundColor Green
                continue
            }

            # Skip if it looks like a HEAD deployment (sometimes clasp shows HEAD)
            # Normally clasp deployments list versions. 
            
            $toDelete += $id
        }
    }

    $count = $toDelete.Count
    if ($count -eq 0) {
        Write-Host "No deployments to delete." -ForegroundColor Green
        exit 0
    }

    Write-Host ""
    Write-Host "Found $count old deployments to delete." -ForegroundColor Yellow
    
    if (-not $Force) {
        $confirm = Read-Host "Are you sure you want to delete these $count deployments? (y/n)"
        if ($confirm -ne 'y') {
            Write-Host "Operation cancelled." -ForegroundColor Gray
            exit 0
        }
    }

    # Delete loop
    $i = 0
    foreach ($id in $toDelete) {
        $i++
        Write-Host "[$i/$count] Deleting $id ..." -NoNewline
        clasp undeploy $id | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host " Done" -ForegroundColor Green
        } else {
            Write-Host " Failed" -ForegroundColor Red
        }
    }

    Write-Host ""
    Write-Host "Cleanup complete!" -ForegroundColor Green

} catch {
    Write-Error "Error: $_"
} finally {
    Pop-Location
}
