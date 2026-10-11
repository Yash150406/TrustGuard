export type NormalizedTarget = { url: string; host: string; schemeProvided: boolean };

export class TargetError extends Error {}

const MAX_LENGTH = 2048;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const BLOCKED_SCHEME = /^(javascript|data|file|vbscript|blob|about|mailto):/i;

export function normalizeTarget(input: string): NormalizedTarget {
  const raw = input.trim();
  if (!raw) throw new TargetError("Enter a URL or domain.");
  if (raw.length > MAX_LENGTH) throw new TargetError(`URL is longer than ${MAX_LENGTH} characters.`);
  if (BLOCKED_SCHEME.test(raw)) throw new TargetError("Only http and https URLs can be scanned.");

  const schemeProvided = HAS_SCHEME.test(raw);
  let parsed: URL;
  try {
    parsed = new URL(schemeProvided ? raw : `http://${raw}`);
  } catch {
    throw new TargetError("That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TargetError("Only http and https URLs can be scanned.");
  }
  if (!parsed.hostname) throw new TargetError("The URL has no host.");
  parsed.hash = "";
  return { url: parsed.href, host: parsed.hostname, schemeProvided };
}
