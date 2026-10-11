import { beforeEach, expect, test } from "vitest";
import type { DB } from "./client";
import { testDb } from "./testing";
import { hit } from "./rate-limit";

let db: DB;
const t0 = new Date("2026-10-11T10:00:00Z");
beforeEach(async () => {
  db = await testDb();
});

test("allows up to the limit, then refuses", async () => {
  const results = [];
  for (let i = 0; i < 4; i++) {
    results.push(await hit(db, { key: "u1", limit: 3, windowMs: 60_000, now: t0 }));
  }
  expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
  expect(results[2]!.remaining).toBe(0);
});

test("a new window resets the count", async () => {
  for (let i = 0; i < 3; i++) await hit(db, { key: "u1", limit: 3, windowMs: 60_000, now: t0 });
  const next = new Date(t0.getTime() + 60_000);
  expect((await hit(db, { key: "u1", limit: 3, windowMs: 60_000, now: next })).allowed).toBe(true);
});

// PGlite has one connection, so these run one after another. The guarantee under real
// concurrency comes from the single INSERT ... ON CONFLICT DO UPDATE taking a row lock.
test("concurrent hits never exceed the limit", async () => {
  const rs = await Promise.all(
    Array.from({ length: 10 }, () =>
      hit(db, { key: "burst", limit: 5, windowMs: 60_000, now: t0 }),
    ),
  );
  expect(rs.filter((r) => r.allowed)).toHaveLength(5);
});

test("keys are independent", async () => {
  await hit(db, { key: "a", limit: 1, windowMs: 60_000, now: t0 });
  expect((await hit(db, { key: "b", limit: 1, windowMs: 60_000, now: t0 })).allowed).toBe(true);
});

test("a request carrying an older window (clock skew) doesn't reset the count", async () => {
  const o = { key: "skew", limit: 2, windowMs: 60_000 };
  const earlier = new Date(t0.getTime() - 60_000);
  expect((await hit(db, { ...o, now: t0 })).allowed).toBe(true);
  expect((await hit(db, { ...o, now: earlier })).allowed).toBe(true);
  expect((await hit(db, { ...o, now: t0 })).allowed).toBe(false);
});
