# Review System - Full Lifecycle Control
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Review System - Tunnel Control'
$form.Size = New-Object System.Drawing.Size(560, 620)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(13, 17, 23)
$form.Font = [System.Drawing.Font]::new('Segoe UI', 10, [System.Drawing.FontStyle]::Regular)

# Title
$titleLabel = [System.Windows.Forms.Label]::new()
$titleLabel.Text = 'Review System'
$titleLabel.ForeColor = [System.Drawing.Color]::FromArgb(248, 81, 73)
$titleLabel.Font = [System.Drawing.Font]::new('Segoe UI', 26, [System.Drawing.FontStyle]::Bold)
$titleLabel.Location = [System.Drawing.Point]::new(70, 12)
$titleLabel.Size = [System.Drawing.Size]::new(420, 40)
$titleLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$form.Controls.Add($titleLabel)

# Subtitle
$subLabel = [System.Windows.Forms.Label]::new()
$subLabel.Text = 'Cloudflare Tunnel Control Panel'
$subLabel.ForeColor = [System.Drawing.Color]::FromArgb(139, 148, 158)
$subLabel.Font = [System.Drawing.Font]::new('Segoe UI', 11)
$subLabel.Location = [System.Drawing.Point]::new(70, 52)
$subLabel.Size = [System.Drawing.Size]::new(420, 20)
$subLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$form.Controls.Add($subLabel)

