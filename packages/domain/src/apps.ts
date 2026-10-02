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
      description: "Advertising integration is planned. No events are sent.",
      status: "Coming soon",
    },
    {
      id: "tiktok",
      name: "TikTok",
      category: "Marketing",
      description: "Pixel and conversion integrations are planned.",
      status: "Coming soon",
    },
    {
      id: "google-ads",
      name: "Google Ads",
      category: "Marketing",
      description: "Advertising configuration is planned.",
      status: "Coming soon",
    },
    {
      id: "google-sheets",
      name: "Google Sheets",
      category: "Data",
      description: "Order exports to spreadsheets are planned.",
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
      id: "fulfillment",
      name: "Fulfillment providers",
      category: "Fulfillment",
      description: "Provider integrations are not implemented or connected.",
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
// Catalog IDs are the future Store → App Connection attachment point. No credentials or connections exist yet.
export class AppsService extends CommerceService {
  async listApps(userId: string | null, storeId?: string) {
    await this.tenant(userId);
    if (storeId) await this.getStore(userId, storeId);
    return appCatalog;
  }
}
