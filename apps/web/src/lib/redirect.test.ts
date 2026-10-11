import { expect, test } from "vitest";
import { safeRedirectPath } from "./redirect";

test.each([
  ["/settings", "/settings"],
  ["/invite/abc?x=1#y", "/invite/abc?x=1#y"],
  [undefined, "/"],
  ["", "/"],
])("keeps same-site path %s", (input, out) => {
  expect(safeRedirectPath(input)).toBe(out);
});

test.each([
  "//evil.com",
  "/\\evil.com",
  "/\t/evil.com",
  "https://evil.com/",
  "javascript:alert(1)",
  "/%5Cevil.com",
])("refuses off-site target %s", (input) => {
  expect(safeRedirectPath(input)).toBe("/");
});

test("absolute URLs on the app's own origin are reduced to their path", () => {
  expect(safeRedirectPath("https://usetrustguard.vercel.app/settings", "https://usetrustguard.vercel.app")).toBe(
    "/settings",
  );
});
