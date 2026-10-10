import { beforeEach, expect, test, vi } from "vitest";
import { ensurePersonalOrg, getRole, listTokens, type DB } from "@trustguard/db";
import { memberships } from "@trustguard/db/schema";
import { makeUser, testDb } from "@trustguard/db/testing";
import type { Member } from "@/lib/membership";
import { AppError } from "@/lib/errors";

const state = vi.hoisted(() => ({ db: undefined as unknown as DB, member: null as Member | null }));
vi.mock("@/db", () => ({
  get db() {
    return state.db;
  },
}));
vi.mock("@/lib/session", () => ({
  requireMember: async () => {
    if (!state.member) throw new AppError(401, "Sign in to continue.");
    return state.member;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://tg.example" }),
}));

const actions = await import("./actions");
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

let ownerId: string;
let orgId: string;
let otherId: string;
beforeEach(async () => {
  state.db = await testDb();
  const owner = await makeUser(state.db, "Owner");
  orgId = await ensurePersonalOrg(state.db, owner);
  ownerId = owner.id;
  const other = await makeUser(state.db, "Other");
  otherId = other.id;
  await state.db.insert(memberships).values({ orgId, userId: otherId, role: "analyst" });
  state.member = { userId: ownerId, orgId, role: "owner" };
});

test("owners change roles", async () => {
  expect(await actions.changeRole({}, form({ userId: otherId, role: "admin" }))).toEqual({
    ok: "Role updated.",
  });
  expect(await getRole(state.db, orgId, otherId)).toBe("admin");
});

test("admins cannot hand out the owner role", async () => {
  state.member = { userId: otherId, orgId, role: "admin" };
  await state.db.update(memberships).set({ role: "admin" });
  const r = await actions.changeRole({}, form({ userId: otherId, role: "owner" }));
  expect(r.error).toBe("Only an owner can do that.");
});

test("analysts cannot change roles", async () => {
  state.member = { userId: otherId, orgId, role: "analyst" };
  const r = await actions.changeRole({}, form({ userId: ownerId, role: "viewer" }));
  expect(r.error).toBe("Only an owner can do that.");
});

test("the last owner gets a clear message instead of a crash", async () => {
  const r = await actions.changeRole({}, form({ userId: ownerId, role: "admin" }));
  expect(r.error).toBe("An org needs at least one owner. Make someone else an owner first.");
});

test("unknown roles are rejected", async () => {
  const r = await actions.changeRole({}, form({ userId: otherId, role: "root" }));
  expect(r.error).toBe("Pick a valid role.");
});

test("removing a member", async () => {
  expect(await actions.removeMemberAction({}, form({ userId: otherId }))).toEqual({
    ok: "Member removed.",
  });
  expect(await getRole(state.db, orgId, otherId)).toBeNull();
});

test("invite links are created for admins and up", async () => {
  const r = await actions.createInviteAction({}, form({ role: "viewer" }));
  expect(r.url).toMatch(/^https:\/\/tg\.example\/invite\/[\w-]+$/);
});

test("tokens are shown once and can be revoked", async () => {
  const r = await actions.createTokenAction({}, form({ name: "laptop" }));
  expect(r.token).toMatch(/^tg_/);
  const [t] = await listTokens(state.db, ownerId);
  expect(await actions.revokeTokenAction({}, form({ id: t!.id }))).toEqual({ ok: "Token revoked." });
  expect((await listTokens(state.db, ownerId))[0]!.revokedAt).not.toBeNull();
});

test("signed-out calls return the sign-in message", async () => {
  state.member = null;
  expect((await actions.createTokenAction({}, form({ name: "x" }))).error).toBe("Sign in to continue.");
});
