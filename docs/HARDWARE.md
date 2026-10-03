# Physical robotics integration

The console is currently isolated from physical actuators. Do not interpret a simulation green badge as sensor or motor readiness. There is no live mission execution mode in the API.

## What is needed to finish the physical product

1. A calibrated stereo/RGB-D camera or calibrated camera + synchronized IMU for metric visual-inertial SLAM; monocular feature detection alone cannot supply reliable metric scale.
2. Actual motor protocol (serial/CAN/PWM), wheel geometry/odometry, hardware stop switch, and a motor-controller watchdog that stops on expired commands.
3. A selected terrain model and weights, labeled outdoor validation set, class-to-risk mapping, and independent tests for glare, shadow, water, ditches, people, and vegetation.
4. Ubuntu/ROS 2 environment, RTAB-Map or ORB-SLAM3 setup, Nav2 configuration, TF tree, timestamps, and measured message latency.
5. A ROS telemetry bridge that maps measured source data into the frontend contract, plus WebRTC signaling/media transport if video originates on the rover.

## Independent safety gate source

`ros2_ws/src/drishtinav_safety` provides a small ROS safety gate to develop against. It subscribes to `/cmd_vel_raw`, `/camera/healthy`, `/slam/confidence`, `/perception/confidence`, and `/safety/estop`; it only publishes nonzero `/cmd_vel` while all inputs are fresh and confidence passes thresholds. `/safety/reset` requires healthy inputs and explicitly clears the latch. It starts inhibited and zeroes stale motion commands independently of FastAPI.

This package is **not built or tested against ROS in this Windows workspace**, is not connected to the web E-STOP, and is not a certified safety system. Its reset must be integrated with authenticated local operator handling. Add motor-controller-level timeout even if this process dies. The supplied web application remains simulator-only.

In a ROS 2 environment with geometry_msgs, std_msgs and std_srvs installed:

```bash
source /opt/ros/jazzy/setup.bash
cd ros2_ws
colcon build --symlink-install --packages-select drishtinav_safety
source install/setup.bash
ros2 run drishtinav_safety safety_gate
```

All sensor topics must be supplied by validated hardware nodes. There is deliberately no script that reports fabricated healthy ROS messages or starts physical driving.

## Integration acceptance

Validate camera unplug, frozen frames, lost SLAM, invalid covariance, stale velocity, planner failure, API crash, WAN outage, and independent hardware stop before lifting the wheels. Test with wheels off the ground before supervised low-speed tests. Record actual end-to-end safety latency and collision-free results. No physical performance claims have been established by this build.
