import { useEffect, useId, useRef, useState } from "react";
import {
  Crosshair,
  Minus,
  Plus,
  Home,
  Layers,
  MapPin,
  X,
  Route,
  Navigation,
} from "lucide-react";
import type { Point, Telemetry } from "./types";

const colors: Record<string, string> = {
  road: "#777d79",
  trail: "#a39475",
  paving: "#8b948d",
  grass: "#597753",
  gravel: "#ac9e82",
};
export default function LocalMap({
  data,
  costmap = false,
  onGoal,
  goal,
}: {
  data: Telemetry;
  costmap?: boolean;
  onGoal?: (p: Point) => void;
  goal?: Point;
}) {
  const id = useId().replace(/:/g, "");
  const [zoom, setZoom] = useState(1),
    [center, setCenter] = useState<Point>([200, 200]),
    [labels, setLabels] = useState(true),
    [trail, setTrail] = useState(true),
    [risk, setRisk] = useState(costmap),
    [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{
      x: number;
      y: number;
      center: Point;
      scale: number;
    } | null>(null),
    moved = useRef(false);
  useEffect(() => setRisk(costmap), [costmap]);
  useEffect(() => {
    setZoom(1);
    setCenter([200, 200]);
    setSelected(null);
  }, [data.world?.id]);
  const transform = (p: Point) => `${p[0] * 20},${400 - p[1] * 20}`;
  const destination = goal || data.goal,
    base = data.base || [2, 2];
  const object = data.obstacles.find((o) => o.id === selected),
    viewSize = 440 / zoom;
  const changeZoom = (factor: number) =>
    setZoom((z) => Math.max(1, Math.min(4, z * factor)));
  return (
    <div className={"map-surface modern-map " + (onGoal ? "selectable" : "")}>
      <div className="map-toolbar">
        <span>
          <MapPin size={12} />
          {data.world?.name || "Recorded local map"}
        </span>
        <div>
          <button
            aria-label="Toggle object labels"
            aria-pressed={labels}
            className={labels ? "selected" : ""}
            onClick={() => setLabels(!labels)}
          >
            <MapPin size={13} />
          </button>
          <button
            aria-label="Toggle travelled trail"
            aria-pressed={trail}
            className={trail ? "selected" : ""}
            onClick={() => setTrail(!trail)}
          >
            <Route size={13} />
          </button>
          <button
            aria-label="Toggle clearance layer"
            aria-pressed={risk}
            className={risk ? "selected" : ""}
            onClick={() => setRisk(!risk)}
          >
            <Layers size={13} />
          </button>
        </div>
      </div>
      <svg
        viewBox={`${center[0] - viewSize / 2} ${center[1] - viewSize / 2} ${viewSize} ${viewSize}`}
        role="img"
        aria-label={
          onGoal
            ? "Interactive mission map. Choose a destination or enter coordinates."
            : "Interactive spatial map with obstacles, route and home station"
        }
        onPointerDown={(e) => {
          moved.current = false;
          if (onGoal) return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            center: [...center],
            scale: e.currentTarget.getScreenCTM()?.a || 1,
          };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x,
            dy = e.clientY - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) {
            moved.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          setCenter([
            Math.max(
              0,
              Math.min(400, drag.current.center[0] - dx / drag.current.scale),
            ),
            Math.max(
              0,
              Math.min(400, drag.current.center[1] - dy / drag.current.scale),
            ),
          ]);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
        onClick={(e) => {
          if (!onGoal || moved.current) return;
          const matrix = e.currentTarget.getScreenCTM();
          if (!matrix) return;
          const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
            matrix.inverse(),
          );
          const x = p.x / 20,
            y = (400 - p.y) / 20;
          if (x >= 0.5 && x <= 19 && y >= 0.5 && y <= 19)
            onGoal([Math.round(x * 2) / 2, Math.round(y * 2) / 2]);
        }}
      >
        <defs>
          <pattern
            id={id + "grid"}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M20 0H0V20"
              fill="none"
              stroke="#dde8d3"
              strokeOpacity=".14"
              strokeWidth=".6"
            />
          </pattern>
          <pattern
            id={id + "terrain"}
            width="19"
            height="17"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="3" cy="5" r=".8" fill="#203d29" opacity=".23" />
            <path d="m10 8 2-1m1 6 2 1" stroke="#c5c9a0" strokeOpacity=".2" />
          </pattern>
        </defs>
        <rect x="-200" y="-200" width="800" height="800" fill="#172920" />
        <rect width="400" height="400" fill={data.world?.ground || "#778767"} />
        <rect width="400" height="400" fill={`url(#${id}terrain)`} />
        {data.world?.surfaces.map((s, i) => (
          <g key={i}>
            <rect
              x={(s.x - s.width / 2) * 20}
              y={400 - (s.y + s.height / 2) * 20}
              width={s.width * 20}
              height={s.height * 20}
              fill={colors[s.kind] || colors.trail}
              stroke="#dce4cc"
              strokeOpacity=".15"
              strokeWidth="2"
            />
            {s.kind === "road" &&
              (s.height > s.width ? (
                <path
                  d={`M${s.x * 20} ${400 - (s.y + s.height / 2) * 20}v${s.height * 20}`}
                  stroke="#d8d2ae"
                  strokeWidth="1.4"
                  strokeDasharray="9 8"
                />
              ) : (
                <path
                  d={`M${(s.x - s.width / 2) * 20} ${400 - s.y * 20}h${s.width * 20}`}
                  stroke="#d8d2ae"
                  strokeWidth="1.4"
                  strokeDasharray="9 8"
                />
              ))}
          </g>
        ))}
        <rect
          width="400"
          height="400"
          fill={`url(#${id}grid)`}
          stroke="#c7d7b6"
          strokeWidth="1"
          strokeDasharray="5 4"
        />
        {[0, 5, 10, 15, 20].map((n) => (
          <g key={n} fill="#b4c8b7" fontSize="8" fontFamily="monospace">
            <text x={n * 20} y="414" textAnchor="middle">
              {n}m
            </text>
            <text x="-6" y={403 - n * 20} textAnchor="end">
              {n}
            </text>
          </g>
        ))}
        {data.obstacles.map((o) => {
          const cx = o.x * 20,
            cy = 400 - o.y * 20,
            detected = data.detections?.some((d) => d.id === o.id),
            color = o.color || "#8e9d78";
          return (
            <g
              key={o.id}
              role="button"
              tabIndex={onGoal ? -1 : 0}
              aria-label={`Inspect ${o.label || o.kind} ${o.id}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(o.id);
                }
              }}
              onClick={(e) => {
                if (!onGoal && !moved.current) {
                  e.stopPropagation();
                  setSelected(o.id);
                }
              }}
            >
              {risk &&
                (o.shape === "box" ? (
                  <rect
                    x={cx - ((o.width || 1) / 2 + 0.65) * 20}
                    y={cy - ((o.length || 1) / 2 + 0.65) * 20}
                    width={((o.width || 1) + 1.3) * 20}
                    height={((o.length || 1) + 1.3) * 20}
                    rx="13"
                    fill="#efab5438"
                    stroke="#efc374"
                    strokeDasharray="3 3"
                  />
                ) : (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={(o.radius + 0.65) * 20}
                    fill="#efab5438"
                    stroke="#efc374"
                    strokeDasharray="3 3"
                  />
                ))}
              {o.shape === "box" ? (
                <>
                  <rect
                    x={cx - (o.width || 1) * 10 + 2}
                    y={cy - (o.length || 1) * 10 + 3}
                    width={(o.width || 1) * 20}
                    height={(o.length || 1) * 20}
                    fill="#17201955"
                    rx="2"
                  />
                  <rect
                    x={cx - (o.width || 1) * 10}
                    y={cy - (o.length || 1) * 10}
                    width={(o.width || 1) * 20}
                    height={(o.length || 1) * 20}
                    fill={color}
                    stroke="#d3d7c1"
                    rx="2"
                  />
                  {o.kind === "vehicle" && (
                    <rect
                      x={cx - (o.width || 1) * 7}
                      y={cy - 8}
                      width={(o.width || 1) * 14}
                      height="16"
                      rx="2"
                      fill="#344c56"
                    />
                  )}
                  {o.kind === "crate" && (
                    <path
                      d={`M${cx - 10} ${cy - 10}l20 20m0-20-20 20`}
                      stroke="#674d31"
                      strokeWidth="2"
                    />
                  )}
                </>
              ) : o.kind === "pedestrian" ? (
                <g>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="9"
                    fill="#eba84f"
                    stroke="#fff0c9"
                  />
                  <circle cx={cx} cy={cy} r="3" fill="#514135" />
                </g>
              ) : o.kind === "cone" ? (
                <path
                  d={`M${cx} ${cy - 6}l7 13h-14z`}
                  fill="#f49b52"
                  stroke="#ffe8c8"
                />
              ) : (
                <g>
                  <ellipse
                    cx={cx + 3}
                    cy={cy + 4}
                    rx={o.radius * 20}
                    ry={o.radius * 18}
                    fill="#11251840"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={o.radius * 20}
                    fill={color}
                    stroke={o.kind === "water" ? "#a0cad8" : "#b4c49d"}
                  />
                  {o.kind === "tree" && (
                    <>
                      <circle
                        cx={cx - 3}
                        cy={cy - 3}
                        r={o.radius * 12}
                        fill="#679465"
                      />
                      <circle
                        cx={cx + 5}
                        cy={cy + 2}
                        r={o.radius * 9}
                        fill="#396d48"
                      />
                    </>
                  )}
                </g>
              )}
              {detected && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={o.radius * 20 + 4}
                  fill="none"
                  stroke="#ffc777"
                  strokeWidth="1.5"
                />
              )}
              {labels && (
                <g transform={`translate(${cx},${cy - o.radius * 20 - 10})`}>
                  <rect
                    x="-25"
                    y="-6"
                    width="50"
                    height="12"
                    rx="3"
                    fill="#10241deb"
                  />
                  <text
                    textAnchor="middle"
                    y="2"
                    fontSize="7"
                    fill={detected ? "#ffd39a" : "#e1eee3"}
                  >
                    {o.id} · {o.kind.slice(0, 5).toUpperCase()}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {risk && data.old_route.length > 0 && (
          <polyline
            points={data.old_route.map(transform).join(" ")}
            fill="none"
            stroke="#f0ab7f"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}
        {trail && (
          <polyline
            points={data.trajectory.map(transform).join(" ")}
            fill="none"
            stroke="#dbeadd"
            strokeOpacity=".65"
            strokeWidth="2"
          />
        )}
        <polyline
          points={[[data.pose.x, data.pose.y] as Point, ...data.route]
            .map(transform)
            .join(" ")}
          fill="none"
          stroke="#183e30"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <polyline
          points={[[data.pose.x, data.pose.y] as Point, ...data.route]
            .map(transform)
            .join(" ")}
          fill="none"
          stroke={data.returning_to_base ? "#89d2ff" : "#b8ffd3"}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeDasharray="6 3"
        />
        <g transform={`translate(${base[0] * 20},${400 - base[1] * 20})`}>
          <rect
            x="-12"
            y="-12"
            width="24"
            height="24"
            rx="5"
            fill="#204457"
            stroke="#9ad6f4"
          />
          <path
            d="m-7 0 7-6 7 6m-11-2v8h8v-8"
            fill="none"
            stroke="#c7ebff"
            strokeWidth="1.5"
          />
          <text y="23" textAnchor="middle" fill="#d4ebf5" fontSize="8">
            BASE
          </text>
        </g>
        {!data.returning_to_base && (
          <g
            transform={`translate(${destination[0] * 20},${400 - destination[1] * 20})`}
          >
            <circle r="11" fill="#163d2c" stroke="#caffd6" />
            <circle r="4" fill="#caffd6" />
            <text x="15" y="3" fontSize="8" fill="#e5ffed">
              GOAL
            </text>
          </g>
        )}
        <g
          transform={`translate(${data.pose.x * 20},${400 - data.pose.y * 20}) rotate(${-data.pose.yaw})`}
        >
          <path
            d="M0 0 70-44A82 82 0 0 1 70 44Z"
            fill="#d3f7e51b"
            stroke="#d7ffee44"
            strokeWidth=".5"
          />
          <circle r="13" fill="#0a2c23" stroke="#b1f8cf" />
          <path d="M9 0-6-5-3 0-6 5Z" fill="#c7ffdf" />
        </g>
      </svg>
      <div className="map-zoom">
        <button aria-label="Zoom in" onClick={() => changeZoom(1.3)}>
          <Plus size={15} />
        </button>
        <span>{zoom.toFixed(1)}×</span>
        <button aria-label="Zoom out" onClick={() => changeZoom(1 / 1.3)}>
          <Minus size={15} />
        </button>
        <button
          aria-label="Fit entire map"
          onClick={() => {
            setZoom(1);
            setCenter([200, 200]);
          }}
        >
          <Crosshair size={15} />
        </button>
        <button
          aria-label="Center on rover"
          onClick={() => {
            setZoom(2);
            setCenter([data.pose.x * 20, 400 - data.pose.y * 20]);
          }}
        >
          <Navigation size={15} />
        </button>
      </div>
      {object && !onGoal && (
        <div className="map-inspector">
          <div>
            <span style={{ background: object.color }} />
            <strong>{object.label || object.kind}</strong>
            <button
              aria-label="Close object details"
              onClick={() => setSelected(null)}
            >
              <X size={12} />
            </button>
          </div>
          <p>
            {object.id} ·{" "}
            {Math.hypot(object.x - data.pose.x, object.y - data.pose.y).toFixed(
              1,
            )}{" "}
            m away
          </p>
          <small>
            X {object.x.toFixed(1)} / Y {object.y.toFixed(1)} ·{" "}
            {object.risk || "high"} risk
          </small>
        </div>
      )}
      <div className="map-caption">
        <span>
          <Home size={10} />{" "}
          {data.at_base ? "At home station" : "LOCAL FRAME · METERS"}
        </span>
        <span>1 m grid · drag to pan</span>
      </div>
    </div>
  );
}
