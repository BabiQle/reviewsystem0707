chcp 65001 >nul
chcp 65001 >nul
@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

SET "WORKSPACE=D:\review-system-new - codex"
SET "PB_DIR=D:\PB"
SET "SCRIPTS_DIR=%WORKSPACE%\scripts"
SET "LOGS_DIR=%WORKSPACE%\logs"
SET "CF_EXE=%SCRIPTS_DIR%\cloudflared.exe"

IF NOT EXIST "%LOGS_DIR%" MKDIR "%LOGS_DIR%"

ECHO.
ECHO ================================================
ECHO   Review System Startup
ECHO ================================================
ECHO.
ECHO [1/4] Starting PocketBase ...
ECHO [2/4] Starting Frontend Tunnel ...
ECHO [3/4] Starting PB Tunnel ...
ECHO [4/4] Done
ECHO.

REM --- 1. Start PocketBase ---
CD /D "%PB_DIR%"
START "PocketBase" cmd /c "pocketbase.exe serve --http 10.80.159.174:8091"
TIMEOUT /t 3 /nobreak >NUL

REM --- 2. Check cloudflared ---
IF NOT EXIST "%CF_EXE%" (
    ECHO [WARNING] cloudflared.exe not found at: %CF_EXE%
    ECHO Download from: https://github.com/cloudflare/cloudflared/releases
    ECHO Try using cloudflared from PATH...
    PAUSE >NUL
    SET "CF_CMD=cloudflared"
) ELSE (
    SET "CF_CMD=%CF_EXE%"
)

REM --- 3. Start Frontend Tunnel ---
ECHO.
ECHO --- Starting Frontend Tunnel ---
START "Frontend-Tunnel" cmd /c "^"!CF_CMD!" tunnel --config ^"%SCRIPTS_DIR%\cloudflared-frontend.toml^" run"
TIMEOUT /t 3 /nobreak >NUL

REM --- 4. Start PB Tunnel ---
ECHO --- Starting PB Tunnel ---
START "PB-Tunnel" cmd /c "^"!CF_CMD!" tunnel --config ^"%SCRIPTS_DIR%\cloudflared-pb.toml^" run"
TIMEOUT /t 3 /nobreak >NUL

REM --- 5. Show info ---
ECHO.
ECHO ================================================
ECHO   All services started!
ECHO ================================================
ECHO.
ECHO   Frontend Tunnel Monitor: http://localhost:3821
ECHO   PB Tunnel Monitor:       http://localhost:3822
ECHO.
ECHO   To stop all services, run:
ECHO     scripts\stop-all.bat
ECHO.
PAUSE >NUL