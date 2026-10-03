import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  Construction,
  TreePine,
  Warehouse,
  Plus,
  RotateCcw,
  Camera,
  Focus,
  Sun,
  CloudMoon,
  ScanLine,
  AlertTriangle,
} from "lucide-react";
import { api } from "./api";
import type { Telemetry } from "./types";
const icons = {
  woodland: TreePine,
  campus: Building2,
  construction: Construction,
  industrial: Warehouse,
};
export function EnvironmentSelector({
  data,
  disabled,
  onMessage,
}: {
  data: Telemetry | null;
  disabled: boolean;
  onMessage: (s: string) => void;
}) {
  const [worlds, setWorlds] = useState<
      {
        id: string;
        name: string;
        description: string;
        obstacle_count: number;
      }[]
    >([]),
    [busy, setBusy] = useState(false);
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    api<typeof worlds>("/simulation/environments")
      .then(setWorlds)
      .catch(() => {});
  }, [disabled]);
  const blocked =
    disabled ||
    busy ||
    !!data?.safety.latched ||
    (!!data?.mission && !["COMPLETED", "CANCELLED"].includes(data.state));
  const WorldIcon = icons[data?.world?.id as keyof typeof icons] || TreePine;
  return (
    <details ref={root} className="world-picker">
      <summary>
        <WorldIcon size={16} />
        {data?.world?.name || "Choose environment"}
        <ChevronDown size={13} />
      </summary>
      <div className="world-menu">
        <div className="world-menu-heading">
          <strong>Choose your environment</strong>
          <span>4 SIMULATION WORLDS</span>
        </div>
        {worlds.map((w) => {
          const Icon = icons[w.id as keyof typeof icons] || TreePine;
          return (
            <button
              key={w.id}
              disabled={blocked}
              className={data?.world?.id === w.id ? "selected" : ""}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/simulation/environment", { world: w.id });
                  if (root.current) root.current.open = false;
                  onMessage(w.name + " loaded. Create a mission to explore.");
                } catch (e) {
                  onMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Icon size={22} />
              <div>
                <strong>{w.name}</strong>
                <p>{w.description}</p>
                <small>{w.obstacle_count} mapped objects</small>
              </div>
            </button>
          );
        })}
        {blocked && (
          <p className="world-hint">
            Finish or cancel the mission and reset any emergency stop before
            changing the environment.
          </p>
        )}
      </div>
    </details>
  );
}
export function ScenarioTools({
  data,
  disabled,
  action,
}: {
  data: Telemetry;
  disabled: boolean;
  action: (path: string, body?: unknown) => Promise<void>;
}) {
  const [kind, setKind] = useState("pedestrian");
  return (
    <div className="scenario-tools">
      <label>
        Introduce an obstacle
        <select
          aria-label="Obstacle type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {[
            ["pedestrian", "Pedestrian"],
            ["vehicle", "Parked vehicle"],
            ["barrier", "Road barrier"],
            ["cone", "Traffic cone"],
            ["rock", "Rock"],
            ["tree", "Tree"],
            ["pothole", "Pothole"],
            ["water", "Standing water"],
            ["crate", "Cargo crate"],
          ].map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="add-object"
        disabled={disabled}
        onClick={() =>
          action("/simulation/scenario", {
            kind: "obstacle",
            object_kind: kind,
          })
        }
      >
        <Plus size={15} /> Place on planned route
      </button>
      <div className="scenario-caption">TEST CONDITIONS</div>
      <div className="condition-grid">
        {[
          { kind: "low_light", label: "Low light", Icon: CloudMoon },
          { kind: "glare", label: "Sun glare", Icon: Sun },
          { kind: "camera_loss", label: "Camera loss", Icon: Camera },
          { kind: "slam_loss", label: "Tracking loss", Icon: Focus },
        ].map(({ kind, label, Icon }) => (
          <button
            key={kind}
            className={data.fault === kind ? "selected" : ""}
            disabled={disabled}
            onClick={() => action("/simulation/scenario", { kind })}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      {data.fault && (
        <button
          className="restore"
          disabled={disabled}
          onClick={() => action("/simulation/scenario", { kind: "clear" })}
        >
          <RotateCcw size={15} /> Restore conditions
        </button>
      )}
      <p className="scenario-hint">
        Objects are stationary simulation actors. Scene placement and sensor
        detection are logged separately.
      </p>
    </div>
  );
}
export function DetectionsPanel({ data }: { data: Telemetry }) {
  const items = data.detections || [];
  return (
    <section className="panel detection-panel">
      <div className="panel-heading">
        <h3>
          <ScanLine size={16} /> Obstacle detections
        </h3>
        <span className="badge amber">{items.length} VISIBLE</span>
      </div>
      <div className="detection-source">
        <span className="status-dot" /> Simulated sensor · 12 m range · 76°
        field
      </div>
      {items.length ? (
        <div className="detection-list">
          {items.map((o) => (
            <div className="detection-item" key={o.id}>
              <div className="detection-type" style={{ borderColor: o.color }}>
                <AlertTriangle size={16} />
              </div>
              <div>
                <strong>{o.label || o.kind}</strong>
                <small>
                  {o.id} · {o.risk || "high"} risk · stationary
                </small>
              </div>
              <span>
                {o.distance_m.toFixed(1)}
                <small>m</small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-detections">
          <ScanLine size={24} />
          <p>
            {data.fault === "camera_loss"
              ? "Camera unavailable. Detections suspended."
              : "No visible obstacles in the sensor field."}
          </p>
        </div>
      )}
      <div className="detection-footer">
        {data.detected_count || 0} unique objects observed · map contains known
        geometry
      </div>
    </section>
  );
}
