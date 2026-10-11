import { and, desc, eq } from "drizzle-orm";
import type { NormalizedTarget } from "@trustguard/core";
import type { DB } from "./client";
import { investigations } from "./schema";

// Every org-owned query lives behind forOrg so an org id can't be forgotten.
export function forOrg(db: DB, orgId: string) {
  return {
    investigations: {
      async create(target: NormalizedTarget, createdBy: string) {
        const [row] = await db
          .insert(investigations)
          .values({ orgId, createdBy, targetUrl: target.url, targetHost: target.host })
          .returning();
        return row!;
      },
      async get(id: string) {
        const [row] = await db
          .select()
          .from(investigations)
          .where(and(eq(investigations.id, id), eq(investigations.orgId, orgId)));
        return row ?? null;
      },
      async list(limit = 50) {
        return db
          .select()
          .from(investigations)
          .where(eq(investigations.orgId, orgId))
          .orderBy(desc(investigations.createdAt))
          .limit(limit);
      },
    },
  };
}
