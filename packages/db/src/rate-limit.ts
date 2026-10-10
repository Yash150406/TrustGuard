import { sql } from "drizzle-orm";
import type { DB } from "./client";
import { rateLimits } from "./schema";

// Fixed window, one atomic upsert per call so concurrent requests can't overshoot.
export async function hit(db: DB, o: { key: string; limit: number; windowMs: number; now: Date }) {
  const windowStart = new Date(Math.floor(o.now.getTime() / o.windowMs) * o.windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key: o.key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} = excluded.window_start then ${rateLimits.count} + 1 else 1 end`,
        windowStart: sql`excluded.window_start`,
      },
    })
    .returning({ count: rateLimits.count });
  const used = row!.count;
  return {
    allowed: used <= o.limit,
    remaining: Math.max(0, o.limit - used),
    resetAt: new Date(windowStart.getTime() + o.windowMs),
  };
}
