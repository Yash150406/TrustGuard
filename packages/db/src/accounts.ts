import { and, asc, eq } from "drizzle-orm";
import type { DB } from "./client";
import { accounts } from "./schema";

export class SignInMethodError extends Error {}

export async function listSignInMethods(db: DB, userId: string): Promise<string[]> {
  const rows = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.provider));
  return rows.map((r) => r.provider);
}

// Keeps at least one way to sign in so nobody can lock themselves out.
export async function unlinkSignInMethod(db: DB, userId: string, provider: string) {
  const methods = await listSignInMethods(db, userId);
  if (!methods.includes(provider)) {
    throw new SignInMethodError("That sign-in method isn't connected.");
  }
  if (methods.length <= 1) {
    throw new SignInMethodError("Connect another sign-in method before removing this one.");
  }
  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
}
