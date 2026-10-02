import {
  ProviderFailure,
  type FulfillmentProvider,
  type MockRemoteStore,
  type HandoffSnapshot,
} from "./contract";
import type { ProviderCredentials } from "../credentials";
// Coverage only: verified https://shipcod.delivery/faq/ (2026-10-02).
// No official shipment/auth/status/webhook API contract was available. No network endpoints exist here.
export const shipcodMarkets = ["KE", "UG", "TZ"] as const;
// These are TEST FIXTURES, not claims about ShipCOD's real status strings.
export const mockShipcodStatusMap = {
  mock_created: "created",
  mock_shipped: "shipped",
  mock_out_for_delivery: "out_for_delivery",
  mock_delivery_failed: "delivery_failed",
  mock_delivered: "delivered",
  mock_refused: "refused",
  mock_returned: "returned",
  mock_cancelled: "cancelled",
} as const;
export class ShipcodTestAdapter implements FulfillmentProvider {
  readonly key = "shipcod";
  readonly mode = "mock";
  readonly supportsIdempotency = true;
  constructor(
    private remote: MockRemoteStore,
    private failOnce = false,
  ) {}
  getSupportedMarkets() {
    return shipcodMarkets;
  }
  async validateCredentials(credentials: ProviderCredentials) {
    return (
      credentials.apiKey === "mock-key" &&
      credentials.apiSecret === "mock-secret"
    );
  }
  async createShipment(
    credentials: ProviderCredentials,
    key: string,
    snapshot: HandoffSnapshot,
  ) {
    if (!(await this.validateCredentials(credentials)))
      throw new ProviderFailure("INVALID_CREDENTIALS");
    if (
      !shipcodMarkets.includes(
        snapshot.countryCode as (typeof shipcodMarkets)[number],
      ) ||
      snapshot.totalMinor < 0 ||
      !snapshot.items.length
    )
      throw new ProviderFailure("UNAVAILABLE");
    return this.remote.create(key, this.failOnce);
  }
  async getShipmentStatus(
    credentials: ProviderCredentials,
    externalId: string,
  ) {
    if (!(await this.validateCredentials(credentials)))
      throw new ProviderFailure("INVALID_CREDENTIALS");
    return this.remote.get(externalId);
  }
  mapProviderStatus(raw: string) {
    return Object.hasOwn(mockShipcodStatusMap, raw)
      ? mockShipcodStatusMap[raw as keyof typeof mockShipcodStatusMap]
      : null;
  }
}
export class ShipcodBlockedAdapter implements FulfillmentProvider {
  readonly key = "shipcod";
  readonly mode = "production";
  readonly supportsIdempotency = false;
  getSupportedMarkets() {
    return shipcodMarkets;
  }
  async validateCredentials(): Promise<boolean> {
    throw new ProviderFailure("PRODUCTION_BLOCKED");
  }
  async createShipment(): Promise<never> {
    throw new ProviderFailure("PRODUCTION_BLOCKED");
  }
  async getShipmentStatus(): Promise<never> {
    throw new ProviderFailure("PRODUCTION_BLOCKED");
  }
  mapProviderStatus() {
    return null;
  }
}
export function providerRegistry(
  testMode: boolean,
  remote: MockRemoteStore,
  failOnce = false,
): ReadonlyMap<string, FulfillmentProvider> {
  return new Map([
    [
      "shipcod",
      testMode
        ? new ShipcodTestAdapter(remote, failOnce)
        : new ShipcodBlockedAdapter(),
    ],
  ]);
}
