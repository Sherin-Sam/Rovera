# Verification plan

ROVERA upgrade verification: 42 backend tests, 3 frontend tests, and the TypeScript/Vite production build pass. Backend coverage includes all four world routes, rectangle clearance, detection range/FOV/occlusion, deduplicated notifications, typed injection, return arrival, cancellation/restart of a return, blocked base, and E-STOP/fault restrictions.

Browser-verified: all four environment selections, pedestrian placement and matching object ID, detection events, return-to-base arrival at zero velocity, object inspection, map zoom/fit/clearance layer, persistent theme after reload, and 390 px mobile layout without horizontal overflow. No browser warning/error was observed during these checks. These are simulator checks; no physical navigation or trained camera detector was tested.

Automated backend tests cover mission transitions, pause velocity, E-STOP latch and restart persistence, reset rejection during sensor faults, camera/SLAM loss and recovery, low-light speed limiting, obstacle replans and footprint clearance, deterministic routing, blocked goals, mission completion, SQLite evidence, GNSS independence, request validation, public write rejection, Origin checks, tokens, telemetry provenance, and valid/corrupt real image processing.

Frontend browser verification covers creating a mission, starting and pausing, scenario injection, E-STOP and explicit reset, view navigation, replay, settings, and a narrow layout. TypeScript production build is required. CI runs backend and frontend checks.

Hardware-only tests remain pending: ROS build/runtime, camera calibration accuracy, segmentation accuracy, metric SLAM, WebRTC latency, camera permissions on the user's hardware, motor stops, and field navigation. Docker runtime and third-party publication require those services to be available and are separately unverified.

Run `python scripts/benchmark.py` for actual A* p50/p95 on your computer. It does not benchmark CV, ROS, network latency, or a physical safety loop.
