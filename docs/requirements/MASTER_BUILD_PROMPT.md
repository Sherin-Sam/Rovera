# MASTER BUILD PROMPT — DRISHTI-NAV UGV

## Role
Act as a senior autonomous-robotics engineer, ROS2 architect, computer-vision engineer, safety engineer, and full-stack product developer. Build a complete, deployment-ready software system named **DRISHTI-NAV UGV — Vision-First Autonomous Navigation for GPS-Denied Outdoor Environments**.

The application is for an SIH problem statement from Bharat Electronics Limited (BEL). It must demonstrate a realistic outdoor UGV navigation stack where **camera vision is the primary navigation sensor**.

Do not build a fake dashboard. Do not fill the UI with random telemetry. Every live value must come from a real device, real algorithm output, a recorded ROS bag/video replay, or a clearly labeled simulation source.

---

# 1. PROBLEM TO SOLVE

Outdoor UGVs must travel from Point A to Point B in environments where GPS can be blocked, jammed, spoofed, or intentionally unavailable.

The software must solve:

1. **Path Detection**
   - Identify traversable terrain.
   - Identify obstacles/hazards such as rocks, trees, walls, vegetation, potholes, ditches, people, vehicles, and non-traversable terrain.
   - Generate a safe-terrain mask and terrain confidence.

2. **Visual Localization**
   - Estimate UGV position and orientation using camera frames.
   - Maintain local map coordinates without depending on GPS.
   - Support loop closure/relocalization.
   - Report drift/confidence.

3. **Collision Avoidance**
   - Generate a local/global costmap.
   - Re-plan when new obstacles appear.
   - Produce safe linear and angular velocity commands.
   - Trigger safety behavior when perception or localization becomes unreliable.

4. **Outdoor Robustness**
   - Handle sun glare, shadows, overexposure, underexposure, motion blur, rain-like visual noise, and abrupt lighting transitions.

---

# 2. PRODUCT VISION

Build a jury-ready autonomous navigation command center with:

- real-time camera feed;
- traversable-path segmentation;
- obstacle overlay;
- visual SLAM trajectory;
- 2D costmap;
- 3D point-cloud/map view when depth/stereo data is available;
- destination/waypoint mission planning;
- real-time replanning;
- autonomous / assisted / manual modes;
- fail-safe Stop-and-Scan recovery;
- localization confidence and drift indicators;
- low-latency telemetry;
- mission replay and evidence logs;
- optional real GNSS shown only as ground truth / mission-start anchor, never as the required navigation input.

The final product must look like an industrial robotics console, not a generic AI dashboard.

---

# 3. UNIQUE FEATURES TO IMPLEMENT

## A. Vision Confidence Guardian
Create a fused safety confidence score from:
- segmentation confidence;
- number of SLAM feature matches;
- visual odometry tracking state;
- optical-flow stability;
- camera exposure state;
- frame age;
- map consistency.

States:
- GREEN: normal autonomous navigation;
- AMBER: reduce speed and increase scan frequency;
- RED: stop vehicle, scan environment, relocalize, then continue only if confidence recovers.

## B. Adaptive Lighting Normalization
Before perception/SLAM:
- detect underexposure/overexposure;
- apply CLAHE/gamma correction where useful;
- maintain original frame for evidence;
- compare raw vs normalized confidence;
- automatically choose the better frame path.

Show:
- Exposure: Good / Dark / Glare;
- enhancement active/inactive;
- confidence change.

## C. Stop → Scan → Relocalize → Replan
When localization confidence is low:
1. command zero velocity;
2. rotate or pan the perception field if hardware supports it;
3. collect keyframes;
4. attempt relocalization / loop closure;
5. rebuild local costmap;
6. replan;
7. resume only if safety score passes threshold.

## D. Terrain Risk Map
Do not use only binary free/blocked classes.
Assign traversability risk:
- Safe;
- Caution;
- High Risk;
- Blocked.

Use slope/depth if available, segmentation, texture, obstacle proximity, and temporal stability.

## E. Dynamic Obstacle Memory
Track moving obstacles across frames.
Maintain short-term obstacle velocity and direction.
Increase costmap inflation in the predicted movement direction.
Expire stale tracks automatically.

