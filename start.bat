@echo off
title Workshop Manager - Server
color 0A

echo.
echo  ==========================================
echo   WORKSHOP MANAGER - Starting Server...
echo  ==========================================
echo.

:: إيقاف أي نسخة سابقة على المنفذ 8080
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: انتظر ثانية
timeout /t 1 /nobreak >nul

echo  Starting server on http://localhost:8080
echo  Press Ctrl+C to stop
echo.

:: تشغيل السيرفر
node server.js

pause