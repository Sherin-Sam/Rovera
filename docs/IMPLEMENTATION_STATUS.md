# Implementation status and scope

The seven original requirements are in `docs/requirements`. The repository implements the web product and a deterministic simulator, plus a real bench-image diagnostics path. Requirement text is never used to imply a capability exists.

| Requirement | Status | Implementation |
|---|---|---|
| Eight dashboard screens | Implemented | React navigation with real API data and explicit empty states |
| Mission create/start/pause/resume/cancel | Implemented for simulation | API-controlled state machine |
| Local map, route, obstacle inflation | Implemented | Metric A* grid, 0.65 m clearance |
| Four selectable environments | Implemented for simulation | Woodland, campus, construction, industrial; matching 2D/3D geometry |
| Object tags and detection notifications | Implemented for simulation | Class/ID/distance, 12 m range, 76 degree FOV, approximate circle occlusion, deduplicated events |
| Modern spatial map | Implemented | Zoom, pan, center, fit, layers, object inspection; rectangle-aware costmap |
| Return to base | Implemented for simulation | Route to home, arrival stop, fault/E-STOP/blocked-path checks |
| ROVERA branding and themes | Implemented | Persistent light/dark mode; jury view removed |
| Obstacle-triggered route changes | Implemented for simulation | Geometric obstacle injection, old/new route events |
| Confidence fusion / slow / stop / recover | Implemented for simulation | Fault-derived input confidence, latched E-STOP, staged recovery |
| Backend-independent hardware safety | Integration source only | Optional ROS safety-gate package, not connected or hardware-tested |
| Persistent logs/replay/settings | Implemented | SQLite, half-second telemetry, timeline, JSON export |
| Real host metrics | Implemented | psutil CPU, memory, disk |
| Camera preview | Implemented on browser device | getUserMedia, real image analysis to local API |
| Exposure / CLAHE / ORB diagnostics | Implemented | Real OpenCV analysis; not autonomous perception |
| Camera calibration | Import only | Schema validation and persistence; no calibration solver |
| Video evidence / rosbag replay | Not implemented | Current replay is telemetry/events from simulation |
| Trained terrain segmentation | Not implemented | Needs model, labels, validation, inference adapter |
| Visual SLAM / metric scale / loop closure | Not implemented | Simulator pose is explicit; no fabricated features or drift |
| Dynamic obstacle velocity memory | Not implemented | Simulation obstacles are static after injection |
| ROS / RTAB-Map / Nav2 / Gazebo wiring | Not implemented | Documented integration contract |
| WebRTC | Not implemented | Bench video stays browser-local; no base64 WebSocket video |
| Hardware/manual/assisted modes | Not implemented | No physical motion endpoint; UI advertises simulation |
| GPS anchor / measured point cloud | Not implemented | No GNSS dependency; missing depth has a clear empty state |
| Waypoint queue | Not implemented | One destination per mission |
| Offline local deployment | Implemented | Single API server serves compiled UI; no CDN assets |
| Free-hosting files | Implemented | Native startup, Docker, Pages headers, Vercel config, instructions |

The **real-UGV acceptance criteria in the uploaded PRD are not yet met**. Completing them requires the devices and model artifacts described in HARDWARE.md, integration development, and field tests. The current demo demonstrates the operator workflow and simulation algorithms, not physical visual autonomy.

## Current operational limits

- Run one Uvicorn worker: the stateful simulator must not be duplicated across workers.
- SQLite write operations are local and synchronous. At this demo scale that is adequate; a production bridge should move evidence writes to a bounded worker queue.
- Telemetry is 4 Hz; evidence samples are 2 Hz; simulator ticks are 10 Hz. None is a measured camera inference rate.
- Confidence values are deterministic scenario assumptions, not measured perception confidence.
- Replay map/event synchronization is implemented; sample timing is 0.5 s, playback is fixed 1x, video is absent.
- Public readers can access telemetry and mission archives; authentication gates writes, not all reads.
- Software stop applies only to this simulator. Physical robots require independent hardware stop and a watchdog at the motor controller.
