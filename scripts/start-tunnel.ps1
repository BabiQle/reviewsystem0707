# Cloudflare Tunnel Startup - Named Tunnel (teamrate-tunnel)
# Uses your custom domain: web.teamrate.top, api.teamrate.top

$ErrorActionPreference = "Stop"
$workspace = "D:\review-system-new - codex"
$scriptDir = Join-Path $workspace "scripts"
$cfExe = Join-Path $scriptDir "cloudflared.exe"
$credsFile = Join-Path $scriptDir "tunnel-creds.json"
$configFile = Join-Path $scriptDir "tunnel-teamrate.toml"
$logsDir = Join-Path $workspace "logs"

if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Cloudflare Tunnel Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check cloudflared
if (-not (Test-Path $cfExe)) {
    Write-Host "[ERROR] cloudflared.exe not found" -ForegroundColor Red
    Pause; exit 1
}

# Check credentials
if (-not (Test-Path $credsFile)) {
    Write-Host "[ERROR] tunnel-creds.json not found" -ForegroundColor Red
    Write-Host "Run setup-tunnel.bat first" -ForegroundColor Yellow
    Pause; exit 1
}

# Check services
Write-Host "[1/3] Checking services..." -ForegroundColor Yellow
$feOk = $false; $pbOk = $false

try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -TimeoutSec 3 -UseBasicParsing
    if ($r.StatusCode -eq 200) { Write-Host "  Frontend (5173): OK" -ForegroundColor Green; $feOk = $true }
} catch { Write-Host "  Frontend (5173): FAIL" -ForegroundColor Red }

try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 8091) | Out-Null
    $tcp.Close()
    Write-Host "  PocketBase (8091): OK" -ForegroundColor Green; $pbOk = $true
} catch { Write-Host "  PocketBase (8091): FAIL" -ForegroundColor Red }

if (-not $feOk -or -not $pbOk) {
    Write-Host ""
    Write-Host "Service detection failed. Start frontend and PB first." -ForegroundColor Red
    Pause; exit 1
}

# Stop existing tunnel
$existing = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host ""
    Write-Host "Stopping existing tunnel (PID: $($existing.Id))..." -ForegroundColor Yellow
    Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Start tunnel
Write-Host "[2/3] Starting Cloudflare Tunnel..." -ForegroundColor Yellow
$processArgs = @("--no-autoupdate", "tunnel", "--config", $configFile, "run")
$tunnelProcess = Start-Process -FilePath $cfExe -ArgumentList $processArgs -NoNewWindow -PassThru
Write-Host "  Tunnel started (PID: $($tunnelProcess.Id))" -ForegroundColor Green

# Wait for connection
Write-Host "[3/3] Waiting for tunnel connection..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Verify
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Tunnel is running!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend: https://web.teamrate.top" -ForegroundColor Cyan
Write-Host "  PB Admin: https://api.teamrate.top/_/" -ForegroundColor Cyan
Write-Host "  PB API:   https://api.teamrate.top/api/" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop tunnel" -ForegroundColor Yellow
Write-Host ""

# Keep running
while ($true) { Start-Sleep -Seconds 1 }