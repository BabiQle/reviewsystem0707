# Free deployment guide

This project can run with a free frontend deployment and a local PocketBase backend.

## Frontend

- Host the Vite app on Vercel Hobby.
- Build command: `npm run build`
- Output directory: `dist`
- Production environment variable: `VITE_PB_URL`

`VITE_PB_URL` must point to the public HTTPS URL for PocketBase.

## PocketBase

For a zero-cost setup, keep PocketBase running on this computer and expose it with Cloudflare Tunnel.

Important limits:

- This computer must stay powered on.
- PocketBase must keep running.
- If the computer sleeps, disconnects, or the tunnel stops, the public app cannot load backend data.

## Local script environment

Maintenance scripts read these variables:

```powershell
$env:PB_URL = "http://127.0.0.1:8091"
$env:PB_ADMIN_EMAIL = "admin@example.com"
$env:PB_ADMIN_PASSWORD = "your-password"
```

For the public app, use the Cloudflare Tunnel URL instead:

```powershell
$env:VITE_PB_URL = "https://your-pocketbase-tunnel.example.com"
```

## Backup

Keep regular copies of the local PocketBase `pb_data` directory. The free local-backend setup does not protect data if the local disk fails.
