import { expect, it } from "vitest";
import { currencyDecimals, parseMoney, moneyInput, formatMoney } from "./money";
it("parses integer minor units exactly for two, zero and three decimal currencies", () => {
  expect(parseMoney("3990", "KES")).toBe(399000);
  expect(parseMoney("399", "GHS")).toBe(39900);
  expect(parseMoney("0.29", "KES")).toBe(29);
  expect(currencyDecimals("RWF")).toBe(0);
  expect(parseMoney("3990", "RWF")).toBe(3990);
  expect(parseMoney("1.234", "KWD")).toBe(1234);
  expect(moneyInput(1234, "KWD")).toBe("1.234");
  expect(formatMoney(399000, "KES")).toContain("3,990.00");
  expect(formatMoney(3990, "RWF")).toContain("3,990");
});
it("rejects negatives, fractional zero-decimal money, rounding, unsupported currencies and overflow", () => {
  for (const value of ["-1", "1,000", "1e3", "", "NaN", "0.001"])
    expect(() => parseMoney(value, "KES")).toThrow();
  expect(() => parseMoney("1.1", "RWF")).toThrow();
  expect(() => parseMoney("1", "XXX")).toThrow();
  expect(() => parseMoney("9007199254740992", "JPY")).toThrow();
  const amount = Number.MAX_SAFE_INTEGER;
  expect(parseMoney(moneyInput(amount, "KWD"), "KWD")).toBe(amount);
  expect(formatMoney(amount, "KWD")).toContain("9,007,199,254,740.991");
});
it("formats aggregated order values beyond the number range without rounding", () => {
  expect(formatMoney(18014398509481983n, "KES").replace(/\s/g, " ")).toBe(
    "KES 180,143,985,094,819.83",
  );
});
