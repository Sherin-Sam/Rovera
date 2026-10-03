# ROVERA

An edge-first navigation command center for the **Vision-First Autonomous Navigation / SIH** project. React + TypeScript frontend, FastAPI backend, SQLite evidence, deterministic metric simulation, and real OpenCV bench-camera diagnostics.

## Start here

Prerequisites: **Python 3.12** and **Node.js 22+**. The first launch downloads open-source dependencies; later runs can be offline.

**Windows PowerShell**, from this project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

**Ubuntu/macOS**:

```bash
bash scripts/start.sh
```

Open **http://127.0.0.1:8000**. API documentation: **http://127.0.0.1:8000/docs**.

After the initial install, use `-SkipInstall` on Windows or `--skip-install` on Linux. Stop with Ctrl+C. No account, credit card, paid API, cloud GPU, or Docker is required for local operation.

## What works

- Eight console views: Mission Control, Spatial Mapping, Terrain Intelligence, Planner & Costmap, Mission Replay, System Health, Calibration, Settings. Light and dark themes persist across reloads.
- Four selectable environments: woodland trail, campus crossing, construction site, and industrial yard. Each has matching map surfaces, 3D scenery, and class-specific obstacle geometry.
- Interactive spatial map with zoom, drag-to-pan, fit-to-world, rover centering, object inspection, labels, route history, and clearance layers.
- Simulated object tags show class, stable object ID, and distance. Field-of-view, range, and approximate occlusion determine detections; new detections appear in the obstacle panel, event log, and notifications.
- Return to base replans to the home station and stops on arrival; faults, E-STOP, and blocked paths prevent unsafe starts.
- Create a named mission by clicking the local map or entering a goal; start, pause, resume, cancel, and complete it.
- Deterministic 2D dynamics, A* routing, obstacle inflation, no diagonal corner cutting, and measured planning latency.
- A procedural 3D **simulation** camera view driven by the same world and pose as the backend. This is visualization, not camera perception.
- Inject an obstacle and inspect the changed route; inject camera/SLAM failure and observe immediate simulation stop, recovery, and replanning; low-light scenario reduces speed.
- Latched simulation E-STOP, explicit reset, restart persistence, and the **Escape** shortcut.
- SQLite mission/event/telemetry recording, synchronized trajectory and event replay, complete paginated JSON export, persisted settings.
- Real CPU/RAM/disk values from the API host; unavailable GPU/battery/temperature readings are not invented.
- Browser camera preview with real backend OpenCV exposure measurements, ORB feature detection, and CLAHE feature comparison. Images are analyzed at 640 px width with one request in flight and discarded afterward.
- Validation and storage of measured camera-intrinsics JSON, clearly marked **imported / unverified**.
- Reconnecting telemetry WebSocket, connection-staleness warnings, input validation, CORS restriction, token support, and remote read-only defaults.

## Honest build boundary

**This is a working simulation and bench diagnostics application, not a validated physical autonomous rover.** The supplied documents are the full product requirements, preserved in `docs/requirements/`. They are not evidence that every robotics module has been implemented.

The following require further integration and hardware validation: trained terrain segmentation, metric visual SLAM / loop closure, Nav2, Gazebo, ROS-to-dashboard telemetry, motor drivers, dynamic-obstacle velocity tracking, depth/3D reconstruction, WebRTC camera transport, camera calibration solving, video/rosbag synchronization, waypoint queues, manual driving, and real-UGV benchmarks. The simulator is a deterministic Python world, **not Gazebo**. Real camera diagnostics do not influence simulation confidence or pose. No command from this application can drive hardware.

See [implementation status](docs/IMPLEMENTATION_STATUS.md), [hardware integration](docs/HARDWARE.md), and [free deployment](DEPLOYMENT.md).

## Project layout

```text
frontend/                 React + TypeScript, Three.js simulation view, responsive CSS
edge_backend/app/         API, deterministic engine, A* planner, real bench diagnostics
edge_backend/tests/       Safety, planner, persistence, image processing, API tests
scripts/                  Windows/Linux startup, health check, measured benchmark
docs/requirements/        All seven original supplied documents
docs/                     Architecture, API, test plan, demo script, hardware contract
config/                   Integration reference configuration
ros2_ws/                  Optional independent safety-gate ROS package (unverified here)
data/                     Local SQLite database and future evidence storage
Dockerfile                Multi-stage frontend + API build
docker-compose.yml        Optional token-protected local Docker deployment
```

## Development

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r edge_backend/requirements-dev.txt
npm ci --prefix frontend
# Terminal 1
.\.venv\Scripts\python -m uvicorn app.main:app --app-dir edge_backend --host 127.0.0.1 --port 8000 --no-proxy-headers
# Terminal 2
npm run dev --prefix frontend
```

Development UI: http://127.0.0.1:5173. Vite proxies `/api` and `/ws` to the backend. Unix equivalent: use `.venv/bin/python`.

## Verification

```powershell
$env:PYTHONPATH = 'edge_backend'
.\.venv\Scripts\python -m pytest edge_backend/tests -q
npm test --prefix frontend
npm run build --prefix frontend
.\.venv\Scripts\python scripts/benchmark.py
python scripts/healthcheck.py
```

On Unix: `PYTHONPATH=edge_backend .venv/bin/python -m pytest edge_backend/tests -q`.

## Data and operator access

SQLite lives in `data/drishtinav.db`. Back up the database using SQLite's backup API while the server runs, or stop it before copying the database and its WAL files. Existing open missions become `INTERRUPTED` after a process restart; they never resume motion automatically. E-STOP remains latched across restarts.

For tokens and network settings, copy `.env.example` to `.env`. Keep `.env` private. The token is entered through **Settings → Connection**, stored in browser session storage, and is never embedded into a static frontend build. Local anonymous writes are allowed only for loopback clients without forwarded headers and with an allowed Origin (when supplied). Public reads expose mission data; use only synthetic/non-sensitive data on public demo URLs.
