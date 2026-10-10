import { beforeEach, expect, test } from "vitest";
import type { DB } from "./client";
import { makeUser, testDb } from "./testing";
import { ensurePersonalOrg, getRole } from "./orgs";
import { acceptInvite, createInvite, InviteError } from "./invites";

let db: DB;
const now = new Date("2026-10-11T10:00:00Z");
const day = 86_400_000;
beforeEach(async () => {
  db = await testDb();
});

async function setup() {
  const owner = await makeUser(db, "Owner");
  const orgId = await ensurePersonalOrg(db, owner);
  const code = await createInvite(db, { orgId, role: "analyst", createdBy: owner.id, now });
  return { owner, orgId, code };
}

test("invite adds the user with the invited role", async () => {
  const { orgId, code } = await setup();
  const guest = await makeUser(db, "Guest");
  expect(await acceptInvite(db, { code, userId: guest.id, now })).toEqual({
    status: "joined",
    orgId,
  });
  expect(await getRole(db, orgId, guest.id)).toBe("analyst");
});

test("invites are single use", async () => {
  const { code } = await setup();
  await acceptInvite(db, { code, userId: (await makeUser(db)).id, now });
  await expect(acceptInvite(db, { code, userId: (await makeUser(db)).id, now })).rejects.toThrow(
    "This invite has already been used.",
  );
});

test("expired invites are refused", async () => {
  const { code } = await setup();
  const later = new Date(now.getTime() + 8 * day);
  await expect(
    acceptInvite(db, { code, userId: (await makeUser(db)).id, now: later }),
  ).rejects.toThrow("This invite has expired.");
});

test("existing members keep their role and the invite stays unused", async () => {
  const { owner, orgId, code } = await setup();
  expect(await acceptInvite(db, { code, userId: owner.id, now })).toEqual({
    status: "already-member",
    orgId,
  });
  expect(await getRole(db, orgId, owner.id)).toBe("owner");
  const guest = await makeUser(db);
  expect((await acceptInvite(db, { code, userId: guest.id, now })).status).toBe("joined");
});

test("unknown codes are refused", async () => {
  await expect(acceptInvite(db, { code: "nope", userId: "x", now })).rejects.toThrow(InviteError);
});
