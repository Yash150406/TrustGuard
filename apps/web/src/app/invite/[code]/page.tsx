import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { acceptInvite, InviteError } from "@trustguard/db";
import { auth } from "@/auth";
import { db } from "@/db";
import { inviteErrorMessage } from "@/lib/invite-errors";
import { orgCookieOptions } from "@/lib/cookies";
import { ORG_COOKIE } from "@/lib/session";

// Joining needs a button press. Link previewers (Slack, mail scanners) fetch the page
// with GET, and a single-use invite would be gone before the person ever clicked it.
export default async function Invite({ params, searchParams }: PageProps<"/invite/[code]">) {
  const { code } = await params;
  const { error } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/invite/${encodeURIComponent(code)}`);

  async function join() {
    "use server";
    const userId = (await auth())?.user?.id;
    if (!userId) redirect(`/signin?callbackUrl=/invite/${encodeURIComponent(code)}`);
    let result;
    try {
      result = await acceptInvite(db, { code, userId, now: new Date() });
    } catch (e) {
      const message = e instanceof InviteError ? e.message : "Something went wrong.";
      redirect(`/invite/${encodeURIComponent(code)}?error=${encodeURIComponent(message)}`);
    }
    (await cookies()).set(ORG_COOKIE, result.orgId, orgCookieOptions());
    redirect(result.status === "joined" ? "/?joined=1" : "/");
  }

  const shown = inviteErrorMessage(typeof error === "string" ? error : undefined);
  return (
    <main className="risk-glow grid min-h-dvh place-items-center px-4">
      <div className="panel-shell w-full max-w-sm">
        <div className="panel-core grid gap-4 p-7">
          <h1 className="font-display text-2xl font-light">Join an org on TrustGuard</h1>
          {shown ? (
            <p role="alert" className="text-sm text-high">
              {shown}
            </p>
          ) : (
            <form action={join} className="grid gap-4">
              <p className="text-sm text-muted">
                You were invited to join an org. You can switch back to your own org at any time
                from the menu at the top.
              </p>
              <button
                type="submit"
                className="rounded-full bg-fg px-5 py-3 text-sm font-semibold text-bg transition-transform duration-300 ease-spring active:scale-[0.98]"
              >
                Join
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
