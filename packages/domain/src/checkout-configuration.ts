import parsePhoneNumber, {
  isSupportedCountry,
  type CountryCode,
} from "libphonenumber-js/max";
import {
  checkoutConfigurationInput,
  type CheckoutConfiguration,
} from "@africacod/validation";
import { DomainError } from "./commerce";
const countrySettings: Record<string, Partial<CheckoutConfiguration>> = {
  KE: { regionRequired: true, regionLabel: "County", cityLabel: "City / town" },
  GH: { regionRequired: true, regionLabel: "Region", cityLabel: "City / town" },
};
export function checkoutConfiguration(market: {
  countryCode: string | null;
  locale: string;
  callingCode: string | null;
  checkoutConfig?: unknown;
}): CheckoutConfiguration {
  const country = market.countryCode as CountryCode | null;
  const defaults = {
    locale: market.locale,
    callingCode: market.callingCode,
    phoneCountry: country && isSupportedCountry(country) ? country : null,
    regionRequired: false,
    cityRequired: true,
    addressRequired: true,
    regionLabel: "Region / state",
    cityLabel: "City / town",
    addressLabel: "Delivery address",
    phoneLabel: "Phone number",
    ...(countrySettings[market.countryCode ?? ""] ?? {}),
  };
  return checkoutConfigurationInput.parse(market.checkoutConfig ?? defaults);
}
export function normalizeCheckoutPhone(
  phone: string,
  config: CheckoutConfiguration,
): string {
  const number = parsePhoneNumber(phone, {
    defaultCountry:
      (config.phoneCountry as CountryCode | undefined) ?? undefined,
    extract: false,
  });
  if (
    !number ||
    !number.isValid() ||
    number.ext ||
    (config.phoneCountry && number.country !== config.phoneCountry)
  )
    throw new DomainError(
      "INVALID_INPUT",
      "Enter a valid phone number for the selected market.",
    );
  return number.number;
}
export function validateCheckoutAddress(
  value: { region: string; city: string; address: string },
  config: CheckoutConfiguration,
) {
  for (const [required, field, label] of [
    [config.regionRequired, value.region, config.regionLabel],
    [config.cityRequired, value.city, config.cityLabel],
    [config.addressRequired, value.address, config.addressLabel],
  ] as const)
    if (required && field.length < (label === config.addressLabel ? 5 : 2))
      throw new DomainError(
        "INVALID_INPUT",
        `Enter a valid ${label.toLowerCase()}.`,
      );
}
