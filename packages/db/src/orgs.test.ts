import { beforeEach, expect, test } from "vitest";
import type { DB } from "./client";
import { testDb, makeUser } from "./testing";
import {
  ensurePersonalOrg,
  getRole,
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
