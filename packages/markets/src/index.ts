export type CountryDefinition = {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  defaultLocale: string;
  callingCode: string;
  active: boolean;
};
// ISO 3166-1 alpha-2 / ISO 4217 / BCP 47. This is a platform catalog, never a store default.
export const countryCatalog: CountryDefinition[] = [
  {
    code: "KE",
    name: "Kenya",
    currencyCode: "KES",
    currencySymbol: "KSh",
    defaultLocale: "en-KE",
    callingCode: "+254",
    active: true,
  },
  {
    code: "GH",
    name: "Ghana",
    currencyCode: "GHS",
    currencySymbol: "GH₵",
    defaultLocale: "en-GH",
    callingCode: "+233",
    active: true,
  },
  {
    code: "GN",
    name: "Guinea",
    currencyCode: "GNF",
    currencySymbol: "FG",
    defaultLocale: "fr-GN",
    callingCode: "+224",
    active: true,
  },
  {
    code: "CI",
    name: "Côte d’Ivoire",
    currencyCode: "XOF",
    currencySymbol: "CFA",
    defaultLocale: "fr-CI",
    callingCode: "+225",
    active: true,
  },
  {
    code: "SN",
    name: "Senegal",
    currencyCode: "XOF",
    currencySymbol: "CFA",
    defaultLocale: "fr-SN",
    callingCode: "+221",
    active: true,
  },
  {
    code: "CM",
    name: "Cameroon",
    currencyCode: "XAF",
    currencySymbol: "FCFA",
    defaultLocale: "fr-CM",
    callingCode: "+237",
    active: true,
  },
  {
    code: "TZ",
    name: "Tanzania",
    currencyCode: "TZS",
    currencySymbol: "TSh",
    defaultLocale: "sw-TZ",
    callingCode: "+255",
    active: true,
  },
  {
    code: "UG",
    name: "Uganda",
    currencyCode: "UGX",
    currencySymbol: "USh",
    defaultLocale: "en-UG",
    callingCode: "+256",
    active: true,
  },
  {
    code: "NG",
    name: "Nigeria",
    currencyCode: "NGN",
    currencySymbol: "₦",
    defaultLocale: "en-NG",
    callingCode: "+234",
    active: true,
  },
  {
    code: "MA",
    name: "Morocco",
    currencyCode: "MAD",
    currencySymbol: "DH",
    defaultLocale: "ar-MA",
    callingCode: "+212",
    active: true,
  },
];
