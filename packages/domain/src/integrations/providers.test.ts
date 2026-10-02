import { describe, it, expect } from "vitest";
import { CredentialVault } from "./credentials";
import {
  providerRegistry,
  ShipcodTestAdapter,
  ShipcodBlockedAdapter,
} from "./providers/shipcod";
import type { MockRemoteStore } from "./providers/contract";
const key = Buffer.alloc(32).toString("base64");
const remote: MockRemoteStore = {
  create: async () => {
    throw new Error("unused");
  },
  get: async () => {
    throw new Error("unused");
  },
};
describe("Provider boundaries", () => {
  it("encrypts authenticated tenant-bound credentials with random nonces", () => {
    const vault = new CredentialVault(key),
      credentials = { apiKey: "private-key", apiSecret: "private-secret" },
      encrypted = vault.encrypt(credentials, "org:store:connection");
    expect(encrypted).not.toContain("private");
    expect(vault.decrypt(encrypted, "org:store:connection")).toEqual(
      credentials,
    );
    expect(vault.encrypt(credentials, "org:store:connection")).not.toBe(
      encrypted,
    );
    expect(() => vault.decrypt(encrypted, "other-tenant")).toThrow(
      "could not be decrypted",
    );
    expect(() =>
      vault.decrypt(
        encrypted.replace('"v":1', '"v":2'),
        "org:store:connection",
      ),
    ).toThrow();
  });
  it("requires a dedicated 32-byte encryption key", () => {
    expect(() => new CredentialVault(undefined)).toThrow();
    expect(() => new CredentialVault("short")).toThrow();
  });
  it("only registers ShipCOD; production is blocked and mock requires explicit mode", async () => {
    expect([...providerRegistry(false, remote).keys()]).toEqual(["shipcod"]);
    expect(providerRegistry(false, remote).get("shipcod")).toBeInstanceOf(
      ShipcodBlockedAdapter,
    );
    await expect(
      providerRegistry(false, remote)
        .get("shipcod")!
        .validateCredentials({ apiKey: "mock-key", apiSecret: "mock-secret" }),
    ).rejects.toThrow();
    expect(providerRegistry(true, remote).get("shipcod")).toBeInstanceOf(
      ShipcodTestAdapter,
    );
  });
  it("maps only documented mock fixture statuses into unchanged domain states", () => {
    const adapter = new ShipcodTestAdapter(remote);
    for (const state of [
      "created",
      "shipped",
      "out_for_delivery",
      "delivery_failed",
      "delivered",
      "refused",
      "returned",
      "cancelled",
    ])
      expect(adapter.mapProviderStatus(`mock_${state}`)).toBe(state);
    expect(adapter.mapProviderStatus("shipped")).toBeNull();
    expect(adapter.mapProviderStatus("mock_unrecognized")).toBeNull();
    expect(adapter.mapProviderStatus("__proto__")).toBeNull();
    expect(adapter.mapProviderStatus("constructor")).toBeNull();
    expect(adapter.getSupportedMarkets()).toEqual(["KE", "UG", "TZ"]);
  });
});
