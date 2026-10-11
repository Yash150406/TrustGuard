import { afterEach, expect, test, vi } from "vitest";
import { orgCookieOptions } from "./cookies";

afterEach(() => vi.unstubAllEnvs());

test("the org cookie is Secure in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  expect(orgCookieOptions()).toEqual({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
});

test("in development it works over plain http, for example from a phone on the LAN", () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(orgCookieOptions().secure).toBe(false);
});
