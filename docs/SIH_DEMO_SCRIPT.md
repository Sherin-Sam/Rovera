# ROVERA demonstration

1. Start locally and point to the **SIMULATION** source badge. Explain that the world is deterministic and the camera panel is a 3D rendering of it.
2. Choose Woodland trail, Campus crossing, Construction site, or Industrial yard. New mission → choose a clear goal → Create mission. Show metric coordinates and the A* route around obstacles.
3. Start mission. Observe velocity, pose, remaining distance, and the moving synthetic view.
4. In Scenario lab, choose an obstacle class and place it on the planned route. Match class/ID/distance tags with the Obstacle detections panel and detection event. Open Planner & Costmap: compare old/new route and the recorded reason.
5. Inject low light. Show AMBER confidence and reduced simulation speed. Restore inputs.
6. Inject camera loss or SLAM loss. Show zero velocity, stop state, then restore inputs and observe recovery/replanning.
7. Press E-STOP or Escape. Show the latched state. Reset explicitly, then resume explicitly.
8. Press Return to base and observe replanning to the home marker, then the Base reached event and zero velocity. Open Mission Replay, select it, play/scrub, and export JSON evidence.
9. Optionally connect a real browser camera in Terrain Intelligence. Show actual ORB features and exposure diagnostics; explicitly explain that this is not a trained terrain model or metric SLAM.
10. Disconnect Internet while leaving the local server running. Show the local app still works. Note that GPS is never required by the simulator.
11. End with `docs/IMPLEMENTATION_STATUS.md` to distinguish demonstrated capability from planned hardware integration.
