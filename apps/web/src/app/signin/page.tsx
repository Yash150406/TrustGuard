import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { GitHubIcon, GoogleIcon } from "@/components/provider-icons";
import { safeRedirectPath } from "@/lib/redirect";

const MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already linked to your other sign-in method. Use that one instead.",
  AccessDenied: "Sign-in was cancelled or denied.",
};

export default async function SignIn({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const redirectTo = safeRedirectPath(
    typeof params.callbackUrl === "string" ? params.callbackUrl : undefined,
  );

  // A signed-in user only lands here when connecting another sign-in method failed.
  if ((await auth())?.user) redirect(error ? "/settings?link_error=1" : redirectTo);

  const btn =
    "flex w-full items-center justify-center gap-2.5 rounded-full bg-fg px-5 py-3 text-sm font-semibold text-bg transition-transform duration-300 ease-spring active:scale-[0.98]";
  return (
    <main className="risk-glow grid min-h-dvh place-items-center px-4">
      <div className="panel-shell w-full max-w-sm">
        <div className="panel-core grid gap-5 p-7">
          <div className="grid gap-1">
            <h1 className="font-display text-2xl font-light">Sign in to TrustGuard</h1>
            <p className="text-sm text-muted">Investigate suspicious links and domains with your team.</p>
          </div>
          {error && (
            <p role="alert" className="rounded-[var(--radius-chip)] border border-hair px-4 py-3 text-sm text-high">
              {MESSAGES[error] ?? "Sign-in failed. Try again."}
            </p>
          )}
          <div className="grid gap-2.5">
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo });
              }}
            >
              <button type="submit" className={btn}>
                <GitHubIcon />
                Continue with GitHub
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo });
              }}
            >
              <button type="submit" className={btn}>
                <GoogleIcon />
                Continue with Google
              </button>
            </form>
          </div>
          <p className="text-xs text-muted">A personal org is created for you on first sign-in.</p>
        </div>
      </div>
    </main>
  );
}
