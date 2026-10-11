// Messages for Settings when connecting another sign-in method fails.
// Codes are Auth.js error names passed through from /signin.
const MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That account is already used by another TrustGuard user. Sign in with it and remove it there first, or use a different account.",
  AccessDenied: "Connecting was cancelled. Nothing changed.",
};

export function linkErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? "Couldn't connect that account. Try again.";
}
