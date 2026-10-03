import { describe, it, expect } from "vitest";
import {
  defaultStoreSettings,
  storeSettingsInput,
  safeStoreUrl,
  snapshotOrderFields,
} from "./store-settings";
describe("Store settings and historical order fields", () => {
  it("starts with complete valid defaults and no invented claims", () => {
    const s = defaultStoreSettings();
    expect(storeSettingsInput.parse(s)).toEqual(s);
    expect(s.announcement.enabled).toBe(false);
    expect(s.hero.enabled).toBe(false);
    expect(s.productPage.badges).toEqual([]);
  });
  it.each(["red", "#123", "#12345678", "#gg0000", "url(javascript:alert(1))"])(
    "rejects invalid brand color %s",
    (color) => {
      const s = defaultStoreSettings();
      s.theme.color = color;
      expect(storeSettingsInput.safeParse(s).success).toBe(false);
    },
  );
  it.each([
    "javascript:alert(1)",
    "//evil.example",
    "http://example.com",
    "/\\evil.example",
    "https://user:password@example.com",
  ])("rejects unsafe URL %s", (value) =>
    expect(safeStoreUrl.safeParse(value).success).toBe(false),
  );
  it.each(["https://example.com/shop", "/products"])(
    "accepts safe URL %s",
    (value) => expect(safeStoreUrl.parse(value)).toBe(value),
  );
  it.each(["name", "phone"])("core %s cannot be disabled", (id) => {
    const s = defaultStoreSettings();
    s.productPage.fields.find((f) => f.id === id)!.enabled = false;
    expect(storeSettingsInput.safeParse(s).success).toBe(false);
  });
  it("optional fields can be disabled", () => {
    const s = defaultStoreSettings();
    s.productPage.fields.find((f) => f.id === "notes")!.enabled = false;
    expect(storeSettingsInput.parse(s).productPage.fields).toHaveLength(7);
  });
  it.each(["text", "textarea", "select"] as const)(
    "snapshots %s label, type and value",
    (type) => {
      const s = defaultStoreSettings();
      const id = crypto.randomUUID();
      s.productPage.customFields = [
        {
          id,
          label: "Delivery preference",
          type,
          required: true,
          enabled: true,
          order: 0,
          options: type === "select" ? ["Morning", "Afternoon"] : [],
        },
      ];
      const snapshot = snapshotOrderFields(s, { [id]: "Morning" });
      s.productPage.customFields[0].label = "Renamed";
      expect(snapshot).toEqual([
        { id, label: "Delivery preference", type, value: "Morning" },
      ]);
    },
  );
  it("rejects missing required, wrong options, unknown IDs and long custom values", () => {
    const s = defaultStoreSettings();
    const id = crypto.randomUUID();
    s.productPage.customFields = [
      {
        id,
        label: "Slot",
        type: "select",
        required: true,
        enabled: true,
        order: 0,
        options: ["Morning"],
      },
    ];
    for (const values of [
      {},
      { [id]: "Night" },
      { [crypto.randomUUID()]: "X" },
      { [id]: "x".repeat(2001) },
    ])
      expect(() => snapshotOrderFields(s, values)).toThrow();
  });
  it("enforces field count, label and option limits and stable unique IDs", () => {
    const s = defaultStoreSettings();
    const field = {
      id: crypto.randomUUID(),
      label: "Preference",
      type: "text" as const,
      required: false,
      enabled: true,
      order: 0,
      options: [],
    };
    for (const fields of [
      Array.from({ length: 9 }, () => ({ ...field, id: crypto.randomUUID() })),
      [{ ...field, label: "x".repeat(81) }],
      [field, field],
      [
        {
          ...field,
          type: "select",
          options: Array.from({ length: 21 }, (_, i) => String(i)),
        },
      ],
      [{ ...field, type: "select", options: ["x".repeat(81)] }],
      [{ ...field, type: "select", options: ["same", "same"] }],
    ])
      expect(
        storeSettingsInput.safeParse({
          ...s,
          productPage: { ...s.productPage, customFields: fields },
        }).success,
      ).toBe(false);
  });
  it("requires an accessible label when the Header CTA is enabled", () => {
    const s = defaultStoreSettings();
    s.navigation.cta.enabled = true;
    expect(storeSettingsInput.safeParse(s).success).toBe(false);
    s.navigation.cta.label = "Shop our products";
    expect(storeSettingsInput.safeParse(s).success).toBe(true);
  });
  it("validates social platform destinations", () => {
    const s = defaultStoreSettings();
    s.navigation.social.instagram = "https://[invalid";
    expect(storeSettingsInput.safeParse(s).success).toBe(false);
    s.navigation.social.instagram = "https://example.com";
    expect(storeSettingsInput.safeParse(s).success).toBe(false);
    s.navigation.social.instagram = "https://www.instagram.com/our-store";
    expect(storeSettingsInput.safeParse(s).success).toBe(true);
  });
});
