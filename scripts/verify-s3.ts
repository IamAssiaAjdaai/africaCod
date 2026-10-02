import { randomUUID } from "node:crypto";
import { S3MediaStorage } from "../apps/web/src/lib/s3-media-storage";
import {
  normalizedImage,
  optimizedImage,
} from "../apps/web/src/lib/image-processing";
import sharp from "../apps/web/node_modules/sharp/dist/index.mjs";
// Local emulator verification only; never use production bucket credentials for this script.
const storage = new S3MediaStorage({
  endpoint: "http://localhost:9090",
  region: "us-east-1",
  bucket: "africacod-test-media",
  accessKeyId: "local-test",
  secretAccessKey: "local-test",
});
const key = `${randomUUID()}.png`;
const image = await normalizedImage(
  await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "#789abc" },
  })
    .png()
    .toBuffer(),
  "image/png",
);
await storage.put(key, image, "image/png");
const read = await storage.read(key);
if (read.length !== image.length) throw new Error("S3 roundtrip mismatch");
const small = await optimizedImage(storage, key, 320);
const metadata = await sharp(small).metadata();
if (metadata.width !== 320 || metadata.format !== "webp")
  throw new Error("S3 derivative mismatch");
await storage.remove(key);
try {
  await storage.read(key);
  throw new Error("S3 deletion failed");
} catch (error) {
  if (!(error instanceof Error) || error.name !== "NoSuchKey") throw error;
}
console.info(
  "S3 SDK network roundtrip, private key namespace, responsive derivative and deletion passed against local S3 emulator. Live R2 credentials/ACL verification remains external.",
);
