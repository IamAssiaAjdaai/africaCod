export const maxImageBytes = 10 * 1024 * 1024;
export interface MediaStorage {
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  read(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
export function validateImage(
  bytes: Uint8Array,
  claimedType: string,
): { mimeType: string; extension: string } {
  if (!bytes.length || bytes.length > maxImageBytes)
    throw new Error("Images must be between 1 byte and 10 MB.");
  const png =
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpg =
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes[bytes.length - 2] === 255 &&
    bytes[bytes.length - 1] === 217;
  const webp =
    bytes.length >= 16 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  const type = png
    ? { mimeType: "image/png", extension: "png" }
    : jpg
      ? { mimeType: "image/jpeg", extension: "jpg" }
      : webp
        ? { mimeType: "image/webp", extension: "webp" }
        : null;
  if (!type || type.mimeType !== claimedType)
    throw new Error(
      "Upload a PNG, JPEG, or WebP image with matching file contents.",
    );
  return type;
}
