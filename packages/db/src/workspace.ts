import { and, asc, eq } from "drizzle-orm";
import type { Database } from "./index";
import { memberships, organizations, user } from "./schema";

// Serialize initialization on the account row. Concurrent signup/onboarding
// retries create one initial workspace, without limiting future memberships.
export async function ensureInitialWorkspace(db: Database, userId: string) {
  return db.transaction(async (tx) => {
    const [account] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!account) throw new Error("Account not found.");
    const [existing] = await tx
      .select({
        id: organizations.id,
        name: organizations.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(
        organizations,
        eq(organizations.id, memberships.organizationId),
      )
      .where(and(eq(memberships.userId, account.id)))
      .orderBy(asc(memberships.createdAt), asc(memberships.id))
      .limit(1);
    if (existing) return existing;
    const [workspace] = await tx
      .insert(organizations)
      .values({ name: "My workspace" })
      .returning();
    await tx.insert(memberships).values({
      organizationId: workspace.id,
      userId: account.id,
      role: "owner",
    });
    return { id: workspace.id, name: workspace.name, role: "owner" as const };
  });
}
