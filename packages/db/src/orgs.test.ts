import { beforeEach, expect, test } from "vitest";
import type { DB } from "./client";
import { testDb, makeUser } from "./testing";
import {
  ensurePersonalOrg,
  getOrg,
  getRole,
  listMembers,
  listMyOrgs,
  listMemberships,
  OrgRuleError,
  removeMember,
  setMemberRole,
} from "./orgs";
import { memberships } from "./schema";

let db: DB;
beforeEach(async () => {
  db = await testDb();
});

test("first sign-in creates a personal org with the user as owner", async () => {
  const u = await makeUser(db, "Asha");
  const orgId = await ensurePersonalOrg(db, u);
  expect(await getRole(db, orgId, u.id)).toBe("owner");
});

test("ensurePersonalOrg is idempotent", async () => {
  const u = await makeUser(db);
  const a = await ensurePersonalOrg(db, u);
  const b = await ensurePersonalOrg(db, u);
  expect(a).toBe(b);
  expect(await listMemberships(db, u.id)).toHaveLength(1);
});

test("the last owner cannot be demoted or removed", async () => {
  const u = await makeUser(db);
  const orgId = await ensurePersonalOrg(db, u);
  await expect(setMemberRole(db, orgId, u.id, "admin")).rejects.toThrow(OrgRuleError);
  await expect(removeMember(db, orgId, u.id)).rejects.toThrow(OrgRuleError);
  expect(await getRole(db, orgId, u.id)).toBe("owner");
});

test("an owner can step down once another owner exists", async () => {
  const a = await makeUser(db);
  const b = await makeUser(db);
  const orgId = await ensurePersonalOrg(db, a);
  await db.insert(memberships).values({ orgId, userId: b.id, role: "owner" });
  await setMemberRole(db, orgId, a.id, "admin");
  expect(await getRole(db, orgId, a.id)).toBe("admin");
});

test("listMembers returns names and roles for one org only", async () => {
  const a = await makeUser(db, "Asha");
  const b = await makeUser(db, "Ben");
  const orgId = await ensurePersonalOrg(db, a);
  await ensurePersonalOrg(db, b);
  await db.insert(memberships).values({ orgId, userId: b.id, role: "viewer" });
  const list = await listMembers(db, orgId);
  expect(list.map((m) => [m.name, m.role])).toEqual([
    ["Asha", "owner"],
    ["Ben", "viewer"],
  ]);
});

test("getOrg returns the org name", async () => {
  const a = await makeUser(db, "Asha");
  const orgId = await ensurePersonalOrg(db, a);
  expect((await getOrg(db, orgId))?.name).toBe("Asha's org");
  expect(await getOrg(db, crypto.randomUUID())).toBeNull();
});

test("listMyOrgs returns every org a user belongs to with their role", async () => {
  const a = await makeUser(db, "Asha");
  const b = await makeUser(db, "Ben");
  const own = await ensurePersonalOrg(db, a);
  const team = await ensurePersonalOrg(db, b);
  await db.insert(memberships).values({ orgId: team, userId: a.id, role: "analyst" });
  const mine = await listMyOrgs(db, a.id);
  expect(mine).toEqual([
    { orgId: own, name: "Asha's org", role: "owner" },
    { orgId: team, name: "Ben's org", role: "analyst" },
  ]);
});

test("listMemberships returns the oldest membership first", async () => {
  const a = await makeUser(db, "Asha");
  const b = await makeUser(db, "Ben");
  await ensurePersonalOrg(db, a);
  const team = await ensurePersonalOrg(db, b);
  await db
    .insert(memberships)
    .values({ orgId: team, userId: a.id, role: "analyst", createdAt: new Date("2020-01-01T00:00:00Z") });
  expect((await listMemberships(db, a.id))[0]?.orgId).toBe(team);
});