## F. Drift Guardian
Track:
- distance since last loop closure;
- SLAM covariance/quality when available;
- map-to-odom divergence;
- visual feature count;
- cumulative estimated drift indicator.

Warn operator before localization failure.

## G. Dual-Frame Position View
Show both:
1. **Navigation frame**: real local SLAM coordinates in meters (x, y, yaw).
2. **Geospatial frame**: optional real GNSS or browser/device location used only as:
   - start anchor;
   - validation/ground truth;
   - operator map reference.

If GNSS disappears, the navigation system must continue in local SLAM coordinates.

## H. Explainable Route Overlay
For every replanning event show:
- obstacle that caused replan;
- old route;
- new route;
- local safety margin;
- selected planner;
- reason code.

## I. Mission Evidence Recorder
Save:
- mission metadata;
- trajectory;
- perception events;
- planner events;
- emergency stops;
- confidence changes;
- frame timestamps;
- selected snapshots;
- optional rosbag path.

Allow replay from the dashboard.

## J. Graceful Degradation
If:
- segmentation fails → use geometry/depth/costmap fallback if available;
- SLAM temporarily degrades → slow/stop and relocalize;
- internet fails → continue fully on edge;
- cloud dashboard fails → UGV safety loop continues;
- GNSS is unavailable → no impact on autonomous navigation.

---

# 4. REQUIRED OPERATING MODES

### Live UGV Mode
Uses real camera + optional IMU/wheel odometry + real motor controller.

### Bench Camera Mode
Uses a laptop/webcam/USB camera for perception and SLAM testing without motors.

### Recorded Replay Mode
Uses MP4/ROS bag datasets for deterministic judging and debugging.

### Simulation Mode
Uses Gazebo/compatible ROS2 simulation.
Every simulated value must display a visible `SIMULATION` badge.

---

# 5. RECOMMENDED TECH STACK

## Edge Robotics
- ROS 2 Jazzy or a newer supported ROS2 release
- Nav2
- Python 3 for AI/control glue
- C++ for latency-sensitive ROS nodes if required
- OpenCV
- PyTorch / ONNX Runtime
- CUDA/TensorRT acceleration when NVIDIA GPU is available

## Perception
Default:
- lightweight YOLO segmentation model such as YOLO11n-seg or equivalent;
- custom traversable-terrain classes;
- temporal smoothing.

Optional:
- FastSAM for experimentation, not as the only production path.

## Visual Localization
Primary implementation:
- RTAB-Map visual SLAM for stereo/RGB-D and ROS2-friendly mapping;
or
- ORB-SLAM3 for monocular/stereo/visual-inertial experiments.

Prefer stereo or visual-inertial input for metric scale in the final hardware demo.

## Navigation
- Nav2 costmaps
- global planner: A* / NavFn / Smac planner as appropriate
- local controller: MPPI or Regulated Pure Pursuit / DWB based on rover kinematics
- behavior tree for recovery logic

## Web Backend
- FastAPI
- ROS2 telemetry bridge
- WebSocket for small telemetry/events only
- WebRTC for live video
- SQLite for mission/event logs
- local filesystem for evidence and rosbag references

## Frontend
- React + Vite + TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand or equivalent lightweight state store
- MapLibre GL JS for map view
- Three.js for optional point-cloud / 3D trajectory view
- Recharts/ECharts for telemetry plots

---

# 6. LOW-LATENCY CAMERA RULES

Do NOT stream base64 JPEG frames through normal WebSocket telemetry.

Use:
- WebRTC for video;
- separate telemetry WebSocket;
- timestamp every frame;
- latest-frame queue size = 1 for inference;
- drop stale frames instead of building backlog;
- decouple camera capture FPS, inference FPS, and dashboard rendering FPS;
- use async worker/process for inference;
- pre-load the model at startup;
- warm up inference;
- use 640px-class inference input by default;
- dynamically reduce inference rate under load;
- keep display stream smooth even if inference runs at a lower FPS;
- return detections as compact metadata overlays, not re-encoded annotated video where possible.

