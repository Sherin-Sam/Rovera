"""Integration reference: unverified on physical ROS hardware. Not wired to web UI."""
import math
import time
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from std_msgs.msg import Bool, Float32, String
from std_srvs.srv import Trigger

class SafetyGate(Node):
    def __init__(self):
        super().__init__('drishtinav_safety_gate')
        self.latched = True  # Operator must explicitly arm after startup.
        self.latest = {}
        self.requested = Twist()
        self.command_time = 0.0
        self.output = self.create_publisher(Twist, '/cmd_vel', 10)
        self.status = self.create_publisher(String, '/safety/state', 10)
        self.create_subscription(Twist, '/cmd_vel_raw', self.command, 1)
        self.create_subscription(Bool, '/camera/healthy', lambda m: self.update('camera', 1.0 if m.data else 0.0), 1)
        self.create_subscription(Float32, '/slam/confidence', lambda m: self.update('slam', m.data), 1)
        self.create_subscription(Float32, '/perception/confidence', lambda m: self.update('perception', m.data), 1)
        self.create_subscription(Bool, '/safety/estop', self.stop, 1)
        self.create_service(Trigger, '/safety/reset', self.reset)
        self.create_timer(.02, self.tick)

    def update(self, name, value):
        self.latest[name] = (value, time.monotonic())

    def healthy(self):
        now = time.monotonic()
        return all(name in self.latest and math.isfinite(self.latest[name][0]) and .75 <= self.latest[name][0] <= 1 and now-self.latest[name][1] < .3 for name in ('camera','slam','perception'))

    def command(self, msg):
        self.requested = msg
        self.command_time = time.monotonic()

    def stop(self, msg):
        if msg.data:
            self.latched = True
            self.output.publish(Twist())

    def reset(self, request, response):
        response.success = self.healthy()
        response.message = 'Reset; fresh velocity still required.' if response.success else 'Cannot reset: mandatory inputs stale or unhealthy.'
        if response.success:
            self.latched = False
            self.command_time = 0  # Do not replay a pre-reset motion command.
        return response

    def tick(self):
        valid = self.healthy() and time.monotonic()-self.command_time < .2
        values = (self.requested.linear.x,self.requested.angular.z)
        valid = valid and all(math.isfinite(v) for v in values)
        # Sensor failure latches; stale commands inhibit output without re-arming.
        if not self.healthy():
            self.latched = True
        output = Twist()
        if valid and not self.latched:
            output.linear.x = max(-.3,min(.3,values[0]))
            output.angular.z = max(-.5,min(.5,values[1]))
        self.output.publish(output)
        state = String()
        state.data = 'EMERGENCY_STOP' if self.latched else 'READY'
        self.status.publish(state)

def main():
    rclpy.init()
    node = SafetyGate()
    try:
        rclpy.spin(node)
    finally:
        node.output.publish(Twist())
        node.destroy_node()
        rclpy.shutdown()
