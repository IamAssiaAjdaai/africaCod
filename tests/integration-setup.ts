import { loadRootEnvironment } from "../packages/shared/src/node";
loadRootEnvironment();
const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;
if (process.env.APP_ENV === "production" || !testUrl || !applicationUrl)
  throw new Error(
    "Integration tests require an explicitly isolated test database.",
  );
const target = new URL(testUrl),
  application = new URL(applicationUrl);
if (
  !target.pathname.endsWith("_test") ||
  (target.host === application.host && target.pathname === application.pathname)
)
  throw new Error("Integration tests refuse the application database.");
