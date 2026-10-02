import { z } from "zod";
export const organizationInput = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(100),
});
export const storeInput = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(100),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(63)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and single hyphens.",
    )
    .refine(
      (slug) =>
        ![
          "admin",
          "api",
          "www",
          "dashboard",
          "stores",
          "settings",
          "sign-in",
          "sign-up",
        ].includes(slug),
      "This address is reserved.",
    ),
});
export const marketInput = z.object({
  storeId: z.uuid(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
});
export const marketStatusInput = z.object({
  storeId: z.uuid(),
  marketId: z.uuid(),
  status: z.enum(["active", "inactive"]),
});

export const customMarketInput = z.object({
  storeId: z.uuid(),
  name: z.string().trim().min(2).max(100),
  currency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.string().refine((value) => {
    try {
      return Intl.getCanonicalLocales(value).length === 1;
    } catch {
      return false;
    }
  }, "Use a valid BCP 47 locale."),
  callingCode: z
    .string()
    .regex(/^\+\d{1,4}$/)
    .nullable()
    .default(null),
});

const slug = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens.",
  );
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .default(null);
export const categoryInput = z.object({
  storeId: z.uuid(),
  name: z.string().trim().min(2).max(100),
  slug,
  parentId: z.uuid().nullable().default(null),
  status: z.enum(["active", "inactive"]).default("active"),
  sortOrder: z.number().int().min(0).max(100000).default(0),
});
export const productInput = z.object({
  storeId: z.uuid(),
  name: z.string().trim().min(2).max(200),
  slug,
  sku: optionalText(100).transform((value) => value?.toUpperCase() ?? null),
  shortDescription: optionalText(160),
  description: optionalText(50000),
  categoryId: z.uuid().nullable().default(null),
  subcategoryId: z.uuid().nullable().default(null),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
});
export const variantInput = z.object({
  productId: z.uuid(),
  name: z.string().trim().min(1).max(100),
  sku: optionalText(100).transform((value) => value?.toUpperCase() ?? null),
  status: z.enum(["active", "inactive"]).default("active"),
  sortOrder: z.number().int().min(0).max(100000).default(0),
});
export const offerInput = z.object({
  productId: z.uuid(),
  storeMarketId: z.uuid(),
  price: z.string().max(30),
  compareAtPrice: optionalText(30),
  cost: optionalText(30),
  status: z.enum(["active", "inactive"]).default("active"),
});
export const mediaUploadInput = z.object({
  productId: z.uuid(),
  altText: optionalText(200),
});
export const reorderInput = z.object({
  productId: z.uuid(),
  ids: z.array(z.uuid()).max(100),
});

export const pageConfigInput = z.object({
  headline: z.string().trim().min(2).max(200),
  subtitle: z.string().trim().max(500).default(""),
  benefits: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
  trustMessage: z
    .string()
    .trim()
    .max(300)
    .default("Pay when your order arrives."),
  ctaLabel: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .default("Order with cash on delivery"),
  mediaIds: z.array(z.uuid()).max(100).default([]),
});
export type PageConfig = z.infer<typeof pageConfigInput>;
export const checkoutConfigurationInput = z.object({
  locale: z.string().min(2).max(50),
  callingCode: z.string().nullable(),
  phoneCountry: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  regionRequired: z.boolean(),
  cityRequired: z.boolean(),
  addressRequired: z.boolean(),
  regionLabel: z.string().min(1).max(60),
  cityLabel: z.string().min(1).max(60),
  addressLabel: z.string().min(1).max(60),
  phoneLabel: z.string().min(1).max(60),
});
export type CheckoutConfiguration = z.infer<typeof checkoutConfigurationInput>;
const trackingValue = z.string().trim().max(500).nullable().default(null);
const trackingUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  })
  .nullable()
  .default(null);
export const attributionInput = z.object({
  utmSource: trackingValue,
  utmMedium: trackingValue,
  utmCampaign: trackingValue,
  utmContent: trackingValue,
  utmTerm: trackingValue,
  fbclid: trackingValue,
  fbp: trackingValue,
  fbc: trackingValue,
  referrer: trackingUrl,
  landingUrl: trackingUrl,
});
export const checkoutInput = z.object({
  market: z.string().min(2).max(150),
  name: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(5).max(40),
  region: z.string().trim().max(150).default(""),
  city: z.string().trim().max(150).default(""),
  address: z.string().trim().max(500).default(""),
  variantId: z.uuid().nullable().default(null),
  quantity: z.number().int().min(1).max(20),
  attribution: attributionInput.default({
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    fbclid: null,
    fbp: null,
    fbc: null,
    referrer: null,
    landingUrl: null,
  }),
});
export const orderFiltersInput = z.object({
  storeId: z.uuid().optional(),
  marketId: z.uuid().optional(),
  status: z.enum(["new", "cancelled"]).optional(),
  search: z.string().trim().max(150).default(""),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  page: z.number().int().min(1).max(100000).default(1),
});

export const contentPageInput = z.object({
  storeId: z.uuid(),
  title: z.string().trim().min(2).max(200),
  slug,
  content: z.string().max(50000).default(""),
  metaTitle: z.string().trim().max(200).nullable().default(null),
  metaDescription: z.string().trim().max(500).nullable().default(null),
  showInNavigation: z.boolean().default(false),
  navigationLabel: z.string().trim().max(60).nullable().default(null),
  navigationOrder: z.number().int().min(0).max(1000).default(0),
});
export type ContentPageDraft = z.infer<typeof contentPageInput>;
export type PublishedContent = Omit<ContentPageDraft, "storeId">;
export const brandingInput = z.object({
  name: storeInput.shape.name,
  tagline: z.string().trim().max(200).nullable().default(null),
  contactEmail: z.email().max(200).nullable().default(null),
  contactPhone: z
    .string()
    .trim()
    .min(5)
    .max(40)
    .regex(/^[+0-9 ()-]+$/, "Use a phone number.")
    .nullable()
    .default(null),
});
