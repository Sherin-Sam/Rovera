export type Point = [number, number];
export type Obstacle = {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: string;
  label?: string;
  height?: number;
  color?: string;
  risk?: string;
  shape?: string;
  width?: number;
  length?: number;
};
export type Detection = Obstacle & {
  distance_m: number;
  bearing_deg: number;
  source: string;
  confidence: null;
};
export type World = {
  id: string;
  name: string;
  description: string;
  ground: string;
  sky: string;
  base: Point;
  goal: Point;
  surfaces: {
    name: string;
    kind: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
};
export type Telemetry = {
  world?: World;
  base?: Point;
  returning_to_base?: boolean;
  at_base?: boolean;
  detections?: Detection[];
  detected_count?: number;
  timestamp: string;
  mode: string;
  source: string;
  state: string;
  mission: { id: string; name: string; started_at: string } | null;
  pose: { x: number; y: number; yaw: number; frame: string; source: string };
  goal: Point;
  velocity: number;
  distance: number;
  remaining: number;
  safety: {
    state: string;
    score: number;
    reason: string;
    localization: number;
    perception: number;
    latched: boolean;
    frame_age_ms: number | null;
  };
  route: Point[];
  old_route: Point[];
  trajectory: Point[];
  obstacles: Obstacle[];
  planner: {
    name: string;
    latency_ms: number;
    replans: number;
    margin_m: number;
  };
  slam: {
    tracking: string;
    confidence: number;
    feature_count: number | null;
    drift_m: number | null;
    loop_closure: boolean | null;
  };
  perception: {
    confidence: number;
    exposure: string;
    inference_fps: number | null;
    latency_ms: number | null;
  };
  source_validity: {
    camera: boolean;
    imu: boolean;
    gps: boolean;
    motors: boolean;
  };
  recording: boolean;
  fault: string | null;
};
export type Event = {
  id: number;
  timestamp: string;
  type: string;
  severity: string;
  message: string;
};
export type Settings = {
  max_speed: number;
  green_threshold: number;
  red_threshold: number;
  recording: boolean;
  normalization: boolean;
  planner: string;
  namespace: string;
};
export type Mission = {
  id: string;
  name: string;
  status: string;
  mode: string;
  started_at: string;
  total_distance_m: number;
  sample_count: number;
};
export type Replay = {
  mission: Mission;
  samples: Telemetry[];
  events: Event[];
  total: number;
  next_offset: number | null;
};
export type System = {
  cpu: number;
  ram: number;
  ram_used_gb: number;
  disk: number;
  gpu: null;
  temperature: null;
  battery: null;
  ros: string;
  model: string;
  services: { name: string; state: string }[];
};
