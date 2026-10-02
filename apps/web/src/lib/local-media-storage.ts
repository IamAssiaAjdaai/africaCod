import "server-only";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { MediaStorage } from "@africacod/domain";
import "@africacod/shared";
// Runtime uploads stay within this app’s data directory, outside public assets.
const directory = join(process.cwd(), ".data", "media");
function path(key: string) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key))
    throw new Error("Invalid storage key.");
  return join(directory, key);
}
export const localMediaStorage: MediaStorage = {
  async put(key, bytes) {
    await mkdir(directory, { recursive: true });
    await writeFile(path(key), bytes, { flag: "wx" });
  },
  async read(key) {
    return new Uint8Array(await readFile(path(key)));
  },
  async remove(key) {
    await rm(path(key), { force: true });
  },
};
