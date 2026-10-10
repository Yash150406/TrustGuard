import { and, asc, count, eq } from "drizzle-orm";
import type { Role } from "@trustguard/core";
import type { DB } from "./client";
import { memberships, orgs, users } from "./schema";

export class OrgRuleError extends Error {}

export async function listMemberships(db: DB, userId: string) {
  return db.select().from(memberships).where(eq(memberships.userId, userId));
}

export async function getOrg(db: DB, orgId: string) {
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId));
  return org ?? null;
}

export async function listMyOrgs(db: DB, userId: string) {
  return db
    .select({ orgId: orgs.id, name: orgs.name, role: memberships.role })
    .from(memberships)
    .innerJoin(orgs, eq(orgs.id, memberships.orgId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt));
}

export async function listMembers(db: DB, orgId: string) {
  return db
    .select({
      userId: memberships.userId,
      role: memberships.role,
      joinedAt: memberships.createdAt,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, orgId))
    .orderBy(asc(memberships.createdAt));
}

export async function getRole(db: DB, orgId: string, userId: string): Promise<Role | null> {
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  return m?.role ?? null;
}

export async function ensurePersonalOrg(db: DB, user: { id: string; name: string | null }) {
  const existing = await listMemberships(db, user.id);
  if (existing[0]) return existing[0].orgId;
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(orgs)
      .values({ name: user.name ? `${user.name}'s org` : "My org" })
      .returning({ id: orgs.id });
    await tx.insert(memberships).values({ orgId: org!.id, userId: user.id, role: "owner" });
    return org!.id;
  });
}

async function ownerCount(db: DB, orgId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
  return r?.n ?? 0;
}

// ponytail: check-then-write, two owners demoting each other at the same instant could both pass; lock the org row if that ever matters
async function guardLastOwner(db: DB, orgId: string, userId: string) {
  if ((await getRole(db, orgId, userId)) === "owner" && (await ownerCount(db, orgId)) <= 1) {
    throw new OrgRuleError("An org needs at least one owner. Make someone else an owner first.");
  }
}

export async function setMemberRole(db: DB, orgId: string, userId: string, role: Role) {
  if (role !== "owner") await guardLastOwner(db, orgId, userId);
  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
}

export async function removeMember(db: DB, orgId: string, userId: string) {
  await guardLastOwner(db, orgId, userId);
  await db
    .delete(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
}
