import { can, canManageMember, ROLES, type Role } from "@trustguard/core";
import { getOrg, listMembers, listSignInMethods, listTokens } from "@trustguard/db";
import { db } from "@/db";
import { linkErrorMessage } from "@/lib/link-errors";
import { requireMember } from "@/lib/session";
import { InviteForm, MemberControls, RevokeButton, SignInMethods, TokenForm } from "./forms";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

const CONNECTED: Record<string, string> = { github: "GitHub connected.", google: "Google connected." };

export default async function Settings({ searchParams }: PageProps<"/settings">) {
  const { connected, link_error } = await searchParams;
  const me = await requireMember("investigation:read");
  const [org, members, tokens, methods] = await Promise.all([
    getOrg(db, me.orgId),
    listMembers(db, me.orgId),
    listTokens(db, me.userId),
    listSignInMethods(db, me.userId),
  ]);
  const notice = typeof connected === "string" ? CONNECTED[connected] : undefined;
  const linkError = linkErrorMessage(typeof link_error === "string" ? link_error : undefined);
  const canInvite = can(me.role, "org:invite");

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="font-display text-3xl font-light">Settings</h1>
        <p className="text-muted">
          {org?.name}. You&apos;re {me.role === "admin" || me.role === "analyst" ? "an" : "a"}{" "}
          {me.role} here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
        <section className="panel-shell md:col-span-7" aria-labelledby="members-h">
          <div className="panel-core">
            <h2 id="members-h" className="mb-3 font-display text-[15px] font-medium text-muted">
              Members
            </h2>
            <ul className="divide-y divide-hair">
              {members.map((m) => {
                const assignable = ROLES.filter(
                  (r) => r !== m.role && canManageMember(me.role, m.role, r),
                ) as Role[];
                return (
                  <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {m.name ?? m.email ?? "Unnamed"}
                        {m.userId === me.userId && <span className="font-normal text-muted"> (you)</span>}
                      </p>
                      <p className="truncate text-sm text-muted">{m.email}</p>
                    </div>
                    <MemberControls
                      orgId={me.orgId}
                      userId={m.userId}
                      role={m.role}
                      assignable={assignable}
                      canRemove={m.userId !== me.userId && canManageMember(me.role, m.role)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="panel-shell md:col-span-5" aria-labelledby="invite-h">
          <div className="panel-core grid grid-cols-1 content-start gap-3">
            <h2 id="invite-h" className="font-display text-[15px] font-medium text-muted">
              Invite someone
            </h2>
            {canInvite ? (
              <>
                <p className="text-sm text-muted">
                  Create a link and send it to them. They sign in, press Join and get the role you
                  picked.
                </p>
                <InviteForm orgId={me.orgId} />
              </>
            ) : (
              <p className="text-sm text-muted">Ask an admin or owner to invite people.</p>
            )}
          </div>
        </section>

        <section className="panel-shell md:col-span-7" aria-labelledby="tokens-h">
          <div className="panel-core grid grid-cols-1 gap-4">
            <div>
              <h2 id="tokens-h" className="font-display text-[15px] font-medium text-muted">
                API tokens
              </h2>
              <p className="text-sm text-muted">
                The browser extension uses a token to check links against your org. Each token is
                shown once. Revoke it if a device is lost.
              </p>
            </div>
            <TokenForm orgId={me.orgId} />
            {tokens.length > 0 && (
              <ul className="divide-y divide-hair">
                {tokens.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-sm text-muted">
                        <code className="font-mono text-[12.5px]">{t.prefix}…</code> · created{" "}
                        {dateFmt.format(t.createdAt)}
                        {t.lastUsedAt ? `, last used ${dateFmt.format(t.lastUsedAt)}` : ", never used"}
                      </p>
                    </div>
                    {t.revokedAt ? (
                      <span className="text-sm text-muted">Revoked {dateFmt.format(t.revokedAt)}</span>
                    ) : (
                      <RevokeButton orgId={me.orgId} id={t.id} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="panel-shell md:col-span-5" aria-labelledby="methods-h">
          <div className="panel-core grid grid-cols-1 content-start gap-2">
            <div>
              <h2 id="methods-h" className="font-display text-[15px] font-medium text-muted">
                Sign-in methods
              </h2>
              <p className="text-sm text-muted">
                Connect both to sign in with either one. You need at least one.
              </p>
            </div>
            {notice && <p role="status" className="text-sm text-safe">{notice}</p>}
            {linkError && (
              <p role="alert" className="text-sm text-high">
                {linkError}
              </p>
            )}
            <SignInMethods orgId={me.orgId} connected={methods} />
          </div>
        </section>
      </div>
    </div>
  );
}
