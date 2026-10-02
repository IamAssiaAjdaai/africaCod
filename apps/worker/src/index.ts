// Reserved process boundary for future background work. No jobs in this checkpoint.
console.info("AfricaCod worker ready; no background jobs configured.");
const keepAlive = setInterval(() => {}, 60000);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    clearInterval(keepAlive);
    process.exit(0);
  });
}
