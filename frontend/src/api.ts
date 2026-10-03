const buildUrl =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_URL || "";
export const baseUrl = buildUrl.replace(/\/$/, "");
let token = sessionStorage.getItem("operator-token") || "";
export function setToken(value: string) {
  token = value;
  sessionStorage.setItem("operator-token", value);
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(baseUrl + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : "Check the input values and try again.",
    );
  }
  return response.json();
}
export async function analyze(blob: Blob) {
  const response = await fetch(baseUrl + "/api/vision/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: blob,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok)
    throw new Error(
      "Frame analysis unavailable. Check operator access and the backend.",
    );
  return response.json();
}
export function wsUrl() {
  return (baseUrl || location.origin).replace(/^http/, "ws") + "/ws/telemetry";
}
export function exportJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
