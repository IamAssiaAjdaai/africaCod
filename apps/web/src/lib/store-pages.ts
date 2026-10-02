import { cache } from "react";
import { site } from "./server";
import { found } from "./catalog-pages";
export const publicStore = cache((slug: string) =>
  found(site().getPublicStore(slug)),
);
export const publicContentPage = cache((storeSlug: string, pageSlug: string) =>
  found(site().getPublicContentPage(storeSlug, pageSlug)),
);
export function marketParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? "" : value;
}
export function pageParam(value: string | string[] | undefined) {
  const parsed = Number(value ?? 1);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10000
    ? parsed
    : 1;
}
