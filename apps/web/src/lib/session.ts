import { cookies, headers } from "next/headers";
import type { Action } from "@trustguard/core";
import { auth } from "@/auth";
import { db } from "@/db";
import { resolveMember, type Member } from "./membership";

export const ORG_COOKIE = "tg_org";

export async function requireMember(action: Action): Promise<Member> {
  const bearer = (await headers()).get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return resolveMember(db, {
    bearer,
    sessionUserId: bearer ? undefined : (await auth())?.user?.id,
    wantedOrgId: (await cookies()).get(ORG_COOKIE)?.value,
    action,
    now: new Date(),
  });
}
