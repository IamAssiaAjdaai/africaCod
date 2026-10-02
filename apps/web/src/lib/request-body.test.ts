import { it, expect } from "vitest";
import { boundedText } from "./request-body";
it("bounds streamed bodies without trusting Content-Length", async () => {
  await expect(
    boundedText(
      new Request("https://example.test", { method: "POST", body: "123456" }),
      5,
    ),
  ).rejects.toThrow();
  expect(
    await boundedText(
      new Request("https://example.test", { method: "POST", body: "é" }),
      2,
    ),
  ).toBe("é");
});
