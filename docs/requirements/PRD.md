# PRD — DRISHTI-NAV UGV

## 1. Product Name
**DRISHTI-NAV UGV — Vision-First Autonomous Navigation for GPS-Denied Outdoor Environments**

## 2. Problem Statement
Build an autonomous navigation software stack for an outdoor unmanned ground vehicle using camera feeds as the primary sensor. The vehicle must identify traversable terrain, localize without GPS, avoid obstacles, and safely navigate from Point A to Point B.

## 3. Primary Users
- BEL / defense technology evaluators
- UGV operators
- robotics engineers
- search-and-rescue operators
- industrial autonomous vehicle operators
- SIH jury/evaluation team

## 4. Product Goal
Demonstrate a complete edge-AI navigation loop:

**Camera → Perception → Visual Localization → Costmap → Path Planning → Safety Supervisor → Motor Command → Telemetry**

The application must continue working when:
- internet is unavailable;
- GNSS is unavailable;
- public dashboard connectivity fails.

## 5. Core Functional Requirements

### FR-01 Camera Input
The system shall support:
- USB/webcam;
- ROS image topic;
- stereo camera;
- video/rosbag replay;
- simulation source.

The UI shall display the active source and timestamp.

### FR-02 Traversable Path Detection
The system shall classify visible terrain into:
- safe;
- caution;
- high-risk;
- blocked.

The output shall include:
- segmentation mask;
- confidence;
- hazard regions;
- timestamp.

### FR-03 Obstacle Detection
The system shall identify static and dynamic obstacles.
Each obstacle record should include:
- class;
- confidence;
- bounding region/mask;
- approximate relative position if depth can be derived;
- track ID when tracking is enabled.

### FR-04 Adaptive Lighting
The system shall identify poor exposure and optionally process a normalized frame using CLAHE/gamma/exposure correction.

### FR-05 Visual Localization
The system shall estimate:
- x;
- y;
- orientation/yaw;
- tracking state;
- confidence/quality indicators.

### FR-06 Loop Closure / Relocalization
The system shall expose loop closure/relocalization events and maintain a recovery action when tracking degrades.

### FR-07 Local/Global Map
The system shall publish/display a 2D map/costmap.
If stereo/depth is available, the system may additionally display point-cloud/3D structure.

### FR-08 Mission Goal
The operator shall be able to:
- choose a destination;
- enter local x/y goal;
- click a map goal;
- load predefined waypoints.

### FR-09 Path Planner
The system shall produce a safe route from current pose to goal and report:
- planning time;
- path length;
- planner name;
- replan count.

### FR-10 Dynamic Replanning
When a new obstacle invalidates the active route, the system shall:
- stop/slow if required;
- update the local costmap;
- generate a replacement route;
- log the cause.

### FR-11 Safety Supervisor
The system shall provide:
- Green/Amber/Red safety state;
- hard emergency stop;
- latched emergency stop;
- Stop-and-Scan behavior;
- configurable minimum perception/localization confidence.

### FR-12 Motor Command
The edge system shall publish or expose:
- linear velocity;
- angular velocity;
- zero-velocity safety command.

### FR-13 Real Telemetry
The UI shall display:
- camera FPS;
- inference FPS;
- inference latency;
- SLAM state;
- UGV pose;
- command velocity;
- path status;
- safety state;
- CPU/RAM;
- GPU usage if available;
- dropped frames;
- network RTT;
- sensor validity.

Missing values shall display `N/A`.

### FR-14 Real GNSS Optional Validation
GNSS must be optional.
It may be used for:
- start anchor;
- geospatial display;
- ground-truth comparison;
- validation.

It must not be required by the autonomous navigation loop.

### FR-15 Mission Recording
Persist:
- trajectory;
- mission start/end;
- alerts;
- route replans;
- safety-state changes;
- confidence;
- selected evidence frames.

### FR-16 Replay Mode
The operator shall be able to replay a completed mission with synchronized video/telemetry/events.

### FR-17 Simulation Mode
Simulation values must be visibly labeled as simulation.

## 6. Unique Product Features
1. Vision Confidence Guardian
2. Stop → Scan → Relocalize → Replan
3. Adaptive Lighting Normalization
4. Terrain Risk Map
5. Dynamic Obstacle Memory
6. Drift Guardian
7. Explainable Route Replanning
8. Dual Local-SLAM + Optional Geospatial View
9. Mission Evidence Recorder
10. Graceful Degradation

## 7. Non-Functional Requirements

### NFR-01 Edge First
Primary autonomy must operate locally without cloud dependency.

### NFR-02 Real-Time
The architecture must avoid frame backlog and prioritize the newest frame.

### NFR-03 Safety
Cloud/dashboard loss must never disable local emergency behavior.

### NFR-04 Modularity
Perception, SLAM, planning, safety, telemetry, and UI must be separable modules.

### NFR-05 Observability
Every major module shall expose:
- state;
- last update time;
- error;
- latency;
- restart/recovery status.

### NFR-06 Reproducibility
The project shall include:
- dependency files;
- `.env.example`;
- configuration YAML;
- sample replay dataset instructions;
- deterministic demo flow.

### NFR-07 Security
- no committed secrets;
- restricted remote control endpoints;
- authentication required for public deployment if motor control is exposed;
- E-STOP should remain local and authoritative.

## 8. Success Metrics
Record, never fabricate:
- inference FPS;
- median and p95 inference latency;
- path planning latency;
- collision-free run rate;
- navigation completion rate;
- localization tracking-loss count;
- relocalization recovery rate;
- estimated drift where ground truth exists;
- dropped-frame ratio;
- route replan count;
- emergency stop response time.

## 9. Primary Jury Demo
1. Start live camera.
2. Show traversable-mask overlay.
3. Start SLAM and show trajectory.
4. Set destination.
5. Start autonomous mission.
6. Introduce sudden obstacle.
7. Show risk map + route replan.
8. Obscure camera / induce low confidence.
9. Show automatic Stop-and-Scan.
10. Recover localization.
11. Continue to goal.
12. Disable GNSS indicator to prove navigation remains active.
13. Open mission replay and metrics.

## 10. Out of Scope for Hackathon MVP
- military targeting;
- weaponization;
- autonomous engagement;
- large-scale fleet orchestration;
- production-certified functional safety;
- cloud-required remote driving.

## 11. Definition of Done
The MVP is done only when the system can demonstrate a real or recorded camera stream, real algorithm outputs, visual pose, costmap, path, obstacle-triggered replan, safety stop, telemetry, logs, and deployment documentation.
