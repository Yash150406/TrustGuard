import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { testDb } from "./testing";

test("all tables exist after migrating", async () => {
  const db = await testDb();
  const rows = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables where table_schema = 'public'`,
  );
  const names = (rows as unknown as { rows: { table_name: string }[] }).rows.map((r) => r.table_name);
  for (const t of [
    "user", "account", "orgs", "memberships", "invites", "api_tokens", "investigations",
    "source_results", "signals", "snapshots", "entities", "edges", "watchlist", "alerts",
    "assets", "incidents", "incident_events", "artifacts", "intel_cache", "rate_limits",
  ]) {
    expect(names).toContain(t);
  }
});

// Supabase serves the public schema over its REST API with a public key.
// RLS with no policies blocks that API while the app's owner role bypasses it.
test("every public table has row level security enabled", async () => {
  const db = await testDb();
  const rows = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public' and rowsecurity = false`,
  );
  const open = (rows as unknown as { rows: { tablename: string }[] }).rows.map((r) => r.tablename);
  expect(open).toEqual([]);
});
