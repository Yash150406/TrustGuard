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
        // Only a newer window starts a fresh count. A request whose clock is behind
        // (older window) still counts against the current one instead of resetting it.
        count: sql`case when excluded.window_start > ${rateLimits.windowStart} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`greatest(${rateLimits.windowStart}, excluded.window_start)`,
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
