# Build verification — October 1, 2026

## Passed

- **22 backend tests** in a fresh project Python 3.12 virtual environment installed from `edge_backend/requirements-dev.txt`.
- **3 frontend tests** for denied commands, operator-token headers, and understandable validation errors.
- TypeScript production build with Vite. The Three.js scene is a separate lazy-loaded chunk.
- npm dependency audit after updating Vitest: **0 known vulnerabilities** at verification time.
- Exact Windows startup command: `powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1 -SkipInstall`. It builds the frontend and serves the combined application at port 8000.
- `/api/health` confirms SIMULATION mode, connected SQLite, and no connected motors.
- Browser: create/start/cancel mission; camera-loss stop; restored inputs; latched E-STOP; reset leaves mission paused; obstacle replan; low-light speed reduction; pause; replay playback; settings save; diagnostic view navigation.
- Responsive layout inspected at **1366×768** and **390×844**. Narrow view has no document horizontal overflow and retains a visible E-STOP. Collapsed navigation has explicit accessible names.
- Browser runtime logs showed no warnings or errors in the final inspected views.
- Python syntax validation of the optional ROS integration-reference package.

## Measured benchmark

Local A* planning, 100 runs with the bundled deterministic world, on this Windows computer: **p50 9.17 ms, p95 10.29 ms**. This is not CV inference performance, ROS latency, motor stop time, or a target-hardware guarantee. Re-run `python scripts/benchmark.py` to measure your environment.

## Not verified / not implemented

- Physical webcam permission/hardware capture on the user's devices; image diagnostics were tested using a generated JPEG fixture.
- ROS runtime/build, real sensors, motor control, field autonomy, trained segmentation, metric SLAM, WebRTC, and depth reconstruction.
- Docker daemon execution, Linux/macOS startup, Cloudflare account publication, and Vercel publication.
- A dependency-level anyio deprecation warning appeared during pinned backend tests; all tests passed.

The working demo does not meet the uploaded PRD's physical-UGV acceptance criteria yet. See IMPLEMENTATION_STATUS.md and HARDWARE.md for the remaining integration work.
