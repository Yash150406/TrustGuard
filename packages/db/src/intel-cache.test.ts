import { beforeEach, expect, test, vi } from "vitest";
import type { SourceResult } from "@trustguard/core";
import type { DB } from "./client";
import { testDb } from "./testing";
import { cached } from "./intel-cache";

let db: DB;
const t0 = new Date("2026-10-11T10:00:00Z");
const opts = { source: "rdap" as const, key: "example.com", ttlMs: 3_600_000 };
const ok: SourceResult<{ age: number }> = { source: "rdap", status: "ok", data: { age: 400 } };
beforeEach(async () => {
  db = await testDb();
});

test("second call within TTL skips the fetcher", async () => {
  const f = vi.fn().mockResolvedValue(ok);
  await cached(db, { ...opts, now: t0 }, f);
  const r = await cached(db, { ...opts, now: new Date(t0.getTime() + 1000) }, f);
  expect(f).toHaveBeenCalledTimes(1);
  expect(r).toMatchObject({ status: "ok", data: { age: 400 }, cacheHit: true });
});

test("expired entries are fetched again", async () => {
  const f = vi.fn().mockResolvedValue(ok);
  await cached(db, { ...opts, now: t0 }, f);
  await cached(db, { ...opts, now: new Date(t0.getTime() + opts.ttlMs + 1) }, f);
  expect(f).toHaveBeenCalledTimes(2);
});

test("unavailable results are not cached", async () => {
  const f = vi.fn().mockResolvedValue({ source: "rdap", status: "unavailable", reason: "timeout" });
  await cached(db, { ...opts, now: t0 }, f);
  await cached(db, { ...opts, now: t0 }, f);
  expect(f).toHaveBeenCalledTimes(2);
});
