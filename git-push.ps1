<#
.SYNOPSIS
  Automates the git add, commit, and push sequence.
.DESCRIPTION
  This script stages all changes, commits them with a provided message,
  and pushes the commit to the remote repository.
.PARAMETER m
  The commit message (mandatory).
.EXAMPLE
  .\git-push.ps1 -m "Update styles for index page"
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$m
)

Write-Host "Staging all changes..."
git add .

Write-Host "Committing with message: '$m'..."
git commit -m $m

Write-Host "Pushing to remote repository..."
git push

Write-Host "Git push completed successfully."