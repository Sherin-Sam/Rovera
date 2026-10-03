# Free deployment guide

The recommended no-hosting-fee plan is **one edge laptop serving both frontend and backend**. Hosting is free in the sense of no cloud service bill; your computer, electricity, and Internet connection are still yours. Physical SLAM/CV inference must stay on the edge machine.

## 1. Easiest: fully local, one command

Install Python 3.12 and Node.js 22+. Open a terminal in this project folder.

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

Ubuntu/macOS:

```bash
bash scripts/start.sh
```

Open **http://127.0.0.1:8000**. This includes the actual frontend build, FastAPI, WebSocket telemetry, simulation engine, and SQLite. No separate frontend server is needed. The startup script fails visibly on an installation/build error. Reuse downloaded packages with `-SkipInstall` / `--skip-install`. After the first build, the dashboard has no external assets or map-tile dependencies.

## 2. Optional Docker

Create `.env` from `.env.example`, and set a strong random `AUTH_TOKEN`. For example, generate one with `python -c "import secrets; print(secrets.token_urlsafe(32))"` and paste it locally into `.env` (never commit it).

```bash
docker compose up --build -d
docker compose logs -f
```

Open http://127.0.0.1:8000, then enter that token in Settings → Connection. The compose file binds the host port to **127.0.0.1**. Container network clients require token authentication, so `ENABLE_REMOTE_CONTROL=true` is set inside this Docker profile. Do not put this control-enabled profile behind a public tunnel. For a public read-only Docker preview, explicitly override `ENABLE_REMOTE_CONTROL=false` and rebuild/recreate; writes will be disabled even with a token.

Data persists in the `mission-data` Docker volume. `docker compose down` preserves it. Do not use `down -v` unless deliberately deleting evidence. Docker daemon/build execution was not verified in this workspace.

## 3. Free public demo: tunnel the complete local app

Use the native startup path in section 1. In `.env`, keep:

```env
ENABLE_REMOTE_CONTROL=false
```

Install `cloudflared` from Cloudflare's official distribution. Run:

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

Copy the printed HTTPS `trycloudflare.com` address. Add that exact origin to `FRONTEND_ORIGINS` in `.env`, retaining the localhost origins, then restart the API. This allows that browser's telemetry WebSocket. All forwarded writes remain blocked. Operate missions in your local browser; remote viewers can watch.

The tunnel is optional and temporary. The laptop and `cloudflared` must remain on. A tunnel outage does not stop the local simulator or delete evidence. Quick Tunnels have no uptime guarantee, support up to 200 in-flight requests, and do not support Server-Sent Events. This app uses WebSockets. See [Cloudflare Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) (checked October 1, 2026).

Public telemetry, events, and mission exports are read-accessible in this version. Publish only synthetic/non-sensitive demos. Use a separate authenticated access gateway for private camera or field data; do not expose a physical robot with this simulation application.

## 4. Optional free static frontend: Cloudflare Pages

This is useful for a stable UI URL. It does **not** move Python, SQLite, or robotics workloads into Cloudflare. The edge laptop and HTTPS API must still be available. For the least setup, use section 3 instead.

1. Create a Cloudflare account and choose **Workers & Pages → Create → Pages → Direct Upload**.
2. Start the API tunnel from section 3.
3. Build using its actual HTTPS URL:

```powershell
$env:VITE_API_URL = 'https://YOUR-TUNNEL.trycloudflare.com'
npm ci --prefix frontend
npm run build --prefix frontend
```

Linux equivalent:

```bash
VITE_API_URL=https://YOUR-TUNNEL.trycloudflare.com npm run build --prefix frontend
```

4. Upload **frontend/dist/** to Cloudflare Pages. Do not upload your `.env`, database, backend, or project root.
5. Add the resulting exact `https://YOUR-PROJECT.pages.dev` origin to backend `FRONTEND_ORIGINS`; restart the backend.
6. The Pages frontend is a read-only public viewer because the API denies forwarded writes. Use localhost for simulation control.

When a Quick Tunnel URL changes, rebuild the static frontend with the new URL and re-upload. A stable API hostname requires a named tunnel and a domain you already own or purchase; it is not required for the free path. Do not connect an HTTPS static page to an HTTP localhost API: mixed-content/private-network restrictions may block it.

Cloudflare Pages currently offers free static requests, with plan limits including 500 builds per month and 20,000 files on the Free plan. No paid Functions are needed for this app. Limits can change; see [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) and [static asset pricing](https://developers.cloudflare.com/pages/functions/pricing/) (checked October 1, 2026).

## 5. Optional Vercel static deployment

The included `frontend/vercel.json` configures the Vite build. Import a repository with root directory `frontend`, set `VITE_API_URL` to the HTTPS edge endpoint, and add the resulting origin to backend CORS. Use the same read-only arrangement as Pages. Vercel's current plan eligibility and usage limits must be checked for your account before relying on it; Cloudflare/local are the documented free paths for this project.

## Environment reference

| Variable | Default / meaning |
|---|---|
| APP_MODE | SIMULATION; any other value fails startup rather than pretending to be live |
| DATABASE_PATH | data/drishtinav.db |
| FRONTEND_ORIGINS | Comma-separated exact browser origins, no wildcard |
| AUTH_TOKEN | Optional on local native loopback; mandatory for non-loopback writes |
| ENABLE_REMOTE_CONTROL | false; keep false for public viewers |
| VITE_API_URL | Build-time public API URL; empty means same-origin |

Restart the backend after editing `.env`. Rebuild the frontend after changing `VITE_API_URL`. Never set a token in a `VITE_*` variable: those values are public bundle content.

## Troubleshooting

| Symptom | Resolution |
|---|---|
| Waiting for edge backend | Start the API and visit `/api/health`; confirm port 8000 is free. |
| npm unavailable | Install Node.js 22+, reopen your terminal. |
| Python package install fails | Use Python 3.12 in a fresh virtual environment. |
| Origin denied / WebSocket disconnects | Add the exact page origin to FRONTEND_ORIGINS, restart API. |
| 401 on controls | Enter AUTH_TOKEN in Settings → Connection. |
| Public controls denied | Expected: use the local operator browser. |
| Camera permission denied | Use localhost or HTTPS and allow camera access; close other camera apps. |
| Bench frame diagnostics fail | Confirm OpenCV dependencies and operator token; no frames are queued. |
| Backend restarted after a crash | Existing mission is interrupted; create a new one. Reset a persisted E-STOP explicitly. |

## Cost summary

| Component | Cost plan |
|---|---|
| React/Vite/Three.js/FastAPI/OpenCV/SQLite | Open-source software; no service subscription |
| Complete local simulation | $0 hosting fee on your own computer |
| Cloudflare Pages static frontend | Free plan, subject to listed limits |
| Cloudflare Quick Tunnel | Free temporary demo URL; no guaranteed availability |
| Terrain model training / robot / GPU / camera | Not supplied; hardware and compute may cost money |
| Remote TURN relay, stable domain | Not required; not guaranteed free |

No deployment account was created and no site was published automatically. The project is ready for the local path; remote publication requires your own hosting account and running edge machine.
