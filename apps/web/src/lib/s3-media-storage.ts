import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { maxImageBytes, type MediaStorage } from "@africacod/domain";
export const imageWidths = [320, 640, 960, 1600] as const;
export function storageKey(key: string) {
  if (!/^[0-9a-f-]{36}(?:\.w(?:320|640|960|1600))?\.(png|jpg|webp)$/.test(key))
    throw new Error("Invalid media key.");
  return `private/media/${key}`;
}
export class S3MediaStorage implements MediaStorage {
  private client: S3Client;
  constructor(
    private config: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
    },
    client?: S3Client,
  ) {
    this.client =
      client ??
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: true,
        maxAttempts: 3,
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
  }
  async put(key: string, bytes: Uint8Array, mimeType: string) {
    if (bytes.length > maxImageBytes) throw new Error("Image too large.");
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey(key),
        Body: bytes,
        ContentType: mimeType,
        CacheControl: "private, no-store",
        IfNoneMatch: "*",
      }),
      { abortSignal: AbortSignal.timeout(10000) },
    );
  }
  async read(key: string) {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey(key),
      }),
      { abortSignal: AbortSignal.timeout(10000) },
    );
    if ((result.ContentLength ?? 0) > maxImageBytes)
      throw new Error("Image too large.");
    if (!result.Body) throw new Error("Media unavailable.");
    const bytes = await result.Body.transformToByteArray();
    if (bytes.length > maxImageBytes) throw new Error("Image too large.");
    return bytes;
  }
  async remove(key: string) {
    storageKey(key);
    const base = key.replace(/\.(png|jpg|webp)$/, "");
    const result = await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.config.bucket,
        Delete: {
          Objects: [key, ...imageWidths.map((w) => `${base}.w${w}.webp`)].map(
            (k) => ({ Key: storageKey(k) }),
          ),
          Quiet: true,
        },
      }),
      { abortSignal: AbortSignal.timeout(10000) },
    );
    if (result.Errors?.length) throw new Error("Media deletion incomplete.");
  }
}
