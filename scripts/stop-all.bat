chcp 65001 >nul
chcp 65001 >nul
@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

ECHO.
ECHO ================================================
ECHO   Stopping All Services
ECHO ================================================
ECHO.

ECHO [1/2] Stopping PocketBase ...
TASKKILL /F /IM pocketbase.exe >NUL 2>&1
IF !errorlevel! EQU 0 (
    ECHO [OK] PocketBase stopped
) ELSE (
    ECHO [INFO] PocketBase was not running
)

ECHO.
ECHO [2/2] Stopping cloudflared ...
TASKKILL /F /IM cloudflared.exe >NUL 2>&1
IF !errorlevel! EQU 0 (
    ECHO [OK] cloudflared stopped
) ELSE (
    ECHO [INFO] cloudflared was not running
)

ECHO.
ECHO ================================================
ECHO   All services stopped
ECHO ================================================
ECHO.
PAUSE >NUL