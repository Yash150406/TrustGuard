import { beforeEach, expect, test } from "vitest";
import { createToken, ensurePersonalOrg, revokeToken, type DB } from "@trustguard/db";
import { memberships } from "@trustguard/db/schema";
import { makeUser, testDb } from "@trustguard/db/testing";
import { resolveMember } from "./membership";

let db: DB;
const now = new Date("2026-10-12T10:00:00Z");
beforeEach(async () => {
  db = await testDb();
});

test("a valid API token resolves to its user and org", async () => {
  const u = await makeUser(db);
  const orgId = await ensurePersonalOrg(db, u);
  const { token } = await createToken(db, { userId: u.id, orgId, name: "ext" });
  const m = await resolveMember(db, { bearer: token, allowToken: true, action: "investigation:create", now });
  expect(m).toEqual({ userId: u.id, orgId, role: "owner" });
});

test("a revoked token gets 401", async () => {
  const u = await makeUser(db);
  const orgId = await ensurePersonalOrg(db, u);
  const { id, token } = await createToken(db, { userId: u.id, orgId, name: "ext" });
  await revokeToken(db, { id, userId: u.id, now });
  await expect(
    resolveMember(db, { bearer: token, allowToken: true, action: "investigation:read", now }),
  ).rejects.toMatchObject({ status: 401 });
});

test("no token and no session gets 401", async () => {
  await expect(resolveMember(db, { action: "investigation:read", now })).rejects.toMatchObject({
    status: 401,
    publicMessage: "Sign in to continue.",
  });
});

test("session users work in the org they picked when they belong to it", async () => {
  const u = await makeUser(db);
  const own = await ensurePersonalOrg(db, u);
  const other = await ensurePersonalOrg(db, await makeUser(db));
  await db.insert(memberships).values({ orgId: other, userId: u.id, role: "analyst" });

  const picked = await resolveMember(db, {
    sessionUserId: u.id,
    wantedOrgId: other,
    action: "investigation:read",
    now,
  });
  expect(picked).toMatchObject({ orgId: other, role: "analyst" });

  const fallback = await resolveMember(db, {
    sessionUserId: u.id,
    wantedOrgId: crypto.randomUUID(),
    action: "investigation:read",
    now,
  });
  expect(fallback).toMatchObject({ orgId: own, role: "owner" });
});

test("a viewer cannot create investigations", async () => {
  const u = await makeUser(db);
  const orgId = await ensurePersonalOrg(db, await makeUser(db));
  await db.insert(memberships).values({ orgId, userId: u.id, role: "viewer" });
  await expect(
    resolveMember(db, {
      sessionUserId: u.id,
      wantedOrgId: orgId,
      action: "investigation:create",
      now,
    }),
  ).rejects.toMatchObject({ status: 403, publicMessage: "Your role doesn't allow this." });
});

test("a signed-in user with no org gets 403", async () => {
  const u = await makeUser(db);
  await expect(
    resolveMember(db, { sessionUserId: u.id, action: "investigation:read", now }),
  ).rejects.toMatchObject({ status: 403 });
});

test("API tokens are refused unless the route allows them", async () => {
  const u = await makeUser(db);
  const orgId = await ensurePersonalOrg(db, u);
  const { token } = await createToken(db, { userId: u.id, orgId, name: "ext" });
  await expect(
    resolveMember(db, { bearer: token, action: "investigation:read", now }),
  ).rejects.toMatchObject({ status: 403, publicMessage: "API tokens can't be used for this. Sign in to TrustGuard instead." });
});

test("an action pinned to an org fails if the active org is a different one", async () => {
  const u = await makeUser(db);
  const own = await ensurePersonalOrg(db, u);
  const other = await ensurePersonalOrg(db, await makeUser(db));
  await db.insert(memberships).values({ orgId: other, userId: u.id, role: "admin" });
  await expect(
    resolveMember(db, { sessionUserId: u.id, wantedOrgId: other, requiredOrgId: own, action: "investigation:read", now }),
  ).rejects.toMatchObject({ status: 409 });
  const ok = await resolveMember(db, {
    sessionUserId: u.id,
    wantedOrgId: own,
    requiredOrgId: own,
    action: "investigation:read",
    now,
  });
  expect(ok.orgId).toBe(own);
});
