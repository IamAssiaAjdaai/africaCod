import { z } from "zod";
export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit HEX color, such as #147d64.");
export const safeStoreUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (value.startsWith("/"))
      return !value.startsWith("//") && !/[\\\s\u0000-\u001f]/.test(value);
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use a local path or an HTTPS URL.");
const optionalUrl = safeStoreUrl.nullable().default(null);
export const navigationTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("home") }),
  z.object({ kind: z.literal("products") }),
  z.object({ kind: z.literal("category"), id: z.uuid() }),
  z.object({ kind: z.literal("page"), id: z.uuid() }),
  z.object({ kind: z.literal("url"), url: safeStoreUrl }),
]);
const navigationLink = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1).max(60),
  target: navigationTarget,
});
export const builtInFieldIds = [
  "name",
  "phone",
  "region",
  "city",
  "address",
  "whatsapp",
  "notes",
] as const;
const builtInField = z.object({
  id: z.enum(builtInFieldIds),
  enabled: z.boolean(),
  required: z.boolean(),
  order: z.number().int().min(0).max(100),
});
export const customOrderField = z
  .object({
    id: z.uuid(),
    label: z.string().trim().min(1).max(80),
    type: z.enum(["text", "textarea", "select"]),
    required: z.boolean(),
    enabled: z.boolean(),
    order: z.number().int().min(0).max(100),
    options: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  })
  .superRefine((field, ctx) => {
    if (
      field.type === "select" &&
      (!field.options.length ||
        new Set(field.options).size !== field.options.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Select fields need distinct options.",
        path: ["options"],
      });
  });
export const storeSettingsInput = z
  .object({
    identity: z.object({
      name: z.string().trim().min(2).max(100).nullable().default(null),
      tagline: z.string().trim().max(200).nullable().default(null),
      contactEmail: z.email().max(200).nullable().default(null),
      contactPhone: z
        .string()
        .max(40)
        .regex(/^[+0-9 ()-]+$/)
        .nullable()
        .default(null),
      logoLight: z.uuid().nullable(),
      logoDark: z.uuid().nullable(),
      favicon: z.uuid().nullable(),
      heroLight: z.uuid().nullable(),
      heroDark: z.uuid().nullable(),
    }),
    theme: z.object({
      header: z.enum(["modern", "minimal"]),
      mode: z.enum(["light", "dark", "system"]),
      color: hexColor,
      font: z.enum(["geist", "inter", "poppins", "roboto"]),
    }),
    announcement: z.object({
      enabled: z.boolean(),
      text: z.string().trim().max(200),
      link: optionalUrl,
      background: hexColor,
      color: hexColor,
    }),
    hero: z.object({
      enabled: z.boolean(),
      title: z.string().trim().max(160),
      subtitle: z.string().trim().max(500),
      ctaLabel: z.string().trim().max(60),
      ctaUrl: optionalUrl,
    }),
    featured: z.object({
      enabled: z.boolean(),
      title: z.string().trim().min(1).max(100),
      mode: z.enum(["all", "category", "manual"]),
      categoryId: z.uuid().nullable(),
      productIds: z.array(z.uuid()).max(24),
    }),
    productPage: z.object({
      mode: z.enum(["inline", "popup"]),
      sticky: z.boolean(),
      quantity: z.boolean(),
      trustBadges: z.boolean(),
      buttonLabel: z.string().trim().min(2).max(60).nullable(),
      buttonBackground: hexColor.nullable(),
      buttonColor: hexColor.nullable(),
      fields: z.array(builtInField).length(7),
      customFields: z.array(customOrderField).max(8),
      badges: z
        .array(
          z.object({
            id: z.uuid(),
            icon: z.enum(["cash", "truck", "shield", "return"]),
            label: z.string().trim().min(1).max(80),
            enabled: z.boolean(),
            order: z.number().int().min(0).max(100),
          }),
        )
        .max(6),
    }),
    navigation: z.object({
      header: z.array(navigationLink).max(12),
      footer: z.array(navigationLink).max(12),
      cta: z.object({
        enabled: z.boolean(),
        label: z.string().trim().max(60),
        target: navigationTarget,
      }),
      social: z.object({
        instagram: optionalUrl,
        tiktok: optionalUrl,
        facebook: optionalUrl,
        youtube: optionalUrl,
      }),
    }),
  })
  .superRefine((settings, ctx) => {
    if (settings.navigation.cta.enabled && !settings.navigation.cta.label)
      ctx.addIssue({
        code: "custom",
        path: ["navigation", "cta", "label"],
        message: "Enter a label for the Header CTA.",
      });
    const fields = settings.productPage.fields;
    if (new Set(fields.map((f) => f.id)).size !== 7)
      ctx.addIssue({
        code: "custom",
        message: "Include every built-in field exactly once.",
      });
    if (
      fields.some(
        (f) => ["name", "phone"].includes(f.id) && (!f.enabled || !f.required),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Full name and phone must remain enabled and required.",
      });
    const custom = settings.productPage.customFields;
    if (new Set(custom.map((f) => f.id)).size !== custom.length)
      ctx.addIssue({
        code: "custom",
        message: "Custom field IDs must be distinct.",
      });
    for (const list of [
      settings.navigation.header,
      settings.navigation.footer,
      settings.productPage.badges,
    ])
      if (new Set(list.map((f) => f.id)).size !== list.length)
        ctx.addIssue({
          code: "custom",
          message: "Entry IDs must be distinct.",
        });
    if (settings.featured.mode === "category" && !settings.featured.categoryId)
      ctx.addIssue({ code: "custom", message: "Choose a featured category." });
    if (
      settings.featured.mode === "manual" &&
      new Set(settings.featured.productIds).size !==
        settings.featured.productIds.length
    )
      ctx.addIssue({ code: "custom", message: "Choose each product once." });
    for (const [platform, value] of Object.entries(
      settings.navigation.social,
    )) {
      if (!value) continue;
      let host: string;
      try {
        host = new URL(value, "https://invalid.local").hostname;
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["navigation", "social", platform],
          message: "Enter a valid URL.",
        });
        continue;
      }
      const domains: Record<string, string[]> = {
        instagram: ["instagram.com"],
        tiktok: ["tiktok.com"],
        facebook: ["facebook.com"],
        youtube: ["youtube.com", "youtu.be"],
      };
      if (!domains[platform].some((d) => host === d || host.endsWith(`.${d}`)))
        ctx.addIssue({
          code: "custom",
          path: ["navigation", "social", platform],
          message: `Use a ${platform} URL.`,
        });
    }
  });
