"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRole } from "@trustguard/db";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { ORG_COOKIE } from "@/lib/session";

export async function switchOrg(f: FormData) {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/signin");
  const orgId = String(f.get("orgId") ?? "");
  // Only switch to an org the user actually belongs to; anything else is ignored.
  if (await getRole(db, orgId, userId)) {
    (await cookies()).set(ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  }
  redirect("/");
}

export async function signOutAction() {
  (await cookies()).delete(ORG_COOKIE);
  await signOut({ redirectTo: "/signin" });
}
