@echo off
title Green House Hostel - Live Server
cd /d "%~dp0"
echo ============================================================
echo   Starting Green House Hostel Member & Admin Live Server
echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
