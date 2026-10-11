import { and, eq, gt } from "drizzle-orm";
import type { SourceId, SourceResult } from "@trustguard/core";
import type { DB } from "./client";
import { intelCache } from "./schema";

// Shared across orgs: holds raw public-source responses only, never org data.
// Only ok results are stored so a failed source is retried on the next request.
export async function cached<T>(
  db: DB,
  o: { source: SourceId; key: string; ttlMs: number; now: Date },
  fetcher: () => Promise<SourceResult<T>>,
): Promise<SourceResult<T> & { cacheHit: boolean }> {
  const fresh = new Date(o.now.getTime() - o.ttlMs);
  const [hit] = await db
    .select()
    .from(intelCache)
    .where(
      and(
        eq(intelCache.source, o.source),
        eq(intelCache.key, o.key),
        gt(intelCache.fetchedAt, fresh),
      ),
    );
  if (hit) return { ...(hit.data as SourceResult<T>), cacheHit: true };

  const result = await fetcher();
  if (result.status === "ok") {
    await db
      .insert(intelCache)
      .values({ source: o.source, key: o.key, data: result, fetchedAt: o.now })
      .onConflictDoUpdate({
        target: [intelCache.source, intelCache.key],
        set: { data: result, fetchedAt: o.now },
      });
  }
  return { ...result, cacheHit: false };
}
