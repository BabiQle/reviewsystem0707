# Quick Tunnel Startup - Auto-restart on expiry
$ErrorActionPreference = "Stop"
$workspace = "D:\review-system-new - codex"
$cfExe = Join-Path $workspace "scripts\cloudflared.exe"
$logsDir = Join-Path $workspace "logs"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Quick Tunnel Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check services
Write-Host "[1/4] Checking local services..." -ForegroundColor Yellow
$feOk = $false; $pbOk = $false

try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -TimeoutSec 3 -UseBasicParsing
    if ($r.StatusCode -eq 200) { Write-Host "  Frontend (5173): OK" -ForegroundColor Green; $feOk = $true }
} catch { Write-Host "  Frontend (5173): FAIL" -ForegroundColor Red }

try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 8091) | Out-Null
    $tcp.Close()
    Write-Host "  PB (8091): OK" -ForegroundColor Green; $pbOk = $true
} catch { Write-Host "  PB (8091): FAIL" -ForegroundColor Red }

if (-not $feOk -or -not $pbOk) {
    Write-Host ""
    Write-Host "Service detection failed." -ForegroundColor Red
    Pause
    exit 1
}

# Stop existing tunnels
Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start frontend tunnel
Write-Host "[2/4] Starting frontend tunnel..." -ForegroundColor Yellow
$feErr = Join-Path $logsDir "fe-tunnel.err"
$feProc = Start-Process -FilePath $cfExe -ArgumentList "--no-autoupdate", "tunnel", "--url", "http://127.0.0.1:5173", "demo" -RedirectStandardError $feErr -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 15

# Start PB tunnel
Write-Host "[3/4] Starting PB tunnel..." -ForegroundColor Yellow
$pbErr = Join-Path $logsDir "pb-tunnel.err"
$pbProc = Start-Process -FilePath $cfExe -ArgumentList "--no-autoupdate", "tunnel", "--url", "http://127.0.0.1:8091", "demo" -RedirectStandardError $pbErr -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 15

# Extract URLs
$feUrl = (Get-Content $feErr | Where-Object { $_ -match 'https://.*trycloudflare\.com' } | ForEach-Object { $_ -replace '.*https://', 'https://' -replace ' \|.*', '' })[0]
$pbUrl = (Get-Content $pbErr | Where-Object { $_ -match 'https://.*trycloudflare\.com' } | ForEach-Object { $_ -replace '.*https://', 'https://' -replace ' \|.*', '' })[0]

# Update vite config
Write-Host "[4/4] Updating Vite config..." -ForegroundColor Yellow
$viteConfig = Join-Path $workspace "vite.config.ts"
$content = Get-Content $viteConfig -Raw
$feDomain = ($feUrl -split '://')[1] -split '\.' | Select-Object -First 1
$pbDomain = ($pbUrl -split '://')[1] -split '\.' | Select-Object -First 1
$newContent = $content -replace 'allowedHosts: \[.*?\]', "allowedHosts: [`"web.teamrate.top`", `"api.teamrate.top`", `".teamrate.top`", `"$feDomain.trycloudflare.com`", `"$pbDomain.trycloudflare.com`"]"
$newContent = $newContent -replace 'target: ".*?trycloudflare\.com"', "target: `"$pbUrl`""
[System.IO.File]::WriteAllText($viteConfig, $newContent, [System.Text.UTF8Encoding]::new($false))

# Restart vite
Write-Host "  Restarting Vite..." -ForegroundColor Gray
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Set-Location $workspace
$proc = Start-Process -FilePath "cmd" -ArgumentList "/c", "npx", "vite", "--host", "0.0.0.0", "--port", "5173" -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 10

# Verify
Write-Host ""
Write-Host "Verifying..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
    $r = Invoke-WebRequest -Uri $feUrl -TimeoutSec 5 -UseBasicParsing
    Write-Host "  Frontend: OK (HTTP $($r.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  Frontend: FAIL" -ForegroundColor Red
}

try {
    $r = Invoke-WebRequest -Uri "$pbUrl/_/" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  PB:       OK (HTTP $($r.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  PB:       FAIL" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Tunnels Running!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend: $feUrl" -ForegroundColor Cyan
Write-Host "PB:       $pbUrl/_/" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: URLs change on each restart." -ForegroundColor Yellow
Write-Host "NOTE: Tunnels expire after some time. Run this script again to refresh." -ForegroundColor Yellow
Write-Host ""
Write-Host "Stop: Stop-Process -Name cloudflared -Force" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop tunnels" -ForegroundColor Yellow
Write-Host ""

while ($true) { Start-Sleep -Seconds 1 }