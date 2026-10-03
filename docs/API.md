# API contract

Interactive OpenAPI: `/docs`. Telemetry: `/ws/telemetry` at 4 Hz; `/ws/events` at 4 Hz. No image frames enter either socket. Every telemetry packet contains UTC ISO timestamp, `mode=SIMULATION`, explicit source, source validity, metric pose, mission state, safety inputs, route, world obstacles, and measured planner time.

| Method | Path | Purpose |
|---|---|---|
| GET | /api/health | Service health and mode |
| GET | /api/system | Measured host resources and module availability |
| GET | /api/mission, /api/telemetry | Current snapshot |
| POST | /api/mission | `{name, goal:[x,y]}`; x/y within 0.5–19 m |
| POST | /api/mission/start,pause,resume,cancel | Validated state transitions |
| POST | /api/mission/return-to-base | Replan to home and start return; 409 if already home, faulted, latched, or blocked |
| GET | /api/simulation/environments | Four available environment summaries |
| POST | /api/simulation/environment | `{world: woodland/campus/construction/industrial}`; requires no active mission and no E-STOP |
| POST | /api/estop | Immediate, persisted simulation latch |
| POST | /api/estop/reset | Rejects faults or no route, leaves mission paused |
| POST | /api/simulation/scenario | `{kind: obstacle/camera_loss/slam_loss/low_light/glare/clear, object_kind?: rock/tree/pedestrian/vehicle/barrier/cone/pothole/water/crate}` |
| GET | /api/map | Actual 40×40 A* grid, 0.5 m resolution |
| GET | /api/events, /api/history | Recent events and confidence history |
| GET/POST | /api/settings | Persisted schema-validated configuration |
| GET | /api/slam/status, /api/perception/status, /api/planner/status | Explicit simulator outputs |
| GET | /api/calibration/status | Imported camera parameters / missing sensors |
| POST | /api/calibration/camera | Import fx/fy/cx/cy/width/height/5 distortion terms/reprojection_error |
| POST | /api/vision/analyze | Binary JPEG/PNG, max 2 MB; real exposure/ORB/CLAHE diagnostics |
| GET | /api/logs/missions | Latest 100 missions |
| GET | /api/logs/missions/{id}?offset=0&limit=1000 | Evidence page, events, total, next_offset |

All writes use the same operator authorization. A configured AUTH_TOKEN requires `Authorization: Bearer ...`. Forwarded/non-loopback requests are denied unless remote control is explicitly enabled **and** a token is configured. Browser Origins must match the allowlist. Invalid state transition: 409. Invalid schema: 422. Unauthorized token: 401. Denied origin/remote write: 403. Frame busy: 429. Oversized upload: 413.

`source_validity.camera=false` refers to the simulation engine. Bench camera analysis is a separate request path and never changes simulated pose or safety inputs. No live/real motor command endpoint is implemented.
