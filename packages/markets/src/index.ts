import { getCountryDataList } from "countries-list";
export type CountryDefinition = {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  defaultLocale: string;
  callingCode: string | null;
};
// ISO 3166-1 alpha-2 / ISO 4217 / BCP 47. This is a platform catalog, never a store default.
const legacyDefaults: CountryDefinition[] = [
  {
    code: "KE",
    name: "Kenya",
    currencyCode: "KES",
    currencySymbol: "KSh",
    defaultLocale: "en-KE",
    callingCode: "+254",
  },
  {
    code: "GH",
    name: "Ghana",
    currencyCode: "GHS",
    currencySymbol: "GH₵",
    defaultLocale: "en-GH",
    callingCode: "+233",
  },
  {
    code: "GN",
    name: "Guinea",
    currencyCode: "GNF",
    currencySymbol: "FG",
    defaultLocale: "fr-GN",
    callingCode: "+224",
  },
  {
    code: "CI",
    name: "Côte d’Ivoire",
    currencyCode: "XOF",
    currencySymbol: "CFA",
    defaultLocale: "fr-CI",
    callingCode: "+225",
  },
  {
    code: "SN",
    name: "Senegal",
    currencyCode: "XOF",
    currencySymbol: "CFA",
    defaultLocale: "fr-SN",
    callingCode: "+221",
  },
  {
    code: "CM",
    name: "Cameroon",
    currencyCode: "XAF",
    currencySymbol: "FCFA",
    defaultLocale: "fr-CM",
    callingCode: "+237",
  },
  {
    code: "TZ",
    name: "Tanzania",
    currencyCode: "TZS",
    currencySymbol: "TSh",
    defaultLocale: "sw-TZ",
    callingCode: "+255",
  },
  {
    code: "UG",
    name: "Uganda",
    currencyCode: "UGX",
    currencySymbol: "USh",
    defaultLocale: "en-UG",
    callingCode: "+256",
  },
  {
    code: "NG",
    name: "Nigeria",
    currencyCode: "NGN",
    currencySymbol: "₦",
    defaultLocale: "en-NG",
    callingCode: "+234",
  },
  {
    code: "MA",
    name: "Morocco",
    currencyCode: "MAD",
    currencySymbol: "DH",
    defaultLocale: "ar-MA",
    callingCode: "+212",
  },
];

// Include the standard ISO list plus explicitly identified supplemental territories.
const referenceCountries = getCountryDataList();
export const countryCatalog: CountryDefinition[] = referenceCountries.map(
  (country) => {
    const legacy = legacyDefaults.find((entry) => entry.code === country.iso2);
    const currencyCode = country.currency[0] ?? "XXX";
    const defaultLocale = Intl.getCanonicalLocales(
      `${country.languages[0] ?? "en"}-${country.iso2}`,
    )[0];
    return (
      legacy ?? {
        code: country.iso2,
        name: country.name,
        currencyCode,
        currencySymbol:
          new Intl.NumberFormat("en", {
            style: "currency",
            currency: currencyCode,
          })
            .formatToParts(0)
            .find((part) => part.type === "currency")?.value ?? currencyCode,
        defaultLocale,
        callingCode:
          country.iso2 === "AQ"
            ? null
            : country.phone[0]
              ? `+${country.phone[0]}`
              : null,
      }
    );
  },
);
export function normalizeMarketName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
const canonicalNames = new Set(
  referenceCountries
    .flatMap((country) => [
      country.iso2,
      country.iso3,
      country.name,
      country.native,
      ...(country.alias ?? []),
    ])
    .concat(countryCatalog.map((country) => country.name))
    .map(normalizeMarketName),
);
export function isCatalogCountry(name: string): boolean {
  return canonicalNames.has(normalizeMarketName(name));
}
