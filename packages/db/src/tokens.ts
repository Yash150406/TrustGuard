import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "./client";
import { apiTokens } from "./schema";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createToken(db: DB, o: { userId: string; orgId: string; name: string }) {
  const token = `tg_${randomBytes(32).toString("base64url")}`;
  const prefix = token.slice(0, 10);
  const [row] = await db
    .insert(apiTokens)
    .values({ userId: o.userId, orgId: o.orgId, name: o.name, prefix, hash: sha256(token) })
    .returning({ id: apiTokens.id });
  return { id: row!.id, token, prefix };
}

export async function verifyToken(db: DB, presented: string, now: Date) {
  const [row] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId, orgId: apiTokens.orgId })
    .from(apiTokens)
    .where(and(eq(apiTokens.hash, sha256(presented.trim())), isNull(apiTokens.revokedAt)));
  if (!row) return null;
  await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.id));
  return { userId: row.userId, orgId: row.orgId, tokenId: row.id };
}

export async function listTokens(db: DB, userId: string) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      lastUsedAt: apiTokens.lastUsedAt,
      revokedAt: apiTokens.revokedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId));
}

export async function revokeToken(db: DB, o: { id: string; userId: string; now: Date }) {
  await db
    .update(apiTokens)
    .set({ revokedAt: o.now })
    .where(and(eq(apiTokens.id, o.id), eq(apiTokens.userId, o.userId)));
}
