import { expect, test } from "vitest";
import { linkErrorMessage } from "./link-errors";

test("an account already used by someone else says so", () => {
  expect(linkErrorMessage("OAuthAccountNotLinked")).toBe(
    "That account is already used by another TrustGuard user. Sign in with it and remove it there first, or use a different account.",
  );
});

test("cancelling on the provider's screen isn't reported as a conflict", () => {
  expect(linkErrorMessage("AccessDenied")).toBe("Connecting was cancelled. Nothing changed.");
});

test("anything else gets a neutral message", () => {
  expect(linkErrorMessage("Configuration")).toBe("Couldn't connect that account. Try again.");
  expect(linkErrorMessage(undefined)).toBeNull();
});
