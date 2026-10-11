import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Role } from "@trustguard/core";
import type { DB } from "./client";
import { getRole } from "./orgs";
import { invites, memberships } from "./schema";

export class InviteError extends Error {}

const TTL_MS = 7 * 86_400_000;

export async function createInvite(
  db: DB,
  o: { orgId: string; role: Exclude<Role, "owner">; createdBy: string; now: Date },
): Promise<string> {
  const code = randomBytes(18).toString("base64url");
  await db.insert(invites).values({
    code,
    orgId: o.orgId,
    role: o.role,
    createdBy: o.createdBy,
    expiresAt: new Date(o.now.getTime() + TTL_MS),
  });
  return code;
}

export async function acceptInvite(db: DB, o: { code: string; userId: string; now: Date }) {
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invites).where(eq(invites.code, o.code)).for("update");
    if (!inv) throw new InviteError("This invite link isn't valid.");
    if (inv.usedAt) throw new InviteError("This invite has already been used.");
    if (inv.expiresAt <= o.now) throw new InviteError("This invite has expired.");
    if (await getRole(tx as unknown as DB, inv.orgId, o.userId)) {
      return { status: "already-member" as const, orgId: inv.orgId };
    }
    await tx.insert(memberships).values({ orgId: inv.orgId, userId: o.userId, role: inv.role });
    await tx
      .update(invites)
      .set({ usedAt: o.now, usedBy: o.userId })
      .where(eq(invites.code, o.code));
    return { status: "joined" as const, orgId: inv.orgId };
  });
}
