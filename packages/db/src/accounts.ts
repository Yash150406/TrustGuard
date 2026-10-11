import { and, asc, eq } from "drizzle-orm";
import type { DB } from "./client";
import { accounts, users } from "./schema";

export class SignInMethodError extends Error {}

export async function getUser(db: DB, userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  return u ?? null;
}

export async function listSignInMethods(db: DB, userId: string): Promise<string[]> {
  const rows = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.provider));
  return rows.map((r) => r.provider);
}

// Keeps at least one way to sign in so nobody can lock themselves out. The user's
// account rows are locked first, so two disconnects at the same moment can't both
// see "two methods left" and remove both.
export async function unlinkSignInMethod(db: DB, userId: string, provider: string) {
  await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as DB;
    const rows = await tx
      .select({ provider: accounts.provider })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .for("update");
    if (!rows.some((r) => r.provider === provider)) {
      throw new SignInMethodError("That sign-in method isn't connected.");
    }
    if (rows.length <= 1) {
      throw new SignInMethodError("Connect another sign-in method before removing this one.");
    }
    await tx
      .delete(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
  });
}
