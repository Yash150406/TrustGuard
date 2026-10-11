import { beforeEach, expect, test } from "vitest";
import type { DB } from "./client";
import { makeUser, testDb } from "./testing";
import { listSignInMethods, SignInMethodError, unlinkSignInMethod } from "./accounts";
import { accounts } from "./schema";

let db: DB;
beforeEach(async () => {
  db = await testDb();
});

const link = (userId: string, provider: string) =>
  db.insert(accounts).values({
    userId,
    provider,
    type: "oauth",
    providerAccountId: `${provider}-${crypto.randomUUID()}`,
  });

test("lists the providers a user can sign in with", async () => {
  const u = await makeUser(db);
  await link(u.id, "google");
  await link(u.id, "github");
  expect(await listSignInMethods(db, u.id)).toEqual(["github", "google"]);
});

test("unlinking removes only that provider", async () => {
  const u = await makeUser(db);
  await link(u.id, "google");
  await link(u.id, "github");
  await unlinkSignInMethod(db, u.id, "github");
  expect(await listSignInMethods(db, u.id)).toEqual(["google"]);
});

test("the last sign-in method can't be removed", async () => {
  const u = await makeUser(db);
  await link(u.id, "google");
  await expect(unlinkSignInMethod(db, u.id, "google")).rejects.toThrow(SignInMethodError);
  expect(await listSignInMethods(db, u.id)).toEqual(["google"]);
});

test("unlinking never touches another user's accounts", async () => {
  const a = await makeUser(db);
  const b = await makeUser(db);
  await link(a.id, "google");
  await link(b.id, "google");
  await link(b.id, "github");
  await expect(unlinkSignInMethod(db, a.id, "github")).rejects.toThrow(SignInMethodError);
  expect(await listSignInMethods(db, b.id)).toEqual(["github", "google"]);
});
