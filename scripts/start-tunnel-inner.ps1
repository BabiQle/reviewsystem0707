 = [System.IO.Path]::Combine(, 'tunnel-teamrate.toml')
 = [System.IO.Path]::Combine(, "cloudflared.exe")
Start-Process -FilePath  -ArgumentList "--no-autoupdate","tunnel","--config",,"run" -WindowStyle Hidden
