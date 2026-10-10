import { signIn } from "@/auth";

const MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already linked to your other sign-in method. Use that one instead.",
  AccessDenied: "Sign-in was cancelled or denied.",
};

export default async function SignIn({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/";
  const redirectTo = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";

  return (
    <main>
      <h1>Sign in to TrustGuard</h1>
      {error && <p role="alert">{MESSAGES[error] ?? "Sign-in failed. Try again."}</p>}
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo });
        }}
      >
        <button type="submit">Continue with GitHub</button>
      </form>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo });
        }}
      >
        <button type="submit">Continue with Google</button>
      </form>
    </main>
  );
}
