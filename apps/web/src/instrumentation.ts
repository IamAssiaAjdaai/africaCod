export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  )
    return;
  const { runtimeEnvironment, logEvent } = await import("@africacod/shared");
  const env = runtimeEnvironment();
  logEvent("info", "application.started", { code: env.APP_ENV });
}
export async function onRequestError(
  _error: unknown,
  request: { headers?: Record<string, string | string[] | undefined> },
  context: { routeType?: string },
) {
  const { logEvent } = await import("@africacod/shared");
  logEvent("error", "request.failed", {
    code: context.routeType,
    requestId:
      typeof request.headers?.["x-request-id"] === "string"
        ? request.headers["x-request-id"]
        : undefined,
  });
}
