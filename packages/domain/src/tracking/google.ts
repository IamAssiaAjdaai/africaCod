import { z } from "zod";
export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};
export type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};
export class GoogleFailure extends Error {
  constructor(
    public readonly code:
      | "authorization"
      | "permission"
      | "missing"
      | "quota"
      | "temporary"
      | "configuration",
    public readonly retryable: boolean,
  ) {
    super(`Google Sheets ${code} failure.`);
  }
}
const tokens = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});
export const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";
export class GoogleTransport {
  constructor(
    private config: GoogleConfig,
    private request: typeof fetch = fetch,
  ) {}
  private async exchange(
    body: URLSearchParams,
    previous?: string,
  ): Promise<GoogleTokens> {
    let response: Response;
    try {
      response = await this.request("https://oauth2.googleapis.com/token", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new GoogleFailure("temporary", true);
    }
    if (!response.ok)
      throw new GoogleFailure(
        response.status >= 500 ? "temporary" : "authorization",
        response.status >= 500,
      );
    let bodyValue: unknown;
    try {
      bodyValue = await response.json();
    } catch {
      throw new GoogleFailure("temporary", true);
    }
    const value = tokens.safeParse(bodyValue);
    if (!value.success || !(value.data.refresh_token ?? previous))
      throw new GoogleFailure("authorization", false);
    if (value.data.scope && !value.data.scope.split(" ").includes(sheetsScope))
      throw new GoogleFailure("permission", false);
    return {
      accessToken: value.data.access_token,
      refreshToken: value.data.refresh_token ?? previous!,
      expiresAt: Date.now() + value.data.expires_in * 1000,
    };
  }
  code(code: string, verifier: string) {
    return this.exchange(
      new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
      }),
    );
  }
  refresh(refreshToken: string) {
    return this.exchange(
      new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      refreshToken,
    );
  }
  async revoke(token: string) {
    const response = await this.request(
      "https://oauth2.googleapis.com/revoke",
      {
        method: "POST",
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok && response.status !== 400)
      throw new GoogleFailure("temporary", true);
  }
  async api(path: string, token: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await this.request(
        `https://sheets.googleapis.com/v4/spreadsheets/${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(8000),
        },
      );
    } catch {
      throw new GoogleFailure("temporary", true);
    }
    if (!response.ok)
      throw new GoogleFailure(
        response.status === 401
          ? "authorization"
          : response.status === 403
            ? "permission"
            : response.status === 404
              ? "missing"
              : response.status === 429
                ? "quota"
                : response.status >= 500
                  ? "temporary"
                  : "configuration",
        response.status === 429 || response.status >= 500,
      );
    try {
      return await response.json();
    } catch {
      throw new GoogleFailure("temporary", true);
    }
  }
  async sheets(
    spreadsheetId: string,
    token: string,
  ): Promise<{ sheetId: number; title: string }[]> {
    if (!/^[A-Za-z0-9_-]{10,150}$/.test(spreadsheetId))
      throw new GoogleFailure("configuration", false);
    const value = await this.api(
      `${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
      token,
    );
    return z
      .array(
        z.object({
          properties: z.object({
            sheetId: z.number().int().nonnegative(),
            title: z.string(),
          }),
        }),
      )
      .parse(value.sheets)
      .map((v) => v.properties);
  }
  // Connection row locks serialize writes; a dedicated tab with Order Number as column A is the remote idempotency ledger.
  async upsert(
    spreadsheetId: string,
    sheetId: number,
    token: string,
    columns: Record<string, string | number>,
  ) {
    const sheets = await this.sheets(spreadsheetId, token);
    const sheet = sheets.find((s) => s.sheetId === sheetId);
    if (!sheet) throw new GoogleFailure("missing", false);
    const prefix = `'${sheet.title.replaceAll("'", "''")}'!`;
    const response = await this.api(
      `${spreadsheetId}/values/${encodeURIComponent(prefix + "A:A")}`,
      token,
    );
    const rows = z
      .array(z.array(z.union([z.string(), z.number()])))
      .parse(response.values ?? []);
    if (rows.length && rows[0][0] !== "Order Number")
      throw new GoogleFailure("configuration", false);
    if (rows.length) {
      const headerResponse = await this.api(
        `${spreadsheetId}/values/${encodeURIComponent(prefix + "A1:Q1")}`,
        token,
      );
      const header = headerResponse.values?.[0];
      if (
        !Array.isArray(header) ||
        JSON.stringify(header) !== JSON.stringify(Object.keys(columns))
      )
        throw new GoogleFailure("configuration", false);
    }
    if (!rows.length)
      await this.api(
        `${spreadsheetId}/values/${encodeURIComponent(prefix + "A1:Q1")}?valueInputOption=RAW`,
        token,
        {
          method: "PUT",
          body: JSON.stringify({ values: [Object.keys(columns)] }),
        },
      );
    const matches = rows
      .map((r, i) => (r[0] === columns["Order Number"] ? i + 1 : 0))
      .filter(Boolean);
    if (matches.length > 1) throw new GoogleFailure("configuration", false);
    const row = matches[0] ?? Math.max(2, rows.length + 1);
    await this.api(
      `${spreadsheetId}/values/${encodeURIComponent(`${prefix}A${row}:Q${row}`)}?valueInputOption=RAW`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({ values: [Object.values(columns)] }),
      },
    );
  }
}
