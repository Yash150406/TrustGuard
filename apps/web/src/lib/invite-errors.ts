// The invite page only shows messages we wrote. Anything else in ?error is ignored.
const KNOWN: Record<string, string> = {
  "This invite link isn't valid.": "This invite link isn't valid. Ask whoever sent it for a new one.",
  "This invite has already been used.": "This invite has already been used. Ask whoever sent it for a new one.",
  "This invite has expired.": "This invite has expired. Ask whoever sent it for a new one.",
  "Something went wrong.": "Something went wrong. Try the link again.",
};

export function inviteErrorMessage(param: string | undefined): string | null {
  return (param && KNOWN[param]) || null;
}
