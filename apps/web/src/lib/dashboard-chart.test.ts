import { describe, expect, it } from "vitest";
import { dashboardChart } from "./dashboard-chart";

describe("Dashboard daily chart presentation", () => {
  it("represents empty and all-zero data without inventing a scale or counts", () => {
    expect(dashboardChart([]).maximum).toBe(0);
    const chart = dashboardChart([
      { day: "2026-09-30", visitors: 0, orders: 0, deliveries: 0 },
    ]);
    expect(chart.maximum).toBe(0);
    expect(chart.bars("orders")[0]).toMatchObject({
      count: 0,
      y: 72,
      height: 0,
    });
  });

  it("centers a single day and keeps coincident counts separate and exact", () => {
    const chart = dashboardChart([
      { day: "2026-09-30", visitors: 1, orders: 1, deliveries: 1 },
    ]);
    expect(chart.maximum).toBe(1);
    for (const key of ["visitors", "orders", "deliveries"] as const) {
      const bar = chart.bars(key)[0];
      expect(bar.x + bar.width / 2).toBe(chart.width / 2);
      expect(bar).toMatchObject({ day: "2026-09-30", count: 1, height: 72 });
    }
  });

  it("keeps zero days and low counts proportional on the shared scale", () => {
    const series = [
      { day: "2026-09-28", visitors: 100, orders: 1, deliveries: 0 },
      { day: "2026-09-29", visitors: 0, orders: 0, deliveries: 0 },
      { day: "2026-09-30", visitors: 1, orders: 2, deliveries: 1 },
    ];
    const original = structuredClone(series);
    const chart = dashboardChart(series);
    expect(chart.maximum).toBe(100);
    expect(chart.bars("orders").map((bar) => bar.count)).toEqual([1, 0, 2]);
    expect(chart.bars("orders")[0].height).toBeCloseTo(0.72);
    expect(chart.bars("orders")[1].height).toBe(0);
    expect(chart.bars("orders")[2].height).toBeCloseTo(1.44);
    expect(chart.bars("deliveries")[2].day).toBe("2026-09-30");
    expect(series).toEqual(original);
  });
});
