import { describe, it, expect } from "vitest";
import {
  confirmationState,
  callbackTiming,
  shipmentTransitions,
} from "./lifecycle";
describe("Derived confirmation and logistics rules", () => {
  it("prioritizes commercial terminal states and only the latest callback", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    expect(confirmationState("new", null, now)).toBe("uncontacted");
    expect(
      confirmationState(
        "new",
        { outcome: "no_answer", nextCallbackAt: null },
        now,
      ),
    ).toBe("attempted");
    expect(
      confirmationState(
        "new",
        {
          outcome: "callback",
          nextCallbackAt: new Date("2026-10-02T11:00:00Z"),
        },
        now,
      ),
    ).toBe("callback_due");
    expect(
      confirmationState(
        "new",
        {
          outcome: "callback",
          nextCallbackAt: new Date("2026-10-02T13:00:00Z"),
        },
        now,
      ),
    ).toBe("attempted");
    for (const status of ["confirmed", "cancelled"])
      expect(confirmationState(status, null, now)).toBe(status);
  });
  it("distinguishes overdue, due now and upcoming", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    expect(callbackTiming(new Date("2026-10-02T11:00:00Z"), now)).toBe(
      "overdue",
    );
    expect(callbackTiming(now, now)).toBe("due now");
    expect(callbackTiming(new Date("2026-10-02T13:00:00Z"), now)).toBe(
      "upcoming",
    );
  });
  it("has terminal delivery/return states and recoverable delivery failures", () => {
    expect(shipmentTransitions.delivered).toEqual([]);
    expect(shipmentTransitions.returned).toEqual([]);
    expect(shipmentTransitions.delivery_failed).toContain("out_for_delivery");
    expect(shipmentTransitions.refused).toContain("returned");
    expect(shipmentTransitions.created).not.toContain("delivered");
  });
});
