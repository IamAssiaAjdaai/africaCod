import sharp from "sharp";
import type { MediaStorage } from "@africacod/domain";
import { validateImage } from "@africacod/domain";
import { imageWidths } from "./s3-media-storage";
export async function normalizedImage(bytes: Uint8Array, mime: string) {
  validateImage(bytes, mime);
  const image = sharp(bytes, {
    limitInputPixels: 40000000,
    failOn: "warning",
    animated: false,
  });
  const metadata = await image.metadata();
  if (
    !["png", "jpeg", "webp"].includes(metadata.format ?? "") ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error("Use a static PNG, JPEG or WebP image.");
  return image
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();
}
export async function optimizedImage(
  storage: MediaStorage,
  key: string,
  width: number,
) {
  if (!imageWidths.includes(width as never))
    throw new Error("Invalid image width.");
  const derivative = key.replace(/\.(png|jpg|webp)$/, `.w${width}.webp`);
  try {
    return await storage.read(derivative);
  } catch (error) {
    const missing =
      error &&
      typeof error === "object" &&
      (("code" in error && error.code === "ENOENT") ||
        ("name" in error &&
          (error.name === "NoSuchKey" || error.name === "NotFound")));
    if (!missing) throw error;
  }
  const bytes = await storage.read(key);
  const result = await sharp(bytes, {
    limitInputPixels: 40000000,
    failOn: "warning",
  })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  try {
    await storage.put(derivative, result, "image/webp");
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      (("code" in error && error.code === "EEXIST") ||
        ("$metadata" in error &&
          (error.$metadata as { httpStatusCode: number }).httpStatusCode ===
            412))
    ))
      throw error;
  }
  return result;
}
