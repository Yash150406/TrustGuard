import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DB } from "./client";
import * as schema from "./schema";
import { users } from "./schema";

// Migrate once per test worker, then hand each test its own clone. Replaying the
// migration for every test was slow enough to hit timeouts under parallel runs.
let template: Promise<PGlite> | undefined;

async function migratedTemplate() {
  const pg = new PGlite();
  await migrate(drizzle(pg, { schema }), {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  return pg;
}

export async function testDb(): Promise<DB> {
  template ??= migratedTemplate();
  const pg = (await (await template).clone()) as PGlite;
  return drizzle(pg, { schema }) as unknown as DB;
}

export async function makeUser(db: DB, name = "Test User") {
  const [u] = await db
    .insert(users)
    .values({ name, email: `${crypto.randomUUID()}@test.local` })
    .returning();
  return u!;
}
