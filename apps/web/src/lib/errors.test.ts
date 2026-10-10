import { expect, test } from "vitest";
import { AppError, errorResponse, redact } from "./errors";

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