Dashboard must expose:
- camera FPS;
- inference FPS;
- inference latency;
- end-to-end frame age;
- dropped-frame count;
- CPU/GPU usage;
- ROS latency.

---

# 7. REAL SENSOR / REAL DATA RULES

Use actual integrations where available:

### Camera
- `/dev/video*`, OpenCV capture, GStreamer, ROS image topic, or browser camera depending on mode.

### IMU
- ROS `sensor_msgs/Imu`.

### Wheel Odometry
- ROS `nav_msgs/Odometry`.

### GNSS
- ROS `sensor_msgs/NavSatFix` or browser Geolocation.
- GNSS must be marked `GROUND TRUTH / ANCHOR`, not `NAVIGATION SOURCE`.

### Motor Commands
- publish ROS `geometry_msgs/Twist` or adapter-specific command.
- include software emergency stop.

### Battery/System Health
- use real system/device values when available.
- if unavailable show `N/A`, not invented percentages.

---

# 8. ROS2 MODULES

Create modular nodes/packages:

- `camera_node`
- `image_normalizer_node`
- `terrain_perception_node`
- `dynamic_obstacle_tracker_node`
- `visual_slam_adapter`
- `terrain_costmap_node`
- `safety_supervisor_node`
- `mission_manager_node`
- `motor_bridge_node`
- `telemetry_bridge_node`
- `evidence_recorder_node`

Core topics should include or map to:

- `/camera/image_raw`
- `/camera/image_normalized`
- `/perception/segmentation`
- `/perception/obstacles`
- `/perception/traversability`
- `/odom`
- `/slam/pose`
- `/slam/status`
- `/map`
- `/local_costmap/costmap`
- `/global_costmap/costmap`
- `/plan`
- `/cmd_vel`
- `/safety/state`
- `/mission/state`
- `/telemetry/system`
- `/gps/fix_optional`

---

# 9. SAFETY STATE MACHINE

Implement:

`IDLE`
→ `READY`
→ `AUTONOMOUS_NAVIGATION`
→ `CAUTION_SLOW`
→ `STOP_AND_SCAN`
→ `RELOCALIZING`
→ `REPLANNING`
→ `AUTONOMOUS_NAVIGATION`

Emergency state:
`EMERGENCY_STOP`

The emergency stop must:
- immediately publish zero motion command;
- latch until operator explicitly resets it;
- remain available even if AI inference fails.

---

# 10. APPLICATION SCREENS

## Screen 1 — Mission Control
Main jury/demo screen.

Layout:
- top global status strip;
- left mission controls;
- center live camera;
- right safety/confidence panel;
- bottom tab panel for Map / Costmap / 3D / Telemetry.

Must display:
- live camera;
- segmented traversable path;
- obstacles and confidence;
- destination;
- live planned route;
- current UGV pose;
- current velocity;
- autonomy mode;
- SLAM tracking state;
- safety state;
- FPS/latency;
- E-STOP.

## Screen 2 — SLAM & Localization
- trajectory;
- keyframes;
- loop-closure events;
- pose x/y/yaw;
- feature count;
- confidence;
- drift warning;
- optional GNSS-vs-SLAM validation plot.

## Screen 3 — Terrain Intelligence
- raw frame;
- normalized frame;
- segmentation mask;
- terrain classes;
- risk legend;
- hazard list;
- confidence history.

## Screen 4 — Planner & Costmap
- global costmap;
- local costmap;
- old/new route during replan;
- obstacle inflation;
- planner execution time;
- distance-to-goal;
- path length.

## Screen 5 — System Health
- CPU;
- RAM;
- GPU;
- temperature if available;
- camera status;
- ROS node health;
- model loaded status;
- network status;
- frame drops;
- database/log status.

## Screen 6 — Mission Replay
Timeline scrubber with synchronized:
- video;
- trajectory;
- alerts;
- planner events;
- safety-state changes.

## Screen 7 — Calibration
- camera calibration status;
- camera intrinsics;
- stereo baseline if applicable;
- IMU alignment;
- wheel odometry scale;
- test patterns and validation results.

