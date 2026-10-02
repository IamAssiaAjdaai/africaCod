import { describe, it, expect } from "vitest";
import { GoogleTransport, GoogleFailure } from "./google";
const config = {
  clientId: "client",
  clientSecret: "secret",
  redirectUri: "https://example.test/callback",
};
const json = (value: unknown, status = 200) => Response.json(value, { status });
describe("Google OAuth and Sheets transport", () => {
  it("refreshes expired access without exposing tokens, and classifies revoked authorization", async () => {
    const calls: { url: string; body: string }[] = [];
    const transport = new GoogleTransport(config, async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body) });
      return json({ access_token: "access", expires_in: 3600 });
    });
    const refreshed = await transport.refresh("refresh");
    expect(refreshed.refreshToken).toBe("refresh");
    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
    expect(new URLSearchParams(calls[0].body).get("grant_type")).toBe(
      "refresh_token",
    );
    await expect(
      new GoogleTransport(config, async () =>
        json({ error: "invalid_grant", error_description: "secret" }, 400),
      ).refresh("refresh"),
    ).rejects.toMatchObject({ code: "authorization", retryable: false });
  });
  it.each([
    [401, "authorization", false],
    [403, "permission", false],
    [404, "missing", false],
    [429, "quota", true],
    [503, "temporary", true],
  ])("classifies HTTP %s safely", async (status, code, retryable) => {
    await expect(
      new GoogleTransport(config, async () =>
        json(
          { error: { message: "customer address and secret" } },
          status as number,
        ),
      ).api("sheet", "token"),
    ).rejects.toMatchObject({ code, retryable });
  });
  it("updates the same remote row after an accepted-but-lost response and follows a renamed numeric sheet", async () => {
    const rows: (string | number)[][] = [];
    let lost = true;
    const writes: string[] = [];
    const request: typeof fetch = async (url, init) => {
      const u = String(url);
      if (!u.includes("/values/"))
        return json({
          sheets: [{ properties: { sheetId: 17, title: "Renamed Tab" } }],
        });
      if (!init?.method) return json({ values: rows });
      const range = decodeURIComponent(u.split("/values/")[1].split("?")[0]);
      writes.push(range);
      const value = JSON.parse(String(init.body)).values[0];
      if (range.endsWith("A1:Q1")) {
        rows[0] = value;
        return json({});
      }
      rows[1] = value;
      if (lost) {
        lost = false;
        throw new Error("response lost");
      }
      return json({});
    };
    const transport = new GoogleTransport(config, request);
    const columns = {
      "Order Number": "AC-1",
      Customer: "=unsafe formula",
      Currency: "KES",
    };
    await expect(
      transport.upsert("spreadsheet_123", 17, "token", columns),
    ).rejects.toBeInstanceOf(GoogleFailure);
    await transport.upsert("spreadsheet_123", 17, "token", columns);
    expect(rows).toHaveLength(2);
    expect(writes.filter((x) => x.endsWith("A2:Q2"))).toHaveLength(2);
    expect(writes.every((x) => x.startsWith("'Renamed Tab'!"))).toBe(true);
    expect(rows[1][1]).toBe("=unsafe formula");
  });
  it("rejects an unrelated or duplicate-order tab instead of overwriting data", async () => {
    const transport = new GoogleTransport(config, async (url) =>
      String(url).includes("/values/")
        ? json({ values: [["Other data"]] })
        : json({ sheets: [{ properties: { sheetId: 0, title: "Tab" } }] }),
    );
    await expect(
      transport.upsert("spreadsheet_123", 0, "token", {
        "Order Number": "AC-1",
      }),
    ).rejects.toMatchObject({ code: "configuration", retryable: false });
  });
});
