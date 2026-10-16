type DailyCounts = {
  day: string;
  visitors: number;
  orders: number;
  deliveries: number;
};

// Presentation only: all three daily series share an exact, zero-based scale.
export function dashboardChart(series: readonly DailyCounts[]) {
  const maximum = series.reduce(
    (max, day) => Math.max(max, day.visitors, day.orders, day.deliveries),
    0,
  );
  const width = 400;
  const height = 72;
  const bin = width / Math.max(1, series.length);
  return {
    maximum,
    width,
    height,
    bars: (key: "visitors" | "orders" | "deliveries") =>
      series.map((day, index) => {
        const barHeight = maximum ? (day[key] / maximum) * height : 0;
        const barWidth = Math.min(24, bin * 0.65);
        return {
          day: day.day,
          count: day[key],
          x: (index + 0.5) * bin - barWidth / 2,
          y: height - barHeight,
          width: barWidth,
          height: barHeight,
        };
      }),
  };
}
