import { dashboardChart } from "@/lib/dashboard-chart";

export function DashboardChart({
  series,
}: {
  series: Parameters<typeof dashboardChart>[0];
}) {
  const chart = dashboardChart(series);
  if (!chart.maximum)
    return (
      <p className="chart-empty muted">
        Daily counts include days with zero activity.
      </p>
    );
  return (
    <div className="dashboard-chart">
      <p className="chart-scale muted">
        Daily counts · shared scale: 0–{chart.maximum}
      </p>
      <div className="chart-series-grid">
        {(
          [
            ["orders", "Orders"],
            ["visitors", "Visitors"],
            ["deliveries", "Deliveries"],
          ] as const
        ).map(([key, label]) => (
          <div className={`chart-series chart-${key}`} key={key}>
            <strong>{label}</strong>
            <svg
              viewBox={`0 -2 ${chart.width} ${chart.height + 4}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${label} per UTC day, from 0 to ${chart.maximum}. Exact counts are in the daily counts table.`}
            >
              <line
                x1="0"
                y1={chart.height}
                x2={chart.width}
                y2={chart.height}
                stroke="var(--border-strong)"
                vectorEffect="non-scaling-stroke"
              />
              {chart.bars(key).map((bar) => (
                <rect
                  key={bar.day}
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  fill="currentColor"
                  data-day={bar.day}
                  data-count={bar.count}
                >
                  <title>{`${bar.day}: ${bar.count} ${label.toLowerCase()}`}</title>
                </rect>
              ))}
            </svg>
            <div className="chart-dates">
              <span>{series[0]?.day}</span>
              {series.length > 1 && <span>{series.at(-1)?.day}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
