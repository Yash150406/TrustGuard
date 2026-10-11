import { beforeAll, beforeEach, expect, test, vi } from "vitest";
import { createInvite, ensurePersonalOrg, type DB } from "@trustguard/db";
import { makeUser, testDb } from "@trustguard/db/testing";
import type { Member } from "@/lib/membership";
import { AppError } from "@/lib/errors";

const state = vi.hoisted(() => ({ db: undefined as unknown as DB, member: null as Member | null }));
vi.mock("@/db", () => ({
  get db() {
    return state.db;
  },
}));
const calls = vi.hoisted(() => [] as { action: string; opts?: { allowToken?: boolean } }[]);
vi.mock("@/lib/session", () => ({
  requireMember: async (action: string, opts?: { allowToken?: boolean }) => {
    calls.push({ action, opts });
    if (!state.member) throw new AppError(401, "Sign in to continue.");
    if (action === "org:invite" && state.member.role === "viewer") {
      throw new AppError(403, "Your role doesn't allow this.");
    }
    return state.member;
  },
}));

let tokens: typeof import("./tokens/route");
let tokenById: typeof import("./tokens/[id]/route");
let invites: typeof import("./invites/route");
beforeAll(async () => {
  tokens = await import("./tokens/route");
  tokenById = await import("./tokens/[id]/route");
  invites = await import("./invites/route");
});

beforeEach(async () => {
  state.db = await testDb();
  const u = await makeUser(state.db);
  const orgId = await ensurePersonalOrg(state.db, u);
  state.member = { userId: u.id, orgId, role: "owner" };
});

const post = (body: unknown, url = "http://localhost/api/x") =>
  new Request(url, { method: "POST", body: JSON.stringify(body) });

test("creating a token returns it once and lists it without the secret", async () => {
  const res = await tokens.POST(post({ name: "laptop" }));
  expect(res.status).toBe(201);
  const created = await res.json();
  expect(created.token).toMatch(/^tg_/);
  const list = await (await tokens.GET()).json();
  expect(list).toHaveLength(1);
  expect(JSON.stringify(list)).not.toContain(created.token);
});

test("a token needs a name", async () => {
  const res = await tokens.POST(post({ name: "  " }));
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe("Give the token a name up to 60 characters.");
});

test("malformed JSON gets 400, not 500", async () => {
  const res = await tokens.POST(new Request("http://localhost/x", { method: "POST", body: "{" }));
  expect(res.status).toBe(400);
});

test("token creation is rate limited", async () => {
  for (let i = 0; i < 10; i++) expect((await tokens.POST(post({ name: `t${i}` }))).status).toBe(201);
  const res = await tokens.POST(post({ name: "one too many" }));
  expect(res.status).toBe(429);
});

test("revoking a token returns 204 and marks it revoked", async () => {
  const { id } = await (await tokens.POST(post({ name: "x" }))).json();
  const res = await tokenById.DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
  expect(res.status).toBe(204);
  const [t] = await (await tokens.GET()).json();
  expect(t.revokedAt).not.toBeNull();
});

test("signed-out requests get 401", async () => {
  state.member = null;
  expect((await tokens.GET()).status).toBe(401);
});

test("admins get an invite link on the request's own origin", async () => {
  const res = await invites.POST(post({ role: "analyst" }, "https://trustguard.example/api/invites"));
  expect(res.status).toBe(201);
  expect((await res.json()).url).toMatch(/^https:\/\/trustguard\.example\/invite\/[\w-]+$/);
});

test("invites cannot grant owner and viewers cannot invite", async () => {
  expect((await invites.POST(post({ role: "owner" }))).status).toBe(400);
  state.member = { ...state.member!, role: "viewer" };
  expect((await invites.POST(post({ role: "analyst" }))).status).toBe(403);
});

test("invite codes from the db layer are url-safe", async () => {
  const code = await createInvite(state.db, {
    orgId: state.member!.orgId,
    role: "viewer",
    createdBy: state.member!.userId,
    now: new Date(),
  });
  expect(code).toMatch(/^[\w-]+$/);
});

test("token and invite routes never accept API tokens", async () => {
  calls.length = 0;
  await tokens.GET();
  await tokens.POST(post({ name: "x" }));
  const { id } = await (await tokens.POST(post({ name: "y" }))).json();
  await tokenById.DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
  await invites.POST(post({ role: "viewer" }));
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every((c) => !c.opts?.allowToken)).toBe(true);
});

test("revoking with a malformed id is a 400, not a server error", async () => {
  const res = await tokenById.DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
    params: Promise.resolve({ id: "not-a-uuid" }),
  });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe("That token id isn't valid.");
});
