import { beforeEach, expect, test } from "vitest";
import type { DB } from "./client";
import { makeUser, testDb } from "./testing";
import { ensurePersonalOrg } from "./orgs";
import { createToken, listTokens, revokeToken, verifyToken } from "./tokens";
import { apiTokens } from "./schema";

let db: DB;
const now = new Date("2026-10-11T10:00:00Z");
beforeEach(async () => {
  db = await testDb();
});

async function setup() {
  const u = await makeUser(db);
  const orgId = await ensurePersonalOrg(db, u);
  return { u, orgId, ...(await createToken(db, { userId: u.id, orgId, name: "laptop" })) };
}

test("a fresh token verifies, even with surrounding whitespace", async () => {
  const { u, orgId, token } = await setup();
  expect(token.startsWith("tg_")).toBe(true);
  expect(await verifyToken(db, `  ${token}\n`, now)).toMatchObject({ userId: u.id, orgId });
});

test("only the hash is stored", async () => {
  const { token } = await setup();
  const rows = await db.select().from(apiTokens);
  expect(JSON.stringify(rows)).not.toContain(token);
});

test("revoked tokens fail", async () => {
  const { u, id, token } = await setup();
  await revokeToken(db, { id, userId: u.id, now });
  expect(await verifyToken(db, token, now)).toBeNull();
});

test("users cannot revoke someone else's token", async () => {
  const { id, token } = await setup();
  const other = await makeUser(db);
  await revokeToken(db, { id, userId: other.id, now });
  expect(await verifyToken(db, token, now)).not.toBeNull();
});

test("unknown tokens fail and listing hides hashes", async () => {
  const { u } = await setup();
  expect(await verifyToken(db, "tg_wrong", now)).toBeNull();
  const list = await listTokens(db, u.id);
  expect(list[0]).not.toHaveProperty("hash");
});
