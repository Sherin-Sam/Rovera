# UI / UX SPECIFICATION — DRISHTI-NAV UGV

## 1. Design Goal
Create a serious outdoor autonomy command console that helps an operator understand:
- what the UGV sees;
- where it thinks it is;
- where it plans to go;
- why it changed its route;
- whether it is safe to continue.

Avoid a generic admin dashboard look.

## 2. Visual Language
- dark graphite/charcoal foundation;
- off-white primary text;
- muted secondary labels;
- green = healthy/safe;
- amber = caution/degraded;
- red = stop/critical;
- blue/cyan only for route/navigation data;
- minimal gradients;
- no cyberpunk neon;
- no excessive glassmorphism;
- 6–10 px panel radius;
- compact spacing;
- strong information hierarchy.

## 3. Global Header
Always visible.

Left:
- DRISHTI-NAV logo/name;
- mission ID;
- mode badge: LIVE / REPLAY / SIMULATION.

Center:
- autonomy state;
- safety state;
- SLAM tracking;
- camera status.

Right:
- clock;
- edge backend connectivity;
- recording indicator;
- operator menu;
- E-STOP.

## 4. Mission Control Screen

### Left Column — Mission
- current mission;
- Start;
- Pause;
- Resume;
- Cancel;
- Set Goal;
- Add Waypoint;
- autonomy mode:
  - Manual
  - Assisted
  - Autonomous
- max speed;
- distance remaining;
- ETA if calculated from local plan.

### Center — Live Vision
Large 16:9 video card.

Overlay toggle chips:
- Path Mask
- Obstacles
- Track IDs
- Risk
- SLAM Features
- Route Projection

Top-left overlay:
- camera source;
- resolution;
- FPS.

Top-right:
- inference FPS;
- latency;
- frame age.

Bottom:
- color-coded terrain legend.

Do not bake overlays into a laggy server-encoded stream when browser rendering is possible.

### Right Column — Safety Intelligence
Large safety score ring/bar.
Display:
- GREEN / AMBER / RED;
- current reason;
- localization confidence;
- perception confidence;
- exposure quality;
- obstacle clearance;
- last loop closure;
- frame freshness.

Prominent recovery timeline:
`STOPPED → SCANNING → RELOCALIZING → REPLANNING → READY`

### Bottom Panel
Tabs:
1. Local Map
2. Costmap
3. 3D View
4. Telemetry
5. Events

## 5. Local Map Tab
Show:
- robot footprint;
- heading;
- local SLAM trajectory;
- goal;
- current route;
- obstacle regions;
- keyframes optional.

Coordinates displayed in meters.

## 6. Geospatial Tab
Only appear when a valid GNSS/start anchor exists.

Show:
- MapLibre map;
- GNSS marker;
- SLAM-derived relative path projected from anchor;
- source labels.

Display notice:
`GNSS used for reference/validation — autonomy source: VISUAL SLAM`

## 7. Costmap Tab
Layers:
- free;
- caution;
- high risk;
- lethal/blocked;
- dynamic obstacle prediction;
- inflation radius;
- planned path.

Include before/after comparison on replan events.

## 8. 3D View
When data exists:
- point cloud;
- camera frustum;
- trajectory;
- current UGV transform;
- goal marker.

When data does not exist, show:
`3D map unavailable for current sensor configuration`
Do not create fake points.

## 9. SLAM Diagnostics Screen
Cards:
- Tracking: OK / Degraded / Lost
- Pose X/Y/Yaw
- Feature count
- Keyframes
- Last loop closure
- Tracking duration
- Drift warning
- Map update rate

Charts:
- localization confidence vs time;
- optional SLAM vs GNSS ground truth error.

## 10. Terrain Intelligence Screen
Three panes:
1. Raw
2. Normalized
3. Segmentation/Risk

Controls:
- confidence threshold;
- normalization on/off/auto;
- class filter;
- temporal smoothing;
- snapshot.

## 11. Planner Screen
Show:
- current planner;
- controller;
- planning time;
- replan count;
- path length;
- goal distance;
- current command velocity.

Event card:
`Replanned because: dynamic obstacle intersected local route`

## 12. System Health
Grid of services:
- Camera
- Normalizer
- Perception
- SLAM
- Costmap
- Planner
- Safety
- Motor Bridge
- Recorder
- API
- WebRTC

Each tile:
- state;
- last heartbeat;
- latency;
- short error.

Resource cards:
- CPU;
- RAM;
- GPU;
- VRAM;
- temperature if exposed;
- disk;
- network.

## 13. Replay Screen
- video player;
- mission timeline;
- event markers;
- synchronized map cursor;
- safety-state strip;
- speed control;
- jump to obstacle;
- jump to replan;
- jump to emergency stop;
- export metrics JSON/CSV.

## 14. Calibration Screen
Sections:
- camera intrinsics;
- distortion;
- stereo baseline;
- IMU alignment;
- wheel odometry;
- frame transforms.

Use checkmarks only when a calibration test actually passes.

## 15. Error UX
Errors must be actionable.

Bad:
`Something went wrong.`

Good:
`Visual SLAM lost tracking 1.8 s ago. Vehicle stopped. Move/rotate camera slowly to recover features.`

## 16. Outdoor Accessibility
- high contrast;
- 16 px minimum body text on primary control views;
- 44 px minimum touch target for critical actions;
- keyboard shortcut for E-STOP;
- confirmation for reset, not for emergency stop;
- support 1366×768 without hidden critical controls.

## 17. Jury Mode
Add optional `Jury Mode` toggle:
- simplifies display;
- enlarges camera + map;
- shows five KPI cards only:
  1. Perception FPS
  2. Localization Status
  3. Safety State
  4. Planner Time
  5. Distance to Goal
- keeps technical detail accessible via expandable drawer.

## 18. Empty-State Rules
Never invent values.
Use:
- N/A
- Waiting for camera
- Waiting for SLAM
- No GNSS reference
- No depth source
- Replay not loaded

This is essential for credibility.
