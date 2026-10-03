import { useEffect, useRef, useState } from "react";
import { Camera, VideoOff } from "lucide-react";
import { analyze } from "./api";
export default function BenchCamera() {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    stream = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{
      exposure: string;
      feature_count: number;
      latency_ms: number;
      enhancement_active: boolean;
      features: number[][];
    } | null>(null);
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setActive(false);
    setResult(null);
  };
  const start = async () => {
    try {
      setError("");
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setActive(true);
    } catch (e) {
      stop();
      setError(
        e instanceof Error ? e.message : "Camera permission unavailable.",
      );
    }
  };
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const capture = async () => {
      try {
        const v = video.current,
          c = canvas.current;
        if (v && c && v.readyState >= 2) {
          c.width = 640;
          c.height = Math.round((640 * v.videoHeight) / v.videoWidth);
          c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
          const blob = await new Promise<Blob | null>((r) =>
            c.toBlob(r, "image/jpeg", 0.7),
          );
          if (blob) {
            const value = await analyze(blob);
            if (!cancelled) setResult(value);
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) timer = setTimeout(capture, 700);
      }
    };
    capture();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active]);
  return (
    <section className="panel bench">
      <div className="panel-heading">
        <h3>
          <Camera size={16} /> Bench camera
        </h3>
        <span className="badge blue">REAL CAMERA · NO MOTORS</span>
      </div>
      <div className="bench-video">
        <video ref={video} muted playsInline />
        {!active && (
          <div className="empty-overlay">
            <VideoOff size={32} />
            <h3>Connect your camera</h3>
            <p>Test exposure and visual features with your device.</p>
          </div>
        )}
        {active && result && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="feature-overlay"
          >
            {result.features.map((p, i) => (
              <circle
                key={i}
                cx={p[0] * 100}
                cy={p[1] * 100}
                r=".3"
                fill="#a8ffca"
              />
            ))}
          </svg>
        )}
      </div>
      <canvas ref={canvas} hidden />
      <div className="panel-body">
        <div className="button-row">
          <button className="primary" onClick={active ? stop : start}>
            {active ? "Disconnect camera" : "Enable camera"}
          </button>
          {result && (
            <span className="muted">
              {result.feature_count} ORB features · {result.exposure} ·{" "}
              {result.latency_ms} ms
            </span>
          )}
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <p className="muted">
          Real OpenCV diagnostics. ORB features and CLAHE analysis do not
          provide terrain segmentation or metric SLAM. Frames are processed
          locally by your edge API and are not stored.
        </p>
      </div>
    </section>
  );
}
