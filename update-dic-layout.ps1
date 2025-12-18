param([string]$message = "dic.html layout update")
Write-Host "================================" -ForegroundColor Cyan
Write-Host "dic.html Layout Update Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/4] Uploading to GAS..." -ForegroundColor Yellow
Push-Location "c:\Users\okawa\gaswebapp-manual\src"
clasp push
if ($LASTEXITCODE -ne 0) { Write-Error "clasp push failed"; Pop-Location; exit 1 }
Write-Host "OK clasp push complete" -ForegroundColor Green
Pop-Location
Write-Host ""
Write-Host "[2/4] Please run the function in GAS" -ForegroundColor Yellow
Write-Host ""
Write-Host "Steps:" -ForegroundColor White
Write-Host "  1. Open Google Apps Script Editor" -ForegroundColor Gray
Write-Host "     https://script.google.com" -ForegroundColor Blue
Write-Host "  2. Select function: exportAllDataToJson" -ForegroundColor Gray
Write-Host "  3. Click Run button" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Enter when complete..." -ForegroundColor Cyan
Read-Host
Write-Host ""
Write-Host "[3/4] Getting latest dic.html from GitHub..." -ForegroundColor Yellow
git pull --rebase
if ($LASTEXITCODE -ne 0) { Write-Warning "git pull issue" } else { Write-Host "OK git pull complete" -ForegroundColor Green }
Write-Host ""
Write-Host "[4/4] Push changes to GitHub? (y/N)" -ForegroundColor Yellow
$push = Read-Host
if ($push -eq 'y' -or $push -eq 'Y') {
    Write-Host "Pushing changes..." -ForegroundColor Yellow
    git add .
    git commit -m $message
    git push
    if ($LASTEXITCODE -eq 0) { Write-Host "OK Push complete" -ForegroundColor Green } else { Write-Warning "Push issue" }
} else { Write-Host "Skipped push" -ForegroundColor Gray }

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "OK Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "dic.html has been updated" -ForegroundColor White
Write-Host "Check mahler-search-app/dic.html" -ForegroundColor Gray
