import { it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRootEnvironment } from "./node";
const directories: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.ENV_BOUNDARY_FROM_FILE;
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "africacod-env-"));
  directories.push(root);
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
  writeFileSync(
    join(root, ".env"),
    "ENV_BOUNDARY_AUTHORITATIVE=file-value\nENV_BOUNDARY_FROM_FILE=root-value\n",
  );
  const workspace = join(root, "apps", "worker");
  mkdirSync(workspace, { recursive: true });
  return { root, workspace };
}
it("explicit Node loading finds the repository root from a workspace and preserves process overrides", () => {
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("ENV_BOUNDARY_AUTHORITATIVE", "process-value");
  const { workspace } = fixture();
  loadRootEnvironment(workspace);
  expect(process.env.ENV_BOUNDARY_FROM_FILE).toBe("root-value");
  expect(process.env.ENV_BOUNDARY_AUTHORITATIVE).toBe("process-value");
});
it.each([
  { APP_ENV: "production", NODE_ENV: "test" },
  { APP_ENV: undefined, NODE_ENV: "production" },
])("never loads dotenv in production: %j", (env) => {
  vi.stubEnv("APP_ENV", env.APP_ENV);
  vi.stubEnv("NODE_ENV", env.NODE_ENV);
  loadRootEnvironment(fixture().workspace);
  expect(process.env.ENV_BOUNDARY_FROM_FILE).toBeUndefined();
});
it("does not load an unrelated directory's .env outside a repository", () => {
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NODE_ENV", "development");
  const { root, workspace } = fixture();
  rmSync(join(root, "pnpm-workspace.yaml"));
  loadRootEnvironment(workspace);
  expect(process.env.ENV_BOUNDARY_FROM_FILE).toBeUndefined();
});
