import { getDatabase } from "@africacod/db";
import { sql } from "drizzle-orm";
import { logEvent } from "@africacod/shared";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getDatabase().execute(sql`SELECT 1`);
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    logEvent("error", "database.health_failed");
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
