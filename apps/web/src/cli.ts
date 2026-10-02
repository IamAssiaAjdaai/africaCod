import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { runtimeEnvironment, logEvent } from "@africacod/shared";
// Next.js may initialize instrumentation lazily. Validate before starting its CLI/listener.
const env = runtimeEnvironment();
process.env.APP_ENV = env.APP_ENV;
const require = createRequire(resolve(process.cwd(), "package.json"));
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), ...process.argv.slice(2)],
  { env: process.env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  logEvent("error", "web.cli_failed");
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 128 : 1)));
