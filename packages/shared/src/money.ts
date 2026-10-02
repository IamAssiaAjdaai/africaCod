import { currencies } from "countries-list/currencies";
import type { TCurrencyCode } from "countries-list";
export function currencyDecimals(currency: string): number {
  const metadata = currencies[currency as TCurrencyCode];
  if (!metadata || ["XXX", "XTS"].includes(currency))
    throw new Error("Choose a currency with monetary minor-unit metadata.");
  return metadata.decimals;
}
// Parse decimal text using BigInt; never round an imprecise binary float.
export function parseMoney(value: string, currency: string): number {
  const digits = currencyDecimals(currency);
  const text = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(text))
    throw new Error("Enter a non-negative amount without separators.");
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > digits)
    throw new Error(`${currency} supports ${digits} decimal places.`);
  const minor =
    BigInt(whole) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, "0") || "0");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Amount is too large.");
  return Number(minor);
}
export function moneyInput(minor: number, currency: string): string {
  if (!Number.isSafeInteger(minor) || minor < 0)
    throw new Error("Invalid minor-unit amount.");
  const digits = currencyDecimals(currency);
  const text = String(minor).padStart(digits + 1, "0");
  return digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text;
}
export function formatMoney(
  minor: number,
  currency: string,
  locale = "en",
): string {
  const decimal = moneyInput(minor, currency);
  // Intl accepts decimal strings exactly at runtime; no floating-point conversion.
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: currencyDecimals(currency),
    maximumFractionDigits: currencyDecimals(currency),
  }).format(decimal as unknown as number);
}