export type StoreSettings = z.infer<typeof storeSettingsInput>;
export function defaultStoreSettings(): StoreSettings {
  return storeSettingsInput.parse({
    identity: {
      name: null,
      tagline: null,
      contactEmail: null,
      contactPhone: null,
      logoLight: null,
      logoDark: null,
      favicon: null,
      heroLight: null,
      heroDark: null,
    },
    theme: { header: "modern", mode: "light", color: "#147d64", font: "geist" },
    announcement: {
      enabled: false,
      text: "",
      link: null,
      background: "#173d33",
      color: "#ffffff",
    },
    hero: {
      enabled: false,
      title: "",
      subtitle: "",
      ctaLabel: "",
      ctaUrl: null,
    },
    featured: {
      enabled: false,
      title: "Featured products",
      mode: "all",
      categoryId: null,
      productIds: [],
    },
    productPage: {
      mode: "inline",
      sticky: true,
      quantity: true,
      trustBadges: false,
      buttonLabel: null,
      buttonBackground: null,
      buttonColor: null,
      fields: builtInFieldIds.map((id, order) => ({
        id,
        order,
        enabled: !["whatsapp", "notes"].includes(id),
        required: ["name", "phone"].includes(id),
      })),
      customFields: [],
      badges: [],
    },
    navigation: {
      header: [],
      footer: [],
      cta: { enabled: false, label: "", target: { kind: "products" } },
      social: { instagram: null, tiktok: null, facebook: null, youtube: null },
    },
  });
}
export type OrderFieldSnapshot = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  value: string;
};
export function snapshotOrderFields(
  settings: StoreSettings,
  values: Record<string, string>,
): OrderFieldSnapshot[] {
  const fields = settings.productPage.customFields.filter((f) => f.enabled);
  if (Object.keys(values).some((id) => !fields.some((f) => f.id === id)))
    throw new Error(
      "An order field is no longer available. Reload the product page.",
    );
  return fields
    .sort((a, b) => a.order - b.order)
    .flatMap((field) => {
      const value = (values[field.id] ?? "").trim();
      if (field.required && !value)
        throw new Error(`${field.label} is required.`);
      if (
        value.length > (field.type === "textarea" ? 2000 : 500) ||
        (value && field.type === "select" && !field.options.includes(value))
      )
        throw new Error(`Check ${field.label}.`);
      return value
        ? [{ id: field.id, label: field.label, type: field.type, value }]
        : [];
    });
}
