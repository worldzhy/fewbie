// Next.js instrumentation hook: runs once when the server process boots.
// Reports application liveness to the heartbeat server when the two
// HEARTBEAT_* env vars are configured; otherwise this is a safe no-op.
export async function register(): Promise<void> {
  // The heartbeat SDK uses Node APIs; skip the edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startHeartbeat } = await import("@devbie/heartbeat-sdk");
  const endpoint = process.env.HEARTBEAT_ENDPOINT;
  const token = process.env.HEARTBEAT_TOKEN;
  if (endpoint && token) {
    startHeartbeat({ endpoint, token });
  }
}
