# ============================================================
# 实时查看隧道日志
# 用法: .\watch-tunnel-log.ps1
# ============================================================

$logFile = "D:\review-system-new - codex\logs\tunnel.log"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Tunnel Log Monitor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Log file: $logFile" -ForegroundColor Gray
Write-Host "Press Ctrl+C to exit" -ForegroundColor Yellow
Write-Host ""

if (Test-Path $logFile) {
    Write-Host "--- Recent log entries ---" -ForegroundColor DarkGray
    Get-Content $logFile -Tail 10
    Write-Host ""
    Write-Host "--- Live monitoring ---" -ForegroundColor DarkGray
    Get-Content $logFile -Wait -Tail 0
} else {
    Write-Host "[WARN] Log file does not exist. Tunnel may not be running." -ForegroundColor Yellow
    Write-Host "Please run: .\start-tunnel.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Waiting for log file to be created..." -ForegroundColor Gray
    $timeout = 60
    $startTime = Get-Date
    while (-not (Test-Path $logFile)) {
        Start-Sleep -Seconds 1
        if ((Get-Date).AddSeconds(-$timeout) -gt $startTime) {
            Write-Host "[ERROR] Timeout waiting for log file" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host "[OK] Log file created, starting monitor" -ForegroundColor Green
    Get-Content $logFile -Wait -Tail 0
}