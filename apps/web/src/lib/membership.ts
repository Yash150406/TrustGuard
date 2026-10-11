import { can, type Action, type Role } from "@trustguard/core";
import { ensurePersonalOrg, getRole, getUser, listMemberships, verifyToken, type DB } from "@trustguard/db";
import { AppError } from "./errors";

export type Member = { userId: string; orgId: string; role: Role };

// Works for both callers: the extension (Bearer token, org fixed by the token)
// and the dashboard (session cookie, org picked via the tg_org cookie).
// Tokens only work where a route opts in with allowToken. Account actions (tokens,
// invites, members) stay session-only so a stolen token can't mint more access.
export async function resolveMember(
  db: DB,
  o: {
    bearer?: string;
    allowToken?: boolean;
    sessionUserId?: string;
    wantedOrgId?: string;
    // Set by forms that were rendered for a specific org. If the active org has
    // changed since (another tab switched it), the action is refused.
    requiredOrgId?: string;
    action: Action;
    now: Date;
  },
): Promise<Member> {
  let userId: string;
  let orgId: string | undefined;

  if (o.bearer && !o.allowToken) {
    throw new AppError(403, "API tokens can't be used for this. Sign in to TrustGuard instead.");
  }
  if (o.bearer) {
    const t = await verifyToken(db, o.bearer, o.now);
    if (!t) throw new AppError(401, "This API token is invalid or has been revoked.");
    userId = t.userId;
    orgId = t.orgId;
  } else {
    if (!o.sessionUserId) throw new AppError(401, "Sign in to continue.");
    userId = o.sessionUserId;
    const mine = await listMemberships(db, userId);
    orgId = mine.find((m) => m.orgId === o.wantedOrgId)?.orgId ?? mine[0]?.orgId;
    // Nobody should be signed in with nowhere to go: if the user lost their last org
    // (removed by another owner, or the first-sign-in setup failed), give them a new one.
    if (!orgId) {
      const user = await getUser(db, userId);
      if (!user) throw new AppError(401, "Sign in to continue.");
      orgId = await ensurePersonalOrg(db, { id: user.id, name: user.name });
    }
  }

  if (o.requiredOrgId && orgId !== o.requiredOrgId) {
    throw new AppError(409, "You switched orgs in another tab. Reload this page and try again.");
  }
  const role = orgId ? await getRole(db, orgId, userId) : null;
  if (!orgId || !role) throw new AppError(403, "You're not a member of this org.");
  if (!can(role, o.action)) throw new AppError(403, "Your role doesn't allow this.");
  return { userId, orgId, role };
}
