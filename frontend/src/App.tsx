import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CircleStop,
  Compass,
  Crosshair,
  FileClock,
  Flag,
  Focus,
  Gauge,
  Layers,
  Map,
  Home,
  Sun,
  Moon,
  Navigation,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Route,
  ScanLine,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Target,
  Terminal,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { api, exportJson, setToken, baseUrl } from "./api";
import { useTelemetry } from "./useTelemetry";
import type {
  Event,
  Mission,
  Point,
  Replay,
  Settings,
  System,
  Telemetry,
} from "./types";
import LocalMap from "./LocalMap";
import SimulationView from "./SimulationLazy";
import BenchCamera from "./BenchCamera";
import {
  EnvironmentSelector,
  ScenarioTools,
  DetectionsPanel,
} from "./ScenarioControls";

const navigation = [
  {
    section: "OPERATIONS",
    items: [
      { name: "Mission Control", icon: Compass },
      { name: "Spatial Mapping", icon: Focus },
      { name: "Terrain Intelligence", icon: Layers },
      { name: "Planner & Costmap", icon: Route },
    ],
  },
  {
    section: "WORKSPACE",
    items: [
      { name: "Mission Replay", icon: FileClock },
      { name: "System Health", icon: Activity },
      { name: "Calibration", icon: SlidersHorizontal },
      { name: "Settings", icon: Settings2 },
    ],
  },
];
const fmt = (n: number | null | undefined, d = 1) =>
  n == null ? "N/A" : n.toFixed(d);
const time = (t: string) =>
  new Date(t).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const human = (s: string) => s.replaceAll("_", " ").toLowerCase();
