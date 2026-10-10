import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { acceptInvite, InviteError } from "@trustguard/db";
import { auth } from "@/auth";
import { db } from "@/db";
import { ORG_COOKIE } from "@/lib/session";

// Only messages we wrote ourselves are shown; anything else in ?error is ignored.
const KNOWN_ERRORS = new Set([
  "This invite link isn't valid.",
  "This invite has already been used.",
  "This invite has expired.",
]);

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
    (await cookies()).set(ORG_COOKIE, result.orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    redirect(result.status === "joined" ? "/?joined=1" : "/");
  }

  const shown = typeof error === "string" && KNOWN_ERRORS.has(error) ? error : null;
  return (
    <main>
      <h1>Join an org on TrustGuard</h1>
      {shown ? (
        <p role="alert">{shown}</p>
      ) : (
        <form action={join}>
          <p>You were invited to join an org. You&apos;ll be able to switch back to your own org at any time.</p>
          <button type="submit">Join</button>
        </form>
      )}
    </main>
  );
}
