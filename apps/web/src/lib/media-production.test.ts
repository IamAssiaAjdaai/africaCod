import { it, expect } from "vitest";
import sharp from "sharp";
import { S3MediaStorage, storageKey } from "./s3-media-storage";
import { normalizedImage, optimizedImage } from "./image-processing";
it("private S3 keys and operations never trust filenames or publish the bucket", async () => {
  const sent: { input: Record<string, unknown>; name: string }[] = [];
  const client = {
    send: async (command: {
      input: Record<string, unknown>;
      constructor: { name: string };
    }) => {
      sent.push({ input: command.input, name: command.constructor.name });
      return {
        Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      };
    },
  };
  const storage = new S3MediaStorage(
    {
      endpoint: "https://example.test",
      region: "auto",
      bucket: "media",
      accessKeyId: "key",
      secretAccessKey: "secret",
    },
    client as never,
  );
  const key = "11111111-1111-4111-8111-111111111111.png";
  await storage.put(key, new Uint8Array([1, 2, 3]), "image/png");
  expect(sent[0].input).toMatchObject({
    Key: `private/media/${key}`,
    IfNoneMatch: "*",
    CacheControl: "private, no-store",
  });
  expect(sent[0].input.ACL).toBeUndefined();
  await storage.read(key);
  await storage.remove(key);
  expect((sent[2].input.Delete as { Objects: unknown[] }).Objects).toHaveLength(
    5,
  );
  expect(() => storageKey("../../secret")).toThrow();
});
it("decodes images, strips metadata, caps originals and serves cached small derivatives", async () => {
  const original = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "red" },
  })
    .png()
    .withMetadata()
    .toBuffer();
  const normalized = await normalizedImage(original, "image/png");
  const meta = await sharp(normalized).metadata();
  expect(meta.width).toBe(1600);
  expect(meta.exif).toBeUndefined();
  const fake = new Uint8Array(24);
  fake.set([137, 80, 78, 71, 13, 10, 26, 10]);
  await expect(normalizedImage(fake, "image/png")).rejects.toThrow();
  const files = new Map<string, Uint8Array>([
    ["11111111-1111-4111-8111-111111111111.png", normalized],
  ]);
  let puts = 0;
  const storage = {
    read: async (k: string) => {
      const b = files.get(k);
      if (!b) throw Object.assign(new Error(), { code: "ENOENT" });
      return b;
    },
    put: async (k: string, b: Uint8Array) => {
      puts++;
      files.set(k, b);
    },
    remove: async (k: string) => {
      files.delete(k);
    },
  };
  const result = await optimizedImage(
    storage,
    "11111111-1111-4111-8111-111111111111.png",
    320,
  );
  expect((await sharp(result).metadata()).width).toBe(320);
  expect(result.length).toBeLessThan(normalized.length);
  await optimizedImage(
    storage,
    "11111111-1111-4111-8111-111111111111.png",
    320,
  );
  expect(puts).toBe(1);
  await expect(
    optimizedImage(storage, "11111111-1111-4111-8111-111111111111.png", 10000),
  ).rejects.toThrow();
});
