import { useEffect, useState } from "react";
import { wsUrl } from "./api";
import type { Telemetry } from "./types";
export function useTelemetry() {
  const [data, setData] = useState<Telemetry | null>(null),
    [connected, setConnected] = useState(false);
  useEffect(() => {
    let ws: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout>;
    let active = true;
    let last = 0;
    const connect = () => {
      if (!active) return;
      ws = new WebSocket(wsUrl());
      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.timestamp) {
            last = Date.now();
            setData(packet);
            setConnected(true);
          }
        } catch {
          setConnected(false);
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (active) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    const watchdog = setInterval(() => {
      if (last && Date.now() - last > 2500) {
        setConnected(false);
        ws?.close();
      }
    }, 1000);
    return () => {
      active = false;
      clearTimeout(retry);
      clearInterval(watchdog);
      ws?.close();
    };
  }, []);
  return { data, connected };
}
