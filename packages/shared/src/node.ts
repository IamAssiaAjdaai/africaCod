import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Call only from Node entry points, before reading/validating process.env.
// Importing this module alone does not load files or traverse directories.
export function loadRootEnvironment(startDirectory?: string) {
  if (
    process.env.APP_ENV === "production" ||
    process.env.NODE_ENV === "production"
  )
    return;
  let directory = startDirectory ?? process.cwd();
  while (
    !existsSync(join(directory, "pnpm-workspace.yaml")) &&
    dirname(directory) !== directory
  )
    directory = dirname(directory);
  if (!existsSync(join(directory, "pnpm-workspace.yaml"))) return;
  config({ path: join(directory, ".env"), quiet: true, override: false });
}
