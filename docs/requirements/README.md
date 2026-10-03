# DRISHTI-NAV UGV

Vision-first autonomous outdoor navigation software for a GPS-denied unmanned ground vehicle.

## Core Loop
**Camera → Terrain Perception → Visual SLAM → Costmap → Planner → Safety Supervisor → Motor Command**

## What Makes This Build Different
- camera-first autonomy;
- no mandatory GPS;
- adaptive lighting normalization;
- safety confidence guardian;
- Stop → Scan → Relocalize → Replan;
- terrain risk instead of only free/blocked;
- dynamic obstacle memory;
- explainable route replanning;
- drift diagnostics;
- mission evidence/replay;
- optional GNSS only for validation/reference;
- edge-first deployment so cloud failure does not stop the rover.

## Documents
- `MASTER_BUILD_PROMPT.md` — paste into Astra/agentic coding tool
- `PRD.md`
- `TECH_ARCHITECTURE.md`
- `UI_UX.md`
- `WORKFLOW.md`
- `DEPLOYMENT.md`

## Recommended Final Demo
Run all perception/SLAM/navigation on the edge computer and use the browser only as the operator console.
