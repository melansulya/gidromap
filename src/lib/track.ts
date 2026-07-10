export function track(action: string, details?: Record<string, unknown>) {
  fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, details }),
  }).catch(() => {});
}
