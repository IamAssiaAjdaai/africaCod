export function RouteLoading({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <section
      className="panel route-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p>{label}</p>
      <div className="loading-bar" />
      <div className="loading-bar short" />
      <div className="loading-cards">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