# Action Button
$actionBtn = [System.Windows.Forms.Button]::new()
$actionBtn.Text = 'START ALL SERVICES'
$actionBtn.Font = [System.Drawing.Font]::new('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
$actionBtn.Size = [System.Drawing.Size]::new(420, 55)
$actionBtn.BackColor = [System.Drawing.Color]::FromArgb(35, 134, 54)
$actionBtn.ForeColor = [System.Drawing.Color]::White
$actionBtn.Location = [System.Drawing.Point]::new(70, 80)
$form.Controls.Add($actionBtn)

# Status Label
$statusLabel = [System.Windows.Forms.Label]::new()
$statusLabel.Text = 'Ready'
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(248, 81, 73)
$statusLabel.Font = [System.Drawing.Font]::new('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
$statusLabel.Location = [System.Drawing.Point]::new(30, 145)
$statusLabel.Size = [System.Drawing.Size]::new(500, 35)
$statusLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$statusLabel.BackColor = [System.Drawing.Color]::FromArgb(248, 81, 73, 38)
$statusLabel.BorderStyle = [System.Windows.Forms.BorderStyle]::Fixed3D
$form.Controls.Add($statusLabel)

# Log Panel
$logBox = [System.Windows.Forms.TextBox]::new()
$logBox.Location = [System.Drawing.Point]::new(30, 188)
$logBox.Size = [System.Drawing.Size]::new(500, 130)
$logBox.Multiline = $true
$logBox.ScrollBars = 'Vertical'
$logBox.ReadOnly = $true
$logBox.BackColor = [System.Drawing.Color]::FromArgb(13, 17, 23)
$logBox.ForeColor = [System.Drawing.Color]::FromArgb(200, 200, 200)
$logBox.Font = [System.Drawing.Font]::new('Consolas', 8)
$logBox.BorderStyle = [System.Windows.Forms.BorderStyle]::Fixed3D
$form.Controls.Add($logBox)

# URLs Panel
$urlPanel = [System.Windows.Forms.Panel]::new()
$urlPanel.Location = [System.Drawing.Point]::new(30, 330)
$urlPanel.Size = [System.Drawing.Size]::new(500, 110)
$urlPanel.BackColor = [System.Drawing.Color]::FromArgb(13, 17, 23)
$form.Controls.Add($urlPanel)

# URL Title
$urlTitle = [System.Windows.Forms.Label]::new()
$urlTitle.Text = 'Public URLs:'
$urlTitle.ForeColor = [System.Drawing.Color]::FromArgb(139, 148, 158)
$urlTitle.Font = [System.Drawing.Font]::new('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$urlTitle.Location = [System.Drawing.Point]::new(10, 5)
$urlTitle.AutoSize = $true
$urlPanel.Controls.Add($urlTitle)

# URL Links
$urlList = @(
    @{Text='web.teamrate.top (Frontend)';Url='https://web.teamrate.top'},
    @{Text='api.teamrate.top/_/ (PB Admin)';Url='https://api.teamrate.top/_/'},
    @{Text='api.teamrate.top/api/ (PB API)';Url='https://api.teamrate.top/api/'}
)
$yPos = 30
foreach ($u in $urlList) {
    $link = [System.Windows.Forms.LinkLabel]::new()
    $link.Text = $u.Text
    $link.ForeColor = [System.Drawing.Color]::FromArgb(88, 166, 255)
    $link.Font = [System.Drawing.Font]::new('Segoe UI', 11)
    $link.Location = [System.Drawing.Point]::new(10, $yPos)
    $link.LinkBehavior = [System.Windows.Forms.LinkBehavior]::NeverUnderline
    $link.Tag = $u.Url
    $link.Add_Click({
        param($sender, $e)
        [System.Diagnostics.Process]::Start('cmd.exe', "/c start $($sender.Tag)") | Out-Null
    })
    $urlPanel.Controls.Add($link)
    $yPos += 28
}

# State
$form.Tag = @{ running = $false; pids = @{} }

# Helper Functions
function AddLog {
    param([string]$msg)
    $time = Get-Date -Format "HH:mm:ss"
    $logBox.AppendText("[$time] $msg`n")
    $logBox.ScrollToCaret()
}

function StartAllServices {
    $actionBtn.Text = 'STOP ALL SERVICES'
    $actionBtn.BackColor = [System.Drawing.Color]::FromArgb(218, 54, 51)
    $statusLabel.Text = 'Starting services...'
    $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(63, 185, 80)
    $statusLabel.BackColor = [System.Drawing.Color]::FromArgb(46, 160, 67, 38)
    $logBox.Clear()
    
    AddLog "Cleaning up old processes..."
    taskkill /F /IM cloudflared.exe 2>$null
    taskkill /F /IM pocketbase.exe 2>$null
    taskkill /F /IM node.exe 2>$null
    Start-Sleep -Seconds 1
    
    AddLog "[1/3] Starting PocketBase on port 8091..."
    $pb = Start-Process -FilePath "D:\PB\pocketbase.exe" -ArgumentList "serve","--http=0.0.0.0:8091","--dev" -WindowStyle Hidden -PassThru
    $form.Tag.pids['pocketbase'] = $pb.Id
    AddLog "  PocketBase started (PID: $($pb.Id))"
    Start-Sleep -Seconds 2
    
    AddLog "[2/3] Starting Vite dev server on port 5173..."
    $vite = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","start /B npm.cmd run dev" -WorkingDirectory "D:\review-system-new - codex" -WindowStyle Hidden -PassThru
    $form.Tag.pids['vite'] = $vite.Id
    AddLog "  Vite started"
    Start-Sleep -Seconds 2
    
    AddLog "[3/3] Starting Cloudflare Tunnel..."
    $tunnel = Start-Process -FilePath "D:\PB\cloudflared.exe" -ArgumentList "--no-autoupdate","tunnel","--config","D:\PB\tunnel-teamrate.toml","run" -WindowStyle Hidden -PassThru
    $form.Tag.pids['tunnel'] = $tunnel.Id
    AddLog "  Tunnel started (PID: $($tunnel.Id))"
    Start-Sleep -Seconds 2
    
    AddLog "All services started!"
    $statusLabel.Text = 'All Services Running'
    $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(63, 185, 80)
    $form.Tag.running = $true
}

function StopAllServices {
    $actionBtn.Text = 'START ALL SERVICES'
    $actionBtn.BackColor = [System.Drawing.Color]::FromArgb(35, 134, 54)
    $statusLabel.Text = 'Stopping services...'
    $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(248, 81, 73)
    $statusLabel.BackColor = [System.Drawing.Color]::FromArgb(248, 81, 73, 38)
    $logBox.Clear()
    
    AddLog "Stopping all services..."
    $pids = $form.Tag.pids
    foreach ($entry in $pids.GetEnumerator()) {
        $name = $entry.Key
        $pidVal = $entry.Value
        try {
            Stop-Process -Id $pidVal -Force -ErrorAction Stop
            AddLog "  Killed $name (PID: $pidVal)"
        } catch {
            AddLog "  $name (PID: $pidVal) not found, skipping"
        }
    }
    
    taskkill /F /IM cloudflared.exe 2>$null
    taskkill /F /IM pocketbase.exe 2>$null
    taskkill /F /IM node.exe 2>$null
    
    Start-Sleep -Seconds 1
    AddLog "All services stopped."
    $statusLabel.Text = 'All Services Stopped'
    $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(248, 81, 73)
    $statusLabel.BackColor = [System.Drawing.Color]::FromArgb(248, 81, 73, 38)
    $form.Tag.running = $false
    $form.Tag.pids.Clear()
}

# Button Click Handler
$actionBtn.Add_Click({
    if ($form.Tag.running) {
        StopAllServices
    } else {
        StartAllServices
    }
})

[System.Windows.Forms.Application]::Run($form)
