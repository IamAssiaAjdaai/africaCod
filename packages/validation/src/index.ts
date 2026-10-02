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