## Screen 8 — Settings
- model path;
- confidence threshold;
- safety threshold;
- maximum linear/angular velocity;
- planner selection;
- camera source;
- ROS namespace;
- evidence recording;
- developer mode.

---

# 11. UI STYLE

Visual direction:
- professional industrial/defense robotics console;
- dark graphite background;
- restrained use of green/amber/red only for status;
- high information density without clutter;
- squared/soft-radius control panels;
- clear typography;
- subtle grid/map texture;
- no neon cyberpunk glow;
- no fake 3D decorative robot;
- no random gradients;
- no meaningless animated charts.

The UI must be useful outdoors:
- large critical controls;
- high contrast;
- readable at 1366×768;
- responsive for tablet;
- E-STOP always visible.

---

# 12. API CONTRACT

Implement FastAPI endpoints similar to:

- `GET /api/health`
- `GET /api/system`
- `GET /api/mission`
- `POST /api/mission`
- `POST /api/mission/start`
- `POST /api/mission/pause`
- `POST /api/mission/resume`
- `POST /api/mission/cancel`
- `POST /api/estop`
- `POST /api/estop/reset`
- `GET /api/slam/status`
- `GET /api/perception/status`
- `GET /api/planner/status`
- `GET /api/logs/missions`
- `GET /api/logs/missions/{id}`
- `POST /api/settings`
- `GET /api/settings`
- `POST /api/calibration/camera`
- `GET /api/calibration/status`

Real-time:
- `/ws/telemetry`
- `/ws/events`

WebRTC:
- signaling endpoint for edge camera stream.

Include OpenAPI docs.

---

# 13. TELEMETRY SCHEMA

Each telemetry packet should contain timestamps and source validity.

Example structure:

```json
{
  "timestamp": "ISO-8601",
  "mode": "LIVE",
  "mission": {
    "id": "M-001",
    "state": "AUTONOMOUS_NAVIGATION",
    "distance_remaining_m": 18.2
  },
  "pose": {
    "frame": "map",
    "x_m": 4.82,
    "y_m": -1.14,
    "yaw_deg": 32.6,
    "source": "visual_slam"
  },
  "slam": {
    "tracking": "OK",
    "confidence": 0.91,
    "feature_count": 412,
    "loop_closure_recent": true
  },
  "perception": {
    "fps": 22.4,
    "latency_ms": 31,
    "traversability_confidence": 0.88,
    "hazard_count": 3
  },
  "safety": {
    "state": "GREEN",
    "score": 0.89,
    "reason": "NORMAL"
  },
  "network": {
    "telemetry_rtt_ms": 18
  },
  "source_validity": {
    "camera": true,
    "imu": true,
    "gps": false
  }
}
```

Do not hardcode these example values.

---

# 14. DATA MODEL

SQLite tables:

### missions
- id
- name
- started_at
- ended_at
- mode
- status
- start_anchor_lat
- start_anchor_lon
- total_distance_m
- collision_count
- emergency_stop_count

### telemetry_samples
- id
- mission_id
- timestamp
- pose_x
- pose_y
- yaw
- linear_velocity
- angular_velocity
- slam_confidence
- perception_confidence
- safety_score

### events
- id
- mission_id
- timestamp
- type
- severity
- reason_code
- message
- metadata_json

### snapshots
- id
- mission_id
- timestamp
- image_path
- event_id
- label

### configuration
- key
- value
- updated_at

---

# 15. REPOSITORY STRUCTURE

