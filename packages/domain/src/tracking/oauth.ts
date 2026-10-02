import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { oauthStates, trackingConnections, type Database } from "@africacod/db";
import { OperationsService } from "../operations";
import { CredentialVault } from "../integrations/credentials";
import {
  GoogleTransport,
  sheetsScope,
  type GoogleConfig,
  type GoogleTokens,
} from "./google";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const googleTokenData = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
});
export class GoogleSheetsService extends OperationsService {
  constructor(
    db: Database,
    private key: string | undefined,
    private config: GoogleConfig | undefined,
    private request: typeof fetch = fetch,
  ) {
    super(db);
  }
  private transport() {
    if (!this.config)
      throw new Error("Google OAuth requires environment credentials.");
    return new GoogleTransport(this.config, this.request);
  }
  async begin(userId: string, storeId: string) {
    const store = await this.getStore(userId, storeId);
    const state = randomBytes(32).toString("base64url"),
      verifier = randomBytes(48).toString("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    if (!this.config)
      throw new Error("Google OAuth requires environment credentials.");
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: sheetsScope,
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: hashChallenge(verifier),
      code_challenge_method: "S256",
    }).toString();
    await this.db.insert(oauthStates).values({
      stateHash: hash(state),
      userId,
      organizationId: store.organizationId,
      storeId,
      verifierEncrypted: new CredentialVault(this.key).encrypt(
        { apiKey: verifier, apiSecret: "oauth" },
        `oauth:${hash(state)}`,
      ),
      expiresAt: new Date(Date.now() + 600000),
    });
    return { state, url: url.toString() };
  }
  async finish(
    userId: string,
    state: string,
    cookieState: string,
    code: string,
  ) {
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      state !== cookieState ||
      !code ||
      code.length > 4096
    )
      throw new Error("Invalid OAuth response.");
    const [saved] = await this.db
      .delete(oauthStates)
      .where(
        and(
          eq(oauthStates.stateHash, hash(state)),
          eq(oauthStates.userId, userId),
          gt(oauthStates.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!saved) throw new Error("OAuth response expired or already used.");
    const store = await this.getStore(userId, saved.storeId);
    const verifier = new CredentialVault(this.key).decrypt(
      saved.verifierEncrypted,
      `oauth:${hash(state)}`,
    ).apiKey;
    const tokens = await this.transport().code(code, verifier);
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`tracking:${store.id}:google-sheets`}))`,
      );
      const [old] = await tx
        .select()
        .from(trackingConnections)
        .where(
          and(
            eq(trackingConnections.storeId, store.id),
            eq(trackingConnections.provider, "google-sheets"),
          ),
        )
        .for("update");
      const id = old?.id ?? crypto.randomUUID();
      const encrypted = new CredentialVault(this.key).encrypt(
        { apiKey: JSON.stringify(tokens), apiSecret: "google-sheets" },
        `${store.organizationId}:${store.id}:${id}:google-sheets`,
      );
      await tx
        .insert(trackingConnections)
        .values({
          id,
          organizationId: store.organizationId,
          storeId: store.id,
          provider: "google-sheets",
          mode: "production",
          enabled: false,
          settings: old?.settings ?? {},
          secretEncrypted: encrypted,
        })
        .onConflictDoUpdate({
          target: [trackingConnections.storeId, trackingConnections.provider],
          set: {
            mode: "production",
            enabled: false,
            secretEncrypted: encrypted,
            revision: (old?.revision ?? 0) + 1,
            lastError: null,
            lastSuccess: null,
            updatedAt: new Date(),
          },
        });
    });
    return store.id;
  }
  async disconnect(userId: string, storeId: string) {
    await this.getStore(userId, storeId);
    let tokens: GoogleTokens | undefined;
    let connectionId: string | undefined;
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`tracking:${storeId}:google-sheets`}))`,
      );
      const [c] = await tx
        .select()
        .from(trackingConnections)
        .where(
          and(
            eq(trackingConnections.storeId, storeId),
            eq(trackingConnections.provider, "google-sheets"),
          ),
        )
        .for("update");
      if (!c) return;
      connectionId = c.id;
      if (c.secretEncrypted)
        tokens = googleTokenData.parse(
          JSON.parse(
            new CredentialVault(this.key).decrypt(
              c.secretEncrypted,
              `${c.organizationId}:${c.storeId}:${c.id}:google-sheets`,
            ).apiKey,
          ),
        );
      await tx
        .update(trackingConnections)
        .set({
          enabled: false,
          secretEncrypted: null,
          revision: c.revision + 1,
          lastSuccess: null,
          lastError: null,
        })
        .where(eq(trackingConnections.id, c.id));
    });
    if (tokens)
      try {
        await this.transport().revoke(tokens.refreshToken);
      } catch {
        await this.db
          .update(trackingConnections)
          .set({
            lastError:
              "Local authorization removed. Remove app access in your Google account to ensure remote revocation.",
          })
          .where(
            and(
              eq(trackingConnections.id, connectionId!),
              eq(trackingConnections.enabled, false),
              sql`${trackingConnections.secretEncrypted} IS NULL`,
            ),
          );
      }
  }
}
function hashChallenge(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}
