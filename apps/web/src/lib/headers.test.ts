import { expect, test } from "vitest";
import { securityHeaders } from "./headers";

const get = (k: string) => securityHeaders.find((h) => h.key === k)?.value;

test("sets the core security headers", () => {
  expect(get("X-Content-Type-Options")).toBe("nosniff");
  expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  expect(get("Strict-Transport-Security")).toContain("max-age=");
  expect(get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  expect(get("Content-Security-Policy")).toContain("default-src 'self'");
});