```text
drishtinav-ugv/
├─ README.md
├─ docker-compose.yml
├─ .env.example
├─ docs/
│  ├─ PRD.md
│  ├─ TECH_ARCHITECTURE.md
│  ├─ UI_UX.md
│  ├─ WORKFLOW.md
│  ├─ DEPLOYMENT.md
│  ├─ API.md
│  ├─ TEST_PLAN.md
│  └─ SIH_DEMO_SCRIPT.md
├─ frontend/
│  ├─ src/
│  ├─ public/
│  ├─ package.json
│  └─ vite.config.ts
├─ edge_backend/
│  ├─ app/
│  ├─ requirements.txt
│  ├─ Dockerfile
│  └─ tests/
├─ ros2_ws/
│  └─ src/
│     ├─ drishtinav_perception/
│     ├─ drishtinav_safety/
│     ├─ drishtinav_mission/
│     ├─ drishtinav_telemetry/
│     └─ drishtinav_motor_bridge/
├─ models/
│  └─ README.md
├─ config/
│  ├─ nav2_params.yaml
│  ├─ camera.yaml
│  └─ safety.yaml
├─ scripts/
│  ├─ setup.sh
│  ├─ start_edge.sh
│  ├─ start_dashboard.sh
│  ├─ run_demo.sh
│  └─ healthcheck.sh
└─ data/
   ├─ missions/
   ├─ logs/
   └─ samples/
```

---

# 16. DEPLOYMENT DESIGN — FULL FREE DEMO PATH

## Primary hackathon deployment
Run the full AI/SLAM/navigation backend on the edge computer/laptop.

This is mandatory because:
- it works without internet;
- it avoids free-cloud cold starts;
- it avoids uploading every camera frame;
- it keeps motor control local;
- it reduces latency;
- it respects the GPS-denied/offline nature of the problem.

## Frontend
Deploy static React build to one of:
1. Cloudflare Pages Free;
2. Vercel Hobby/static deployment;
3. local edge server for fully offline judging.

## Remote demo
Use Cloudflare Tunnel / Quick Tunnel to expose the local dashboard/API for a temporary demo.
Remote access must be optional; navigation must never depend on the tunnel.

## Do not
- host real-time CV inference on a sleeping free web service;
- send motor-control decisions through the public cloud;
- make Internet availability a mission dependency.

---

# 17. PERFORMANCE TARGETS

Design targets, configurable by hardware:

- camera display: smooth 20–30 FPS where source permits;
- perception inference: ≥15 FPS target on supported GPU, degrade gracefully on CPU;
- perception latency: target <80 ms;
- telemetry update: 10–20 Hz;
- safety stop decision: <150 ms from validated hazard event where practical;
- local replanning: target <500 ms;
- stale-frame backlog: zero; stale frames must be dropped;
- collision-free test success: record every run;
- SLAM drift: measure, display, and log rather than hiding it.

Do not fabricate performance numbers. Add benchmark scripts.

---

# 18. TESTING

Implement:
- backend unit tests;
- API tests;
- frontend component tests;
- ROS node health tests;
- camera-loss test;
- SLAM-loss test;
- sudden-obstacle test;
- low-light test;
- glare test;
- network-disconnect test;
- emergency-stop test;
- corrupted-frame test;
- replay determinism test.

Add a `/demo` route or demo configuration that can load recorded evidence without pretending it is live.

---

# 19. ACCEPTANCE CRITERIA

The build is complete only when:

1. Camera feed is real or explicitly labeled replay/simulation.
2. Perception produces traversability + obstacle outputs.
3. Visual localization publishes a real pose estimate.
4. A destination can be selected.
5. Costmap and route are visible.
6. New obstacles can trigger replan.
7. Safety supervisor can stop the UGV.
8. Stop-and-Scan recovery is implemented.
9. GNSS can be disabled without breaking autonomous navigation.
10. Mission logs persist locally.
11. The frontend can run offline against the edge backend.
12. `DEPLOYMENT.md` contains copy-paste startup/deployment steps.
13. `.env.example` is complete.
14. No secret/API key is committed.
15. The repository has a one-command demo path where practical.
16. Errors are shown clearly in the UI instead of silently substituting fake data.

---

# 20. FINAL OUTPUT REQUIRED FROM THE CODING AGENT

Generate the complete repository, not mockups.

At the end, provide:
- build status;
- exact files created;
- exact commands to install;
- exact commands to start ROS/backend/frontend;
- exact commands for replay mode;
- exact commands for simulation mode;
- exact free frontend deployment steps;
- exact Cloudflare Tunnel demo steps;
- known limitations;
- hardware assumptions;
- benchmark procedure;
- SIH jury demo sequence;
- future production improvements.

Never claim that a module is complete if it is only a placeholder.
