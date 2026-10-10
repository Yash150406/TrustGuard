import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DB } from "./client";
import * as schema from "./schema";
import { users } from "./schema";

export async function testDb(): Promise<DB> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  return db as unknown as DB;
}

export async function makeUser(db: DB, name = "Test User") {
  const [u] = await db
    .insert(users)
    .values({ name, email: `${crypto.randomUUID()}@test.local` })
    .returning();
  return u!;
}
