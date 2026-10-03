import { describe, it, expect } from "vitest";
import { analyticsRange } from "./analytics";
describe("Dashboard UTC date ranges", () => {
  const now = new Date("2026-10-03T23:30:00+02:00");
  it.each([
    ["today", "2026-10-03", "2026-10-04"],
    ["yesterday", "2026-10-02", "2026-10-03"],
    ["7d", "2026-09-27", "2026-10-04"],
    ["30d", "2026-09-04", "2026-10-04"],
  ] as const)("%s has explicit UTC bounds", (range, start, end) => {
    const r = analyticsRange({ range }, now);
    expect(r.from.toISOString().slice(0, 10)).toBe(start);
    expect(r.to.toISOString().slice(0, 10)).toBe(end);
  });
  it("custom range includes the full end date", () => {
    const r = analyticsRange(
      { range: "custom", from: "2026-09-01", to: "2026-09-02" },
      now,
    );
    expect(r.to.toISOString()).toBe("2026-09-03T00:00:00.000Z");
  });
  it("rejects reversed, incomplete and overlong ranges", () => {
    for (const input of [
      { range: "custom" as const },
      { range: "custom" as const, from: "2026-10-03", to: "2026-10-01" },
      { range: "custom" as const, from: "2024-01-01", to: "2026-10-03" },
    ])
      expect(() => analyticsRange(input, now)).toThrow();
  });
});
