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