function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Metric({
  label,
  value,
  unit,
  icon: Icon,
  note,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon: typeof Activity;
  note: string;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="metric-note">{note}</div>
    </div>
  );
}
function Panel({
  title,
  icon: Icon,
  action,
  children,
  className = "",
}: {
  title: string;
  icon: typeof Activity;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-heading">
        <h3>
          <Icon size={16} />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <Box size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function EventList({
  events,
  compact = false,
}: {
  events: Event[];
  compact?: boolean;
}) {
  return (
    <div className="event-list">
      {events.slice(0, compact ? 4 : 40).map((e) => (
        <div className="event" key={e.id}>
          <span className={"event-dot " + e.severity} />
          <div>
            <strong>{human(e.type)}</strong>
            <p>{e.message}</p>
          </div>
          <time>{time(e.timestamp)}</time>
        </div>
      ))}
      {!events.length && (
        <Empty title="No events yet">
          Mission and safety events appear here.
        </Empty>
      )}
    </div>
  );
}
function SafetyPanel({ d }: { d: Telemetry }) {
  const score = Math.round(d.safety.score * 100);
  return (
    <Panel
      title="Vision confidence"
      icon={ShieldCheck}
      action={<span className="tiny-label">GUARDIAN</span>}
      className="safety-panel"
    >
      <div className={"confidence " + d.safety.state.toLowerCase()}>
        <div
          className="confidence-gauge"
          style={{ "--score": `${score}%` } as React.CSSProperties}
        >
          <div>
            <strong>
              {score}
              <small>%</small>
            </strong>
            <span>FUSED CONFIDENCE</span>
          </div>
        </div>
        <Badge
          tone={
            d.safety.state === "GREEN"
              ? "green"
              : d.safety.state === "AMBER"
                ? "amber"
                : "red"
          }
        >
          {d.safety.state === "GREEN" ? (
            <Check size={12} />
          ) : (
            <ShieldCheck size={12} />
          )}{" "}
          {d.safety.state === "GREEN"
            ? "Nominal conditions"
            : human(d.safety.reason)}
        </Badge>
      </div>
      <div className="confidence-breakdown">
        {[
          ["Localization", d.safety.localization],
          ["Terrain perception", d.safety.perception],
          ["Frame freshness", d.safety.frame_age_ms === null ? 0 : 1],
        ].map(([label, value]) => (
          <div className="confidence-row" key={label as string}>
            <div>
              <span>{label}</span>
              <strong>
                {Math.round(Number(value) * 100)}
                <small>%</small>
              </strong>
            </div>
            <div className="progress">
              <i style={{ width: `${Number(value) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="safety-foot">
        <ShieldCheck size={15} />
        <span>
          Local safety loop active
          <small>Simulation inputs · no motor connection</small>
        </span>
      </div>
    </Panel>
  );
}

function SettingsView({ onMessage }: { onMessage: (s: string) => void }) {
  const [settings, change] = useState<Settings | null>(null),
    [password, setPassword] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    api<Settings>("/settings")
      .then(change)
      .catch((e) => onMessage(e.message));
  }, [onMessage]);
  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api("/settings", settings);
      onMessage("Configuration saved to the edge computer.");
    } catch (e) {
      onMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="settings-layout">
      <Panel title="Navigation & safety" icon={ShieldCheck}>
        {settings ? (
          <div className="form-grid">
            <label>
              Maximum speed <span>{settings.max_speed.toFixed(1)} m/s</span>
              <input
                type="range"
                min=".1"
                max="1.5"
                step=".1"
                value={settings.max_speed}
                onChange={(e) =>
                  change({ ...settings, max_speed: +e.target.value })
                }
              />
            </label>
            <label>
              Green confidence threshold
              <input
                type="number"
                min=".6"
                max=".98"
                step=".01"
                value={settings.green_threshold}
                onChange={(e) =>
                  change({ ...settings, green_threshold: +e.target.value })
                }
              />
            </label>
            <label>
              Red confidence threshold
              <input
                type="number"
                min=".2"
                max=".7"
                step=".01"
                value={settings.red_threshold}
                onChange={(e) =>
                  change({ ...settings, red_threshold: +e.target.value })
                }
              />
            </label>
            <label>
              Planner
              <select value={settings.planner} disabled>
                <option>A*</option>
              </select>
            </label>
            <label>
              ROS namespace (integration reference)
              <input
                value={settings.namespace}
                onChange={(e) =>
                  change({ ...settings, namespace: e.target.value })
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={settings.recording}
                onChange={(e) =>
                  change({ ...settings, recording: e.target.checked })
                }
              />{" "}
              Record mission telemetry
            </label>
            <button className="primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save configuration"}
            </button>
          </div>
        ) : (
          <Empty title="Loading configuration">Waiting for the edge API.</Empty>
        )}
      </Panel>
      <Panel title="Connection" icon={Wifi}>
        <div className="form-grid">
          <label>
            Edge API
            <input value={baseUrl || "Same origin · local edge"} readOnly />
          </label>
          <label>
            Operator token
            <input
              type="password"
              autoComplete="off"
              placeholder="Token from your .env file"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            onClick={() => {
              setToken(password);
              setPassword("");
              onMessage("Operator token saved for this browser session.");
            }}
          >
            Save session token
          </button>
          <p className="muted">
            Public viewers are read-only by default. Keep mission control on
            your local computer. Never put operator secrets in the frontend
            build.
          </p>
          <div className="info-box">
            <Terminal size={18} />
            <div>
              <strong>Edge first. Cloud optional.</strong>
              <p>
                The full console runs offline after installation. See
                DEPLOYMENT.md in your project for the free deployment
                walkthrough.
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ReplayView({ onMessage }: { onMessage: (s: string) => void }) {
  const [missions, setMissions] = useState<Mission[]>([]),
    [replay, setReplay] = useState<Replay | null>(null),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    api<Mission[]>("/logs/missions")
      .then(setMissions)
      .catch((e) => onMessage(e.message));
  }, [onMessage]);
  useEffect(() => {
    if (!playing || !replay) return;
    const timer = setInterval(
      () =>
        setIndex((i) => {
          if (i >= replay.samples.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      500,
    );
    return () => clearInterval(timer);
  }, [playing, replay]);
  const load = async (id: string) => {
    setPlaying(false);
    setLoading(true);
    try {
      let result = await api<Replay>("/logs/missions/" + id);
      while (result.next_offset !== null) {
        const next = await api<Replay>(
          `/logs/missions/${id}?offset=${result.next_offset}`,
        );
        result = {
          ...result,
          samples: [...result.samples, ...next.samples],
          next_offset: next.next_offset,
        };
      }
      setReplay(result);
      setIndex(0);
    } catch (e) {
      onMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const sample = replay?.samples[index];
  return (
    <div className="replay-layout">
      <Panel title="Mission archive" icon={FileClock}>
        <div className="mission-archive">
          {missions.map((m) => (
            <button
              disabled={loading}
              key={m.id}
              className={replay?.mission.id === m.id ? "selected" : ""}
              onClick={() => load(m.id)}
            >
              <div>
                <strong>{m.name}</strong>
                <small>
                  {new Date(m.started_at).toLocaleDateString()} ·{" "}
                  {m.sample_count} samples
                </small>
              </div>
              <Badge tone="neutral">{human(m.status)}</Badge>
            </button>
          ))}
          {!missions.length && (
            <Empty title="Your first mission awaits">
              Create and run a mission to record its trajectory and events.
            </Empty>
          )}
        </div>
      </Panel>
      <div>
        {sample ? (
          <>
            <Panel
              title={replay!.mission.name}
              icon={Play}
              action={<Badge tone="amber">RECORDED SIMULATION</Badge>}
            >
              <LocalMap data={sample} />
              <div className="replay-controls">
                <button
                  aria-label={playing ? "Pause replay" : "Play replay"}
                  onClick={() => {
                    if (index === replay!.samples.length - 1) setIndex(0);
                    setPlaying(!playing);
                  }}
                >
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <input
                  aria-label="Replay timeline"
                  type="range"
                  min="0"
                  max={replay!.samples.length - 1}
                  value={index}
                  onChange={(e) => {
                    setPlaying(false);
                    setIndex(+e.target.value);
                  }}
                />
                <span>{time(sample.timestamp)}</span>
                <button
                  onClick={() =>
                    exportJson(replay!.mission.id + ".json", replay)
                  }
                >
                  <ArrowDownToLine size={16} /> Export
                </button>
              </div>
            </Panel>
            <Panel title="Synchronized events" icon={Activity}>
              <EventList
                events={replay!.events
                  .filter((e) => e.timestamp <= sample.timestamp)
                  .reverse()}
              />
            </Panel>
          </>
        ) : (
          <Panel title="Mission replay" icon={Play}>
            <Empty
              title={
                loading
                  ? "Loading evidence…"
                  : replay
                    ? "No samples recorded"
                    : "Select a recorded mission"
              }
            >
              Replay uses persisted trajectory, safety states, and events. Video
              recording is not configured.
            </Empty>
          </Panel>
        )}
      </div>
    </div>
  );
}

function CalibrationView({ onMessage }: { onMessage: (s: string) => void }) {
  const [status, setStatus] = useState("Loading…"),
    [value, setValue] = useState("");
  useEffect(() => {
    api<{ status: string; camera: unknown }>("/calibration/status")
      .then((s) => {
        setStatus(s.status);
        if (s.camera) setValue(JSON.stringify(s.camera, null, 2));
      })
      .catch((e) => onMessage(e.message));
  }, [onMessage]);
  return (
    <div className="settings-layout">
      <Panel
        title="Camera intrinsics"
        icon={Camera}
        action={<Badge tone="amber">{human(status)}</Badge>}
      >
        <div className="form-grid">
          <p className="muted">
            Import measured calibration from your camera tool. An import
            validates the file format; it does not validate physical accuracy.
          </p>
          <label>
            Calibration JSON
            <textarea
              rows={12}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                '{"fx": ..., "fy": ..., "cx": ..., "cy": ...,\n "width": ..., "height": ...,\n "distortion": [k1,k2,p1,p2,k3],\n "reprojection_error": ...}'
              }
            />
          </label>
          <button
            className="primary"
            onClick={async () => {
              try {
                const result = await api<{ status: string }>(
                  "/calibration/camera",
                  JSON.parse(value),
                );
                setStatus(result.status);
                onMessage(
                  "Intrinsics imported. Verify against your physical camera before use.",
                );
              } catch (e) {
                onMessage((e as Error).message);
              }
            }}
          >
            Import calibration
          </button>
        </div>
      </Panel>
      <Panel title="Sensor alignment" icon={Crosshair}>
        <Empty title="Hardware not connected">
          Stereo baseline, IMU alignment, wheel scale, and ROS transforms
          require your physical sensor setup. See docs/HARDWARE.md.
        </Empty>
      </Panel>
    </div>
  );
}

export default function App() {
  const { data: d, connected } = useTelemetry();
  const [page, setPage] = useState("Mission Control"),
    [tab, setTab] = useState("Local map"),
    [events, setEvents] = useState<Event[]>([]),
    [system, setSystem] = useState<System | null>(null),
    [history, setHistory] = useState<{ safety: number; speed: number }[]>([]),
    [toast, setToast] = useState(""),
    [goalModal, setGoalModal] = useState(false),
    [resetModal, setResetModal] = useState(false),
    [draftGoal, setDraftGoal] = useState<Point>([17.5, 17.5]),
    [name, setName] = useState("Outdoor exploration"),
    [pending, setPending] = useState(false),
    [mask, setMask] = useState(true),
    [features, setFeatures] = useState(false),
    [cameraMode, setCameraMode] = useState("simulation"),
    [theme, setTheme] = useState<"dark" | "light">(() =>
      localStorage.getItem("rovera-theme") === "light" ? "light" : "dark",
    ),
    [clock, setClock] = useState(new Date());
  const message = useCallback((s: string) => setToast(s), []);
  const lastEvent = useRef<number | null>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("rovera-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!events.length) return;
    if (lastEvent.current !== null) {
      const detections = events.filter(
        (e) => e.id > lastEvent.current! && e.type === "OBSTACLE_DETECTED",
      );
      if (detections.length)
        message(
          detections.length === 1
            ? detections[0].message
            : `${detections.length} obstacles detected. ${detections[0].message}`,
        );
    }
    lastEvent.current = Math.max(
      lastEvent.current || 0,
      ...events.map((e) => e.id),
    );
  }, [events, message]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!connected) return;
    let active = true;
    const update = async () => {
      try {
        const [ev, sy, hi] = await Promise.all([
          api<Event[]>("/events"),
          api<System>("/system"),
          api<{ safety: number; speed: number }[]>("/history"),
        ]);
        if (active) {
          setEvents(ev);
          setSystem(sy);
          setHistory(hi);
        }
      } catch {}
    };
    update();
    const timer = setInterval(update, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connected]);
  const action = useCallback(
    async (path: string, body: unknown = {}) => {
      setPending(true);
      try {
        await api(path, body);
      } catch (e) {
        message((e as Error).message);
      } finally {
        setPending(false);
      }
    },
    [message],
  );
  const estop = useCallback(() => {
    api("/estop", {})
      .then(() => message("Emergency stop acknowledged. Motion is inhibited."))
      .catch((e) => message("STOP NOT ACKNOWLEDGED: " + e.message));
  }, [message]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        estop();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [estop]);
  useEffect(() => {
    if (!goalModal && !resetModal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea, select, a[href]",
        ) || [],
      );
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = focusable(),
        first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [goalModal, resetModal]);
  const moving =
    !!d && ["AUTONOMOUS_NAVIGATION", "CAUTION_SLOW"].includes(d.state);
  const active =
    !!d &&
    [
      "AUTONOMOUS_NAVIGATION",
      "CAUTION_SLOW",
      "STOP_AND_SCAN",
      "RELOCALIZING",
      "REPLANNING",
    ].includes(d.state);
  const create = async () => {
    setPending(true);
    try {
      await api("/mission", { name, goal: draftGoal });
      setGoalModal(false);
      message("Mission created. Review the route, then start navigation.");
    } catch (e) {
      message((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const heading = page === "Mission Control" ? "Mission control" : page;
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("Mission Control");
          }}
        >
          <div className="brand-mark">
            <Navigation size={27} />
          </div>
          <div>
            ROVERA<span>AUTONOMY SYSTEMS</span>
          </div>
          <span className="brand-version">/ 01</span>
        </a>
        <div className="workspace-picker">
          <span className="rover-icon">
            <Box size={19} />
          </span>
          <div>
            <strong>ROVERA UGV</strong>
            <small>Edge workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.section}>
              <span className="nav-label">{group.section}</span>
              {group.items.map(({ name: label, icon: Icon }) => (
                <button
                  key={label}
                  aria-label={label}
                  title={label}
                  aria-current={page === label ? "page" : undefined}
                  className={page === label ? "active" : ""}
                  onClick={() => setPage(label)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {page === label && <span className="nav-active-dot" />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="edge-card">
            <div>
              <span
                className={connected ? "status-dot" : "status-dot offline"}
              />
              <strong>
                {connected ? "Edge computer online" : "Edge disconnected"}
              </strong>
            </div>
            <p>Local processing. No cloud dependency.</p>
            <span>
              <ShieldCheck size={13} /> SIMULATION ENVIRONMENT
            </span>
          </div>
          <a
            className="help-link"
            href={baseUrl + "/api/docs/deployment"}
            target="_blank"
            rel="noreferrer"
          >
            <CircleHelp size={17} /> Documentation
            <ArrowUpRight size={14} />
          </a>
          <div className="operator">
            <div className="avatar">OP</div>
            <div>
              <strong>Mission operator</strong>
              <small>Local workspace</small>
            </div>
            <span className="status-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            <span className={"connection " + (connected ? "" : "disconnected")}>
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
              {connected ? "Edge connected" : "Disconnected"}
            </span>
            <span className="top-divider" />
            <span className="clock">
              {clock.toLocaleTimeString("en-GB")} <small>LOCAL</small>
            </span>
            <button className="estop" onClick={estop}>
              <CircleStop size={18} /> E-STOP <kbd>ESC</kbd>
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">VISION-FIRST AUTONOMOUS NAVIGATION</div>
              <h1>
                {heading}
                <Badge tone="amber">SIMULATION</Badge>
              </h1>
              <p>
                {page === "Mission Control"
                  ? "See the terrain. Understand the route. Stay in control."
                  : page === "Mission Replay"
                    ? "Review every route, decision, and safety event."
                    : page === "Settings"
                      ? "Configure your local navigation workspace."
                      : "Understand the system behind every navigation decision."}
              </p>
            </div>
            <div className="heading-actions">
              <EnvironmentSelector
                data={d}
                disabled={!connected || pending}
                onMessage={message}
              />
              <button
                className="primary"
                onClick={() => {
                  setDraftGoal(d?.goal || [17.5, 17.5]);
                  setGoalModal(true);
                }}
                disabled={
                  !connected ||
                  !!d?.safety.latched ||
                  (!!d?.mission &&
                    !["COMPLETED", "CANCELLED"].includes(d.state))
                }
              >
                <Plus size={17} /> New mission
              </button>
            </div>
          </div>
          {!connected && (
            <div className="connection-banner" role="alert">
              <WifiOff size={17} />
              <div>
                <strong>
                  {d
                    ? "Telemetry connection lost — values are stale."
                    : "Waiting for the edge backend."}
                </strong>
                <span>
                  Start the project with scripts/start.ps1 or scripts/start.sh.
                  Controls require an acknowledged API response.
                </span>
              </div>
            </div>
          )}
          {d?.safety.latched && (
            <div className="estop-banner" role="alert">
              <CircleStop size={22} />
              <div>
                <strong>Emergency stop is latched</strong>
                <span>
                  Motion is inhibited. Restore healthy inputs before explicitly
                  resetting.
                </span>
              </div>
              <button onClick={() => setResetModal(true)}>
                Reset emergency stop
              </button>
            </div>
          )}
          {page === "Settings" ? (
            <SettingsView onMessage={message} />
          ) : page === "Mission Replay" ? (
            <ReplayView onMessage={message} />
          ) : page === "Calibration" ? (
            <CalibrationView onMessage={message} />
          ) : !d ? (
            <div className="loading-grid">
              <Panel title="Vision workspace" icon={Camera}>
                <Empty title="Connect to begin">
                  The dashboard does not substitute invented telemetry when the
                  backend is offline.
                </Empty>
              </Panel>
              <Panel title="Local navigation" icon={Map}>
                <Empty title="Awaiting telemetry">
                  Your mission map will appear here.
                </Empty>
              </Panel>
            </div>
          ) : (
            <>
              <div className="metrics">
                <Metric
                  label="Navigation state"
                  value={
                    moving
                      ? d.returning_to_base
                        ? "Returning"
                        : "Navigating"
                      : d.state === "EMERGENCY_STOP"
                        ? "Stopped"
                        : d.state === "STOP_AND_SCAN"
                          ? "Scanning"
                          : human(d.state)
                  }
                  icon={Navigation}
                  note={
                    moving
                      ? "Local coordinate frame"
                      : active
                        ? "Stopped · recovery checks"
                        : "Awaiting operator command"
                  }
                />
                <Metric
                  label="Linear velocity"
                  value={fmt(d.velocity, 2)}
                  unit="m/s"
                  icon={Gauge}
                  note="Simulation command velocity"
                />
                <Metric
                  label="Distance to goal"
                  value={fmt(d.remaining)}
                  unit="m"
                  icon={Flag}
                  note={`${fmt(d.distance)} m travelled this mission`}
                />
                <Metric
                  label="Localization"
                  value={d.slam.tracking === "LOST" ? "Lost" : "Tracking"}
                  icon={Focus}
                  note="Simulated pose · GPS independent"
                />
                <Metric
                  label="Planner latency"
                  value={fmt(d.planner.latency_ms, 1)}
                  unit="ms"
                  icon={Zap}
                  note={`${d.planner.replans} replans · A* planner`}
                />
              </div>
              {page === "Mission Control" ? (
                <>
                  <div className="mission-layout">
                    <div className="center-stack">
                      <Panel
                        title="Vision workspace"
                        icon={Camera}
                        action={
                          <div className="segmented">
                            <button
                              className={
                                cameraMode === "simulation" ? "selected" : ""
                              }
                              onClick={() => setCameraMode("simulation")}
                            >
                              Simulation
                            </button>
                            <button
                              className={
                                cameraMode === "bench" ? "selected" : ""
                              }
                              onClick={() => setCameraMode("bench")}
                            >
                              Bench camera
                            </button>
                          </div>
                        }
                        className="vision-panel"
                      >
                        {cameraMode === "bench" ? (
                          <BenchCamera />
                        ) : (
                          <>
                            <div className="vision-viewport">
                              <SimulationView
                                data={d}
                                mask={mask}
                                features={features}
                              />
                              <div className="vision-top">
                                <span>
                                  <span className="status-dot" /> SYNTHETIC
                                  CAMERA <b>SIM-01</b>
                                </span>
                                <span>3D VIEW · SIMULATED WORLD</span>
                              </div>
                              <div className="crosshair" />
                              <div className="vision-readout">
                                <span>LOCAL POSITION</span>
                                <strong>
                                  X {fmt(d.pose.x, 2)}
                                  <small>m</small> <i /> Y {fmt(d.pose.y, 2)}
                                  <small>m</small>
                                </strong>
                                <span>HEADING {fmt(d.pose.yaw, 1)}°</span>
                              </div>
                              <div className="vision-status">
                                <span
                                  className={
                                    "status-dot " +
                                    (d.safety.state === "RED" ? "offline" : "")
                                  }
                                />
                                {d.fault
                                  ? human(d.fault)
                                  : "Synthetic scene · no physical camera"}
                              </div>
                            </div>
                            <div className="overlay-controls">
                              <span>LAYERS</span>
                              <button
                                className={mask ? "selected" : ""}
                                onClick={() => setMask(!mask)}
                              >
                                <Route size={13} /> Route
                                {mask && <Check size={12} />}
                              </button>
                              <button
                                className={features ? "selected" : ""}
                                onClick={() => setFeatures(!features)}
                              >
                                <ScanLine size={13} /> World grid
                                {features && <Check size={12} />}
                              </button>
                              <span className="overlay-note">
                                Geometric simulation · not CV output
                              </span>
                            </div>
                          </>
                        )}
                      </Panel>
                      <div className="map-events-grid">
                        <Panel
                          title="Spatial overview"
                          icon={Map}
                          action={
                            <div className="segmented">
                              <button
                                className={
                                  tab === "Local map" ? "selected" : ""
                                }
                                onClick={() => setTab("Local map")}
                              >
                                Map
                              </button>
                              <button
                                className={tab === "Costmap" ? "selected" : ""}
                                onClick={() => setTab("Costmap")}
                              >
                                Costmap
                              </button>
                              <button
                                className={tab === "3D" ? "selected" : ""}
                                onClick={() => setTab("3D")}
                              >
                                3D
                              </button>
                            </div>
                          }
                        >
                          {tab === "3D" ? (
                            <Empty title="No depth source">
                              A measured 3D point cloud requires calibrated
                              stereo or RGB-D input.
                            </Empty>
                          ) : (
                            <LocalMap data={d} costmap={tab === "Costmap"} />
                          )}
                        </Panel>
                        <Panel
                          title="Mission events"
                          icon={Activity}
                          action={
                            <button
                              className="text-button"
                              onClick={() => setPage("Mission Replay")}
                            >
                              View archive <ArrowUpRight size={13} />
                            </button>
                          }
                        >
                          <EventList events={events} compact />
                          <div className="events-footer">
                            <span className="record-dot" />
                            {d.recording
                              ? "Evidence recorder enabled"
                              : "Recording disabled"}
                            <span>SQLite · local</span>
                          </div>
                        </Panel>
                      </div>
                    </div>
                    <div className="right-stack">
                      <Panel
                        title="Current mission"
                        icon={Flag}
                        action={
                          <span className="tiny-label">
                            {d.mission?.id.slice(0, 10) || "NO MISSION"}
                          </span>
                        }
                        className="mission-panel"
                      >
                        <div className="panel-body">
                          <div className="mission-name">
                            {d.mission?.name || "Ready for exploration"}
                          </div>
                          <div className="mission-meta">
                            <Badge tone={active ? "green" : "neutral"}>
                              {human(d.state)}
                            </Badge>
                            <span>Autonomous</span>
                          </div>
                          <div className="destination">
                            <Target size={20} />
                            <div>
                              <span>
                                {d.returning_to_base
                                  ? "RETURNING TO HOME STATION"
                                  : "DESTINATION · LOCAL FRAME"}
                              </span>
                              <strong>
                                {fmt(d.goal[0])}, {fmt(d.goal[1])}
                                <small> m</small>
                              </strong>
                            </div>
                          </div>
                          <div className="mission-controls">
                            <button
                              className="primary"
                              disabled={
                                pending ||
                                !connected ||
                                !d.mission ||
                                d.safety.latched ||
                                !["READY", "PAUSED"].includes(d.state)
                              }
                              onClick={() =>
                                action(
                                  "/mission/" +
                                    (d.state === "PAUSED" ? "resume" : "start"),
                                )
                              }
                            >
                              <Play size={15} />
                              {d.state === "PAUSED"
                                ? "Resume mission"
                                : "Start mission"}
                            </button>
                            <button
                              aria-label="Pause mission"
                              disabled={pending || !active || !connected}
                              onClick={() => action("/mission/pause")}
                            >
                              <Pause size={17} />
                            </button>
                            <button
                              aria-label="Cancel mission"
                              disabled={
                                pending ||
                                !d.mission ||
                                !connected ||
                                d.safety.latched ||
                                ["COMPLETED", "CANCELLED"].includes(d.state)
                              }
                              onClick={() => action("/mission/cancel")}
                            >
                              <Square size={14} />
                            </button>
                          </div>
                          <button
                            className="return-base"
                            disabled={
                              pending ||
                              !connected ||
                              d.safety.latched ||
                              !!d.fault ||
                              d.at_base ||
                              d.returning_to_base
                            }
                            onClick={() => action("/mission/return-to-base")}
                          >
                            <Home size={16} />
                            {d.at_base
                              ? "At home station"
                              : d.returning_to_base
                                ? "Returning to base"
                                : "Return to base"}
                            <span>
                              {Math.hypot(
                                d.pose.x - (d.base?.[0] || 2),
                                d.pose.y - (d.base?.[1] || 2),
                              ).toFixed(1)}{" "}
                              m
                            </span>
                          </button>
                        </div>
                      </Panel>
                      <DetectionsPanel data={d} />
                      <SafetyPanel d={d} />
                      <Panel
                        title="Scenario lab"
                        icon={SlidersHorizontal}
                        action={<Badge tone="neutral">SIM ONLY</Badge>}
                      >
                        <ScenarioTools
                          data={d}
                          disabled={!connected || pending}
                          action={action}
                        />
                      </Panel>
                    </div>
                  </div>
                </>
              ) : page === "Spatial Mapping" ? (
                <div className="detail-grid">
                  <Panel
                    title="Spatial map"
                    icon={Focus}
                    action={<Badge tone="amber">SIMULATED POSE</Badge>}
                  >
                    <LocalMap data={d} />
                  </Panel>
                  <div>
                    <Panel title="Pose & tracking" icon={Crosshair}>
                      <div className="data-list">
                        {[
                          ["Frame", d.pose.frame],
                          ["Position X", fmt(d.pose.x, 3) + " m"],
                          ["Position Y", fmt(d.pose.y, 3) + " m"],
                          ["Yaw", fmt(d.pose.yaw, 2) + "°"],
                          ["Features", "N/A — no SLAM engine"],
                          ["Loop closure", "N/A"],
                          ["Estimated drift", "N/A — no ground truth"],
                          ["GNSS reference", "Not connected"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <span>{k}</span>
                            <strong>{v}</strong>
                          </div>
                        ))}
                      </div>
                    </Panel>
                    <SafetyPanel d={d} />
                  </div>
                </div>
              ) : page === "Terrain Intelligence" ? (
                <>
                  <BenchCamera />
                  <div className="detail-grid">
                    <Panel title="Simulation terrain" icon={Layers}>
                      <LocalMap data={d} costmap />
                    </Panel>
                    <Panel title="Obstacle inventory" icon={Box}>
                      <div className="data-list">
                        {d.obstacles.map((o) => (
                          <div key={o.id}>
                            <span>
                              {o.id} · {o.kind}
                            </span>
                            <strong>
                              {fmt(o.x)}, {fmt(o.y)} m
                            </strong>
                          </div>
                        ))}
                      </div>
                      <div className="info-box">
                        <Layers size={18} />
                        <p>
                          This inventory comes from simulator geometry. Real
                          terrain segmentation requires a trained model; no
                          model is loaded.
                        </p>
                      </div>
                    </Panel>
                  </div>
                </>
              ) : page === "Planner & Costmap" ? (
                <div className="detail-grid">
                  <Panel
                    title="Inflated terrain costmap"
                    icon={Route}
                    action={<Badge>0.5 m / cell</Badge>}
                  >
                    <LocalMap data={d} costmap />
                    <div className="legend">
                      <span>
                        <i className="safe" />
                        Safe
                      </span>
                      <span>
                        <i className="caution" />
                        Caution
                      </span>
                      <span>
                        <i className="risk" />
                        Inflated / blocked
                      </span>
                    </div>
                  </Panel>
                  <div>
                    <Panel title="Route decisions" icon={Route}>
                      <div className="data-list">
                        {[
                          ["Planner", d.planner.name],
                          [
                            "Safety inflation",
                            fmt(d.planner.margin_m, 2) + " m",
                          ],
                          [
                            "Planning time",
                            fmt(d.planner.latency_ms, 2) + " ms",
                          ],
                          ["Replan count", String(d.planner.replans)],
                          ["Remaining route", fmt(d.remaining) + " m"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <span>{k}</span>
                            <strong>{v}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="panel-body">
                        <button
                          onClick={() =>
                            action("/simulation/scenario", { kind: "obstacle" })
                          }
                        >
                          <Plus size={16} /> Introduce an obstacle
                        </button>
                      </div>
                    </Panel>
                    <Panel title="Replan evidence" icon={Activity}>
                      <EventList
                        events={events.filter((e) => e.type === "REPLAN")}
                      />
                    </Panel>
                  </div>
                </div>
              ) : page === "System Health" ? (
                <>
                  <div className="resource-grid">
                    {[
                      ["CPU", system?.cpu],
                      ["Memory", system?.ram],
                      ["Disk", system?.disk],
                      ["GPU", null],
                    ].map(([label, value]) => (
                      <Metric
                        key={String(label)}
                        label={String(label)}
                        value={fmt(value as number | null)}
                        unit={value === null ? "" : "%"}
                        icon={Activity}
                        note="Measured on edge host"
                      />
                    ))}
                  </div>
                  <Panel
                    title="Service health"
                    icon={Radio}
                    action={<Badge tone="blue">HOST METRICS</Badge>}
                  >
                    <div className="service-grid">
                      {system?.services.map((s) => (
                        <div className="service" key={s.name}>
                          <span
                            className={
                              s.state === "HEALTHY"
                                ? "status-dot"
                                : "status-dot muted-dot"
                            }
                          />
                          <div>
                            <strong>{s.name}</strong>
                            <small>{human(s.state)}</small>
                          </div>
                          {s.state === "HEALTHY" ? (
                            <Check size={16} />
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel
                    title="Recorded telemetry · last 60 seconds"
                    icon={Activity}
                  >
                    <div className="chart">
                      <div className="chart-axis">
                        <span>100%</span>
                        <span>50%</span>
                        <span>0%</span>
                      </div>
                      <svg
                        viewBox="0 0 600 120"
                        preserveAspectRatio="none"
                        aria-label="Simulation safety confidence history"
                      >
                        <path
                          d="M0 10H600M0 60H600M0 110H600"
                          stroke="#2a3430"
                          strokeDasharray="3 3"
                        />
                        {history.length > 1 && (
                          <polyline
                            fill="none"
                            stroke="#94e8b5"
                            strokeWidth="2"
                            points={history
                              .map(
                                (h, i) =>
                                  `${(i * 600) / (history.length - 1)},${110 - h.safety * 100}`,
                              )
                              .join(" ")}
                          />
                        )}
                      </svg>
                    </div>
                    <div className="chart-label">
                      Safety score · simulation source
                    </div>
                  </Panel>
                </>
              ) : null}
            </>
          )}
          <footer className="footer">
            <span>
              <ShieldCheck size={13} /> EDGE-FIRST ARCHITECTURE
              <span className="footer-divider">/</span>GPS-independent
              navigation
            </span>
            <span>
              ROVERA <b>v1.1</b> <span className="footer-divider">/</span> SIH ·
              BEL
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Activity size={18} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {goalModal && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mission-dialog"
          >
            <div className="modal-title">
              <div>
                <span className="eyebrow">MISSION PLANNING</span>
                <h2 id="mission-dialog">Choose your destination</h2>
              </div>
              <button
                aria-label="Close mission planner"
                onClick={() => setGoalModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="muted">
              Click a clear point on the map or enter local coordinates.
            </p>
            {d && <LocalMap data={d} onGoal={setDraftGoal} goal={draftGoal} />}
            <div className="goal-form">
              <label>
                Mission name
                <input
                  autoFocus
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <div className="coordinate-inputs">
                <label>
                  Goal X (m)
                  <input
                    type="number"
                    min=".5"
                    max="19"
                    step=".5"
                    value={draftGoal[0]}
                    onChange={(e) =>
                      setDraftGoal([+e.target.value, draftGoal[1]])
                    }
                  />
                </label>
                <label>
                  Goal Y (m)
                  <input
                    type="number"
                    min=".5"
                    max="19"
                    step=".5"
                    value={draftGoal[1]}
                    onChange={(e) =>
                      setDraftGoal([draftGoal[0], +e.target.value])
                    }
                  />
                </label>
              </div>
              <button
                className="primary"
                onClick={create}
                disabled={pending || !name.trim()}
              >
                <Flag size={16} />
                {pending ? "Planning route…" : "Create mission"}
              </button>
            </div>
          </section>
        </div>
      )}
      {resetModal && (
        <div className="modal-backdrop">
          <section
            className="modal compact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <h2 id="reset-title">Reset emergency stop?</h2>
            <p>
              Only reset after checking the environment and restoring healthy
              sensor inputs. The mission will remain paused until you resume it.
            </p>
            <div className="button-row">
              <button onClick={() => setResetModal(false)}>Keep stopped</button>
              <button
                className="primary"
                onClick={() => {
                  action("/estop/reset");
                  setResetModal(false);
                }}
              >
                Confirm reset
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
