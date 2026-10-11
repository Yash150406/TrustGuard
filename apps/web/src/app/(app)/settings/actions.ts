"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  canManageMember,
  createInviteInput,
  createTokenInput,
  idSchema,
  isRole,
  type Action,
} from "@trustguard/core";
import {
  createInvite,
  createToken,
  getRole,
  hit,
  OrgRuleError,
  removeMember,
  revokeToken,
  setMemberRole,
  SignInMethodError,
  unlinkSignInMethod,
} from "@trustguard/db";
import { signIn } from "@/auth";
import { db } from "@/db";
import { AppError } from "@/lib/errors";
import { requireMember } from "@/lib/session";

export type ActionState = { ok?: string; error?: string; url?: string; token?: string };

// Server actions return a message for the form instead of throwing, so the page
// can show it inline. Unknown errors never reach the client.
async function run(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError) return { error: e.publicMessage };
    if (e instanceof OrgRuleError || e instanceof SignInMethodError) return { error: e.message };
    console.error("settings action failed", e instanceof Error ? e.name : "UnknownError");
    return { error: "Something went wrong. Try again in a moment." };
  }
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

// Settings forms carry the org they were rendered for, so a stale tab can't act on
// whichever org another tab switched to.
async function memberFor(f: FormData, action: Action) {
  const orgId = str(f, "orgId");
  if (!orgId) throw new AppError(400, "Reload this page and try again.");
  return requireMember(action, { orgId });
}

async function guardMemberChange(f: FormData, userId: string, next?: string) {
  const me = await memberFor(f, "investigation:read");
  const target = await getRole(db, me.orgId, userId);
  if (!target) throw new AppError(404, "That person isn't in this org.");
  if (next !== undefined && !isRole(next)) throw new AppError(400, "Pick a valid role.");
  if (!canManageMember(me.role, target, next as Parameters<typeof canManageMember>[2])) {
    throw new AppError(403, "Only an owner can do that.");
  }
  return me;
}

export async function changeRole(_prev: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const userId = str(f, "userId");
    const role = str(f, "role");
    if (!isRole(role)) return { error: "Pick a valid role." };
    const me = await guardMemberChange(f, userId, role);
    await setMemberRole(db, me.orgId, userId, role);
    revalidatePath("/settings");
    return { ok: "Role updated." };
  });
}

export async function removeMemberAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const userId = str(f, "userId");
    const me = await guardMemberChange(f, userId);
    await removeMember(db, me.orgId, userId);
    revalidatePath("/settings");
    return { ok: "Member removed." };
  });
}

export async function createInviteAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const me = await memberFor(f, "org:invite");
    const input = createInviteInput.safeParse({ role: str(f, "role") });
    if (!input.success) return { error: "Pick a role: admin, analyst or viewer." };
    const origin = (await headers()).get("origin");
    if (!origin) return { error: "Couldn't work out this site's address. Reload and try again." };
    const code = await createInvite(db, {
      orgId: me.orgId,
      role: input.data.role,
      createdBy: me.userId,
      now: new Date(),
    });
    return { url: `${origin}/invite/${code}` };
  });
}

export async function createTokenAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const me = await memberFor(f, "investigation:read");
    const rl = await hit(db, {
      key: `token-create:${me.userId}`,
      limit: 10,
      windowMs: 3_600_000,
      now: new Date(),
    });
    if (!rl.allowed) return { error: "Too many tokens created. Try again later." };
    const input = createTokenInput.safeParse({ name: str(f, "name") });
    if (!input.success) return { error: "Give the token a name up to 60 characters." };
    const t = await createToken(db, { userId: me.userId, orgId: me.orgId, name: input.data.name });
    revalidatePath("/settings");
    return { token: t.token };
  });
}

export async function revokeTokenAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const me = await memberFor(f, "investigation:read");
    const id = idSchema.safeParse(str(f, "id"));
    if (!id.success) return { error: "That token id isn't valid." };
    await revokeToken(db, { id: id.data, userId: me.userId, now: new Date() });
    revalidatePath("/settings");
    return { ok: "Token revoked." };
  });
}

const PROVIDERS = { github: "GitHub", google: "Google" } as const;
type Provider = keyof typeof PROVIDERS;
const isProvider = (p: string): p is Provider => p in PROVIDERS;

// Signing in with another provider while already signed in links it to the
// current user (Auth.js account linking), so the same email check doesn't apply.
export async function connectSignInMethod(f: FormData) {
  const provider = str(f, "provider");
  if (!isProvider(provider)) return;
  await requireMember("investigation:read");
  await signIn(provider, { redirectTo: `/settings?connected=${provider}` });
}

export async function disconnectSignInMethod(_prev: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const provider = str(f, "provider");
    if (!isProvider(provider)) return { error: "Pick a sign-in method." };
    const me = await memberFor(f, "investigation:read");
    await unlinkSignInMethod(db, me.userId, provider);
    revalidatePath("/settings");
    return { ok: `${PROVIDERS[provider]} disconnected.` };
  });
}
