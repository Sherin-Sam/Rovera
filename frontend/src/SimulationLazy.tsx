import { lazy, Suspense } from "react";
import type { Telemetry } from "./types";
const Scene = lazy(() => import("./SimulationView"));
export default function SimulationLazy(props: {
  data: Telemetry;
  mask: boolean;
  features: boolean;
}) {
  return (
    <Suspense
      fallback={<div className="empty-overlay">Loading simulation view…</div>}
    >
      <Scene {...props} />
    </Suspense>
  );
}
