import type { ShipmentStatus } from "../../lifecycle";
import type { ProviderCredentials } from "../credentials";
export type { ProviderHandoffSnapshot as HandoffSnapshot } from "@africacod/validation";
import type { ProviderHandoffSnapshot as HandoffSnapshot } from "@africacod/validation";
export type ProviderResult = {
  externalId: string;
  eventId: string;
  rawStatus: string;
  occurredAt: Date;
  trackingNumber?: string;
  trackingUrl?: string;
};
export class ProviderFailure extends Error {
  constructor(
    public code:
      | "INVALID_CREDENTIALS"
      | "UNAVAILABLE"
      | "PRODUCTION_BLOCKED"
      | "AMBIGUOUS",
    public retryable = false,
    public ambiguous = false,
  ) {
    super(code);
  }
}
export interface FulfillmentProvider {
  key: string;
  mode: "mock" | "production";
  supportsIdempotency: boolean;
  getSupportedMarkets(): readonly string[];
  validateCredentials(credentials: ProviderCredentials): Promise<boolean>;
  createShipment(
    credentials: ProviderCredentials,
    key: string,
    snapshot: HandoffSnapshot,
  ): Promise<ProviderResult>;
  getShipmentStatus(
    credentials: ProviderCredentials,
    externalId: string,
  ): Promise<ProviderResult>;
  mapProviderStatus(raw: string): ShipmentStatus | null;
}
export interface MockRemoteStore {
  create(key: string, failOnce: boolean): Promise<ProviderResult>;
  get(externalId: string): Promise<ProviderResult>;
}
