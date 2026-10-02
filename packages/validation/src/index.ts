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
