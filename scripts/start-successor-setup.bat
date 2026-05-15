@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\setup-successor.ps1"
pause

