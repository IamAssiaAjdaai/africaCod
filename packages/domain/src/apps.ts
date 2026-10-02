import { CommerceService } from "./commerce";
export type AppCategory =
  "Marketing" | "Fulfillment" | "Data" | "Communication";
export type AppStatus =
  "Available" | "Connected" | "Not connected" | "Coming soon";
export const appCatalog: ReadonlyArray<
  Readonly<{
    id: string;
    name: string;
    category: AppCategory;
    description: string;
    status: AppStatus;
  }>
> = Object.freeze(
  [
    {
      id: "meta",
      name: "Meta",
      category: "Marketing",
      description:
        "Opt-in Pixel and asynchronous CAPI: checkout Lead; optional delivered Purchase.",
      status: "Coming soon",
    },
    {
      id: "tiktok",
      name: "TikTok",
      category: "Marketing",
      description:
        "Opt-in browser Pixel foundation; server Events API deferred.",
      status: "Coming soon",
    },
    {
      id: "google-ads",
      name: "Google Ads",
      category: "Marketing",
      description:
        "Browser lead conversion foundation; delivered server conversion activation deferred.",
      status: "Coming soon",
    },
    {
      id: "google-sheets",
      name: "Google Sheets",
      category: "Data",
      description:
        "Idempotent order export test adapter; production Google OAuth deferred.",
      status: "Coming soon",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      category: "Communication",
      description: "Messaging integration is planned. No messages are sent.",
      status: "Coming soon",
    },
    {
      id: "shipcod",
      name: "ShipCOD",
      category: "Fulfillment",
      description:
        "Production BLOCKED pending official API documentation. Deterministic test adapter available only in explicit test mode.",
      status: "Coming soon",
    },
    {
      id: "cod-in-africa",
      name: "COD in Africa",
      category: "Fulfillment",
      description: "Provider integration is planned.",
      status: "Coming soon",
    },
    {
      id: "wegoo",
      name: "WeGoo",
      category: "Fulfillment",
      description: "Provider integration is planned.",
      status: "Coming soon",
    },
    {
      id: "haulstow",
      name: "Haulstow",
      category: "Fulfillment",
      description: "Provider integration is planned.",
      status: "Coming soon",
    },
  ].map((app) => Object.freeze(app)) as ReadonlyArray<
    Readonly<{
      id: string;
      name: string;
      category: AppCategory;
      description: string;
      status: AppStatus;
    }>
  >,
);
// Planned app entries remain reference data; connections are created explicitly.
export class AppsService extends CommerceService {
  async listApps(userId: string | null, storeId?: string) {
    await this.tenant(userId);
    if (storeId) await this.getStore(userId, storeId);
    return appCatalog;
  }
}
