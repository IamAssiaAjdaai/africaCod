import { createHmac } from "node:crypto";
import { sql, lt } from "drizzle-orm";
import { rateLimitBuckets, type Database } from "@africacod/db";
export function abuseKey(secret: string, scope: string, identity: string) {
  return createHmac("sha256", secret)
    .update(`${scope}:${identity}`)
    .digest("hex");
}
export class AbuseService {
  constructor(private db: Database) {}
  async consume(key: string, limit: number, seconds: number) {
    const rows = await this.db.execute<{ count: number }>(
      sql`INSERT INTO rate_limit_buckets (key,count,expires_at) VALUES (${key},1,clock_timestamp()+${seconds}*interval '1 second') ON CONFLICT (key) DO UPDATE SET count=CASE WHEN rate_limit_buckets.expires_at<=clock_timestamp() THEN 1 ELSE LEAST(rate_limit_buckets.count+1,${limit + 1}) END, expires_at=CASE WHEN rate_limit_buckets.expires_at<=clock_timestamp() THEN clock_timestamp()+${seconds}*interval '1 second' ELSE rate_limit_buckets.expires_at END RETURNING count`,
    );
    return rows[0].count <= limit;
  }
  async prune() {
    await this.db
      .delete(rateLimitBuckets)
      .where(lt(rateLimitBuckets.expiresAt, new Date()));
  }
}
