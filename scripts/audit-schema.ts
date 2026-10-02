import {
  getTableConfig,
  PgTable,
} from "../packages/db/node_modules/drizzle-orm/pg-core";
import { is, getTableName } from "../packages/db/node_modules/drizzle-orm";
import * as schema from "../packages/db/src/schema";
const tables = Object.values(schema)
  .filter((v) => is(v, PgTable))
  .map((v) => getTableConfig(v as PgTable))
  .sort((a, b) => a.name.localeCompare(b.name));
console.info(
  `# Database constraint audit\n\nAll ${tables.length} tables: original 40 plus OAuth states and distributed abuse buckets. Generated from the checked-in schema; migration verification separately checks actual PostgreSQL installation.\n\nTenant roots are organizations and Stores. Organization memberships permit multiple organizations per user and uniquely bind organization/user. Commercial relationships use composite tenant/Store identities plus service authorization; a UUID alone never grants access.\n\nNullable columns represent optional provider identities, snapshots, callbacks, assignment, draft/publication fields or failure state; application validation governs required workflow transitions. Historical Orders, Items, attribution, confirmation, Fulfillment, Shipment and audit events are retained. Products/Markets/Offers are referenced restrictively; deletion tests verify history cannot disappear. Content Pages are not referenced by commercial records. Archive/deactivate is the merchant operation.\n\nAuth account/session cascades are intentional. Tracking receipt/attempt/queue cascades are operational or deterministic test data; deleting a connection is not exposed as a merchant operation. Commerce event cascade from an explicitly deleted Order does not create a Product/Market deletion path. Visitor observations are ephemeral and retained 30 days. Test-only tables are never production fulfillment authorities.\n\nPrimary keys are additional to unique/index counts. Tables without an extra index are either small reference data, use their primary/unique index for lookup, or inherit a justified access path through an indexed parent. Index additions in CP9 follow source queries rather than every nullable column.\n\n| Table | Nullable columns | Foreign key / deletion | Unique constraints | Indexes / checks |\n| --- | --- | --- | --- | --- |`,
);
for (const t of tables) {
  const relations = t.foreignKeys.map((f) => {
    const r = f.reference();
    return `${r.columns.map((c) => c.name).join("+")} → ${getTableName(r.foreignTable)}(${r.foreignColumns.map((c) => c.name).join("+")}); ${f.onDelete ?? "no action"}`;
  });
  console.info(
    `| ${t.name} | ${
      t.columns
        .filter((c) => !c.notNull)
        .map((c) => c.name)
        .join(", ") || "None"
    } | ${relations.join("<br>") || "Reference/root"} | ${[...t.uniqueConstraints.map((c) => c.columns.map((v) => v.name).join("+")), ...t.columns.filter((c) => c.isUnique).map((c) => c.name)].join("; ") || "PK only"} | ${t.indexes.map((i) => i.config.name).join(", ") || "PK/unique only"}; ${t.checks.length} checks |`,
  );
}
