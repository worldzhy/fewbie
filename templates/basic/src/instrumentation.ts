// Next.js instrumentation hook: runs once when the server process boots.
// Reports application liveness to the nightwatch platform when the two
// NIGHTWATCH_* env vars are configured; otherwise this is a safe no-op.
export async function register(): Promise<void> {
  // The heartbeat SDK uses Node APIs; skip the edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startHeartbeat } = await import("@devbie/nightwatch-heartbeat-sdk");
  const endpoint = process.env.NIGHTWATCH_REPORT_ENDPOINT;
  const token = process.env.NIGHTWATCH_APPLICATION_TOKEN;
  if (endpoint && token) {
    startHeartbeat({ endpoint, token });
  }
}
