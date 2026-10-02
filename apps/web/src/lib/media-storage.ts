import "server-only";
import { runtimeEnvironment } from "@africacod/shared";
import { localMediaStorage } from "./local-media-storage";
import { S3MediaStorage } from "./s3-media-storage";
import type { MediaStorage } from "@africacod/domain";
let instance: MediaStorage | undefined;
export function mediaStorage(): MediaStorage {
  if (instance) return instance;
  const env = runtimeEnvironment();
  instance =
    env.MEDIA_STORAGE === "s3"
      ? new S3MediaStorage({
          endpoint: env.S3_ENDPOINT!,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET!,
          accessKeyId: env.S3_ACCESS_KEY_ID!,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
        })
      : localMediaStorage;
  return instance;
}
