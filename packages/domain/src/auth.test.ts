import { expect, it } from "vitest";
import { DomainError, requireUser } from "./index";
it("requires an authenticated identity before tenant lookups", () => {
  expect(() => requireUser(null)).toThrow(DomainError);
  expect(() => requireUser(undefined)).toThrow("Please sign in");
  expect(() => requireUser("")).toThrow();
  expect(requireUser("user-a")).toBe("user-a");
});
