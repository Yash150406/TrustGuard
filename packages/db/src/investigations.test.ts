import { beforeEach, expect, test } from "vitest";
import { normalizeTarget } from "@trustguard/core";
import type { DB } from "./client";
import { makeUser, testDb } from "./testing";
import { ensurePersonalOrg } from "./orgs";
import { forOrg } from "./investigations";

let db: DB;
beforeEach(async () => {
  db = await testDb();
});

test("orgs only see their own investigations", async () => {
  const a = await makeUser(db, "A");
  const b = await makeUser(db, "B");
  const orgA = await ensurePersonalOrg(db, a);
  const orgB = await ensurePersonalOrg(db, b);

  const inv = await forOrg(db, orgA).investigations.create(normalizeTarget("example.com"), a.id);

  expect(await forOrg(db, orgA).investigations.get(inv.id)).not.toBeNull();
  expect(await forOrg(db, orgB).investigations.get(inv.id)).toBeNull();
  expect(await forOrg(db, orgB).investigations.list()).toHaveLength(0);
  expect(await forOrg(db, orgA).investigations.list()).toHaveLength(1);
});

test("create stores the normalized target", async () => {
  const u = await makeUser(db);
  const org = await ensurePersonalOrg(db, u);
  const inv = await forOrg(db, org).investigations.create(normalizeTarget(" Example.com/x "), u.id);
  expect(inv).toMatchObject({
    targetUrl: "http://example.com/x",
    targetHost: "example.com",
    status: "queued",
  });
});
