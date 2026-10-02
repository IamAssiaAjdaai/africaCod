type Context = {
  requestId?: string;
  organizationId?: string;
  storeId?: string;
  orderId?: string;
  jobId?: string;
  eventType?: string;
  code?: string;
};
type Record = {
  time: string;
  level: "info" | "error";
  event: string;
} & Context;
let monitor: ((record: Record) => void) | undefined;
export function setErrorMonitor(handler: (record: Record) => void) {
  monitor = handler;
}
export function logEvent(
  level: Record["level"],
  event: string,
  context: Context = {},
) {
  const record: Record = {
    time: new Date().toISOString(),
    level,
    event: /^[a-z0-9_.-]{1,80}$/i.test(event) ? event : "application.error",
  };
  for (const name of [
    "requestId",
    "organizationId",
    "storeId",
    "orderId",
    "jobId",
    "eventType",
    "code",
  ] as const) {
    const value = context[name];
    if (value && /^[a-z0-9_.:-]{1,120}$/i.test(value)) record[name] = value;
  }
  (level === "error" ? console.error : console.info)(JSON.stringify(record));
  if (level === "error") {
    try {
      monitor?.(record);
    } catch {
      /* Monitoring cannot interrupt business operations. */
    }
  }
}
