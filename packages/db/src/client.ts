import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

// prepare: false is required by the Supabase transaction pooler
export function createDb(url: string): DB {
  return drizzle(postgres(url, { prepare: false, max: 5 }), { schema }) as unknown as DB;
}
