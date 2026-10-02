import {
  type Database,
  trackingTestReceipts,
  sheetsTestRows,
} from "@africacod/db";
import type { MetaTransport } from "./meta";
export type SheetsOrderRow = {
  "Order Number": string;
  "Created At": string;
  Store: string;
  Market: string;
  Customer: string;
  Phone: string;
  Product: string;
  Quantity: number;
  "Order Total": number;
  Currency: string;
  "Order Status": string;
  "Confirmation State": string;
  "Shipment Status": string;
  "Tracking Number": string;
  "UTM Source": string;
  "UTM Campaign": string;
};
export interface SheetsTransport {
  upsert(destination: string, row: SheetsOrderRow): Promise<void>;
}
// These adapters persist deterministic remote receipts in the caller's test transaction.
// They never contact providers or claim production authentication.
export class DeterministicMetaTransport implements MetaTransport {
  constructor(
    private readonly db: Pick<Database, "insert">,
    private readonly connectionId: string,
  ) {}
  async send(...args: Parameters<MetaTransport["send"]>) {
    const event = args[2];
    if (
      typeof event.event_id !== "string" ||
      typeof event.event_name !== "string"
    )
      throw new Error("Invalid Meta test event.");
    await this.db
      .insert(trackingTestReceipts)
      .values({
        connectionId: this.connectionId,
        eventId: event.event_id,
        eventName: event.event_name,
        payload: event,
      })
      .onConflictDoNothing();
  }
}
export class DeterministicSheetsTransport implements SheetsTransport {
  constructor(
    private readonly db: Pick<Database, "insert">,
    private readonly connectionId: string,
  ) {}
  async upsert(destination: string, row: SheetsOrderRow) {
    if (!destination) throw new Error("Missing test destination.");
    await this.db
      .insert(sheetsTestRows)
      .values({
        connectionId: this.connectionId,
        orderNumber: row["Order Number"],
        columns: row,
      })
      .onConflictDoUpdate({
        target: [sheetsTestRows.connectionId, sheetsTestRows.orderNumber],
        set: { columns: row, updatedAt: new Date() },
      });
  }
}
