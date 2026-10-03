# DEPLOYMENT — DRISHTI-NAV UGV

## 1. Deployment Philosophy
The perception, SLAM, safety, planning, and motor-control loop runs on the **edge computer**.

This is the recommended full-free hackathon deployment because it:
- avoids paid GPU hosting;
- avoids free-cloud cold starts;
- avoids camera-upload latency;
- works without Internet;
- keeps safety local.

The web UI can be local or deployed as a free static site.

---

## 2. Recommended Environment

### Edge OS
Recommended:
- Ubuntu 24.04 LTS or a ROS2-supported Ubuntu environment.

### Robotics
- ROS 2 Jazzy or newer supported release
- Nav2
- selected SLAM engine

### Backend
- Python 3
- FastAPI
- Uvicorn
- OpenCV
- WebRTC library such as `aiortc`
- SQLite

### Frontend
- Node.js 20+
- React/Vite/TypeScript

### GPU
Optional but preferred:
- NVIDIA GPU + compatible CUDA stack.

CPU/replay fallback must remain available.

---

## 3. Environment Variables

Example `.env.example`:

```env
APP_ENV=development
EDGE_HOST=0.0.0.0
EDGE_PORT=8000
FRONTEND_ORIGIN=http://localhost:5173

ROS_DOMAIN_ID=42

CAMERA_SOURCE=0
CAMERA_WIDTH=1280
CAMERA_HEIGHT=720
CAMERA_FPS=30

MODEL_PATH=./models/terrain_segmentation.onnx
MODEL_DEVICE=auto
INFERENCE_SIZE=640
PERCEPTION_CONFIDENCE=0.35

SAFETY_GREEN_THRESHOLD=0.75
SAFETY_RED_THRESHOLD=0.50
MAX_LINEAR_VELOCITY=0.8
MAX_ANGULAR_VELOCITY=1.0

DATABASE_PATH=./data/drishtinav.db
EVIDENCE_DIR=./data/missions

ENABLE_GNSS_VALIDATION=false
ENABLE_REMOTE_CONTROL=false
AUTH_TOKEN=
```

Never commit a real auth token.

---

## 4. Local Development

### Terminal 1 — ROS2
```bash
source /opt/ros/jazzy/setup.bash
cd ros2_ws
colcon build --symlink-install
source install/setup.bash
ros2 launch drishtinav_bringup live.launch.py
```

### Terminal 2 — Edge API
```bash
cd edge_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Terminal 3 — Frontend
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open:
```text
http://localhost:5173
```

---

## 5. One-Command Demo Script
Create:

```bash
./scripts/run_demo.sh
```

It should:
1. check ROS environment;
2. check camera;
3. check model file;
4. create data directories;
5. launch ROS2 stack;
6. launch FastAPI;
7. launch frontend or static server;
8. print URLs;
9. print health endpoint.

Do not hide failed checks.

---

## 6. Replay Mode

Example:

```bash
./scripts/run_demo.sh --mode replay --input ./data/samples/outdoor_run_01
```

Replay mode must visibly show `REPLAY`.

---

## 7. Simulation Mode

Example:

```bash
./scripts/run_demo.sh --mode simulation
```

The dashboard must visibly show `SIMULATION`.

---

## 8. Free Frontend Deployment — Cloudflare Pages

Build:

```bash
cd frontend
npm ci
npm run build
```

Deploy the `dist/` folder using Cloudflare Pages.

Set the frontend environment variable for the edge API URL if remote access is required.

Cloudflare Pages can host the static dashboard; it must not become responsible for autonomy.

---

## 9. Free Frontend Alternative — Vercel

Deploy the Vite frontend as a static application.

Recommended configuration:
- Build command: `npm run build`
- Output directory: `dist`

Do not move the real-time ROS/CV pipeline into serverless functions.

---

## 10. Public Demo of Local Edge Backend — Cloudflare Quick Tunnel

For temporary judging/demo access:

```bash
cloudflared tunnel --url http://localhost:8000
```

Cloudflare prints a temporary public URL.

Important:
- the URL exists only while `cloudflared` is running;
- use for demo/development;
- autonomy continues locally if the tunnel disappears.

For a stable hostname, configure a named Cloudflare Tunnel.

---

## 11. Video
Use WebRTC between edge backend and dashboard.

Reason:
- low-latency real-time media path;
- avoids JSON/base64 overhead;
- separates video from telemetry.

If remote networking prevents peer-to-peer connectivity, add an appropriate TURN strategy for the deployment environment. The local SIH demo should not require a remote TURN service.

---

## 12. Why Not Free Cloud GPU Backend?
Do not depend on it for the final demo.

Reasons:
- free tiers may sleep;
- cold starts;
- limited CPU;
- no guaranteed GPU;
- network camera upload adds latency;
- Internet failure would break autonomy.

A free cloud service may host:
- docs;
- static UI;
- optional read-only metadata.

---

## 13. Render
If Render is used, restrict it to non-critical APIs or a fallback demonstration API.

Do not use a sleeping free instance for:
- live camera inference;
- SLAM;
- motor control;
- safety logic.

---

## 14. Hugging Face Spaces
Use only if it fits the current account/compute restrictions and is needed for a separate model showcase.

Do not depend on a hosted Space for UGV control.

---

## 15. Windows Development Option
If developing on Windows:
- use WSL2 Ubuntu for ROS2/backend where practical;
- verify USB camera pass-through;
- verify NVIDIA CUDA inside WSL2 if using GPU;
- keep a native Windows camera test tool for hardware debugging.

For final robotics integration, native Ubuntu usually reduces ROS/device complexity.

---

## 16. Network Layout

Recommended local demo:

```text
UGV Camera/Sensors
       │
       ▼
Edge Laptop/Computer
  ├─ ROS2
  ├─ Perception
  ├─ SLAM
  ├─ Nav2
  ├─ Safety
  ├─ FastAPI
  └─ WebRTC
       │
       ├── Local Wi-Fi/LAN ──► Operator Browser
       │
       └── Optional Tunnel ──► Remote Viewer
```

---

## 17. Production Build Checklist
- [ ] camera calibration valid
- [ ] model file found
- [ ] ROS transforms valid
- [ ] SLAM starts
- [ ] costmap updates
- [ ] planner returns path
- [ ] E-STOP tested
- [ ] camera unplug test passed
- [ ] Internet unplug test passed
- [ ] GNSS disabled test passed
- [ ] mission logging works
- [ ] frontend build succeeds
- [ ] `.env.example` complete
- [ ] no secrets in repository
- [ ] demo replay available
- [ ] health endpoint green
- [ ] known limitations documented

---

## 18. Performance Tuning Checklist
- keep latest inference frame only;
- pre-load and warm model;
- use GPU/ONNX/TensorRT when available;
- avoid annotated-video re-encoding if browser overlays can be used;
- use WebRTC;
- send compact telemetry;
- tune image resolution;
- profile p50/p95 latency;
- disable unnecessary debug rendering during final run;
- record logs asynchronously.

---

## 19. Official References
- Nav2: https://docs.nav2.org/
- ROS2: https://docs.ros.org/
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/
- Cloudflare Pages: https://www.cloudflare.com/developer-platform/products/pages/
- Cloudflare Tunnel: https://developers.cloudflare.com/tunnel/
- WebRTC API: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- Render free-service behavior: https://render.com/docs/
- Hugging Face Spaces: https://huggingface.co/docs/hub/en/spaces-overview
