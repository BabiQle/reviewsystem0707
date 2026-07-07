# ============================================================
# 停止 Cloudflare Tunnel
# ============================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Stopping Cloudflare Tunnel" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$tunnels = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
if ($tunnels) {
    Write-Host "Stopping $($tunnels.Count) cloudflared process(es)..." -ForegroundColor Yellow
    foreach ($t in $tunnels) {
        Write-Host "  Stopping PID: $($t.Id)" -ForegroundColor Gray
    }
    Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    $remaining = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Host "[WARN] Processes still running, forcing..." -ForegroundColor Red
        Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[OK] Tunnel stopped" -ForegroundColor Green
} else {
    Write-Host "[INFO] No cloudflared process running" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")