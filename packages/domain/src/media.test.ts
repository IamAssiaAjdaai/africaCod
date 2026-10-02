import { expect, it } from "vitest";
import { maxImageBytes, validateImage } from "./media";
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
);
it("validates image signatures, claimed content types and size limits", () => {
  expect(validateImage(png, "image/png")).toEqual({
    mimeType: "image/png",
    extension: "png",
  });
  expect(() => validateImage(png, "image/jpeg")).toThrow();
  expect(() =>
    validateImage(
      new TextEncoder().encode("<svg><script>alert(1)</script></svg>"),
      "image/svg+xml",
    ),
  ).toThrow();
  expect(() => validateImage(new Uint8Array(), "image/png")).toThrow();
  expect(() =>
    validateImage(new Uint8Array(maxImageBytes + 1), "image/png"),
  ).toThrow();
});
