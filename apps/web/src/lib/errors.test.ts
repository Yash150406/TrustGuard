import { expect, test, vi } from "vitest";
import { AppError, errorResponse, logError, redact } from "./errors";

test("unknown errors never leak their message", async () => {
  const res = errorResponse(new Error("upstream said key=sk_live_123 is invalid"));
  expect(res.status).toBe(500);
  const body = await res.text();
  expect(body).not.toContain("sk_live_123");
  expect(JSON.parse(body).error).toBe("Something went wrong. Try again in a moment.");
});

test("AppError shows its public message and status", async () => {
  const res = errorResponse(new AppError(429, "Daily scan limit reached."));
  expect(res.status).toBe(429);
  expect((await res.json()).error).toBe("Daily scan limit reached.");
});

test("redact removes every secret", () => {
  expect(redact("a=SECRET1 b=SECRET2", ["SECRET1", "SECRET2", ""])).toBe(
    "a=[redacted] b=[redacted]",
  );
});

test("unexpected errors are logged with their message and stack, with secrets blanked", () => {
  vi.stubEnv("AUTH_GITHUB_SECRET", "gh_secret_value_123");
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const res = errorResponse(new Error("upstream rejected gh_secret_value_123 for user 42"));
  const logged = spy.mock.calls.map((c) => c.join(" ")).join("\n");
  expect(logged).toContain("upstream rejected [redacted] for user 42");
  expect(logged).toContain("at "); // stack frames are kept
  expect(logged).not.toContain("gh_secret_value_123");
  expect(res.status).toBe(500);
  spy.mockRestore();
  vi.unstubAllEnvs();
});

test("the database password is blanked even when it appears without the rest of the URL", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://app:p%40ss-word9@db.example.com:6543/postgres");
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  logError("x", new Error("auth failed for password p@ss-word9"));
  const logged = spy.mock.calls.map((c) => c.join(" ")).join("\n");
  expect(logged).not.toContain("p@ss-word9");
  spy.mockRestore();
  vi.unstubAllEnvs();
});
