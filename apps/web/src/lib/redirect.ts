// Turns a user-supplied callback URL into a same-site path, or "/" if it points anywhere else.
// Resolving against a fixed origin catches tricks a prefix check misses: "/\evil.com",
// "/\tevil.com" and "//evil.com" all resolve to a different host.
export function safeRedirectPath(target: string | undefined, origin = "http://app.invalid"): string {
  if (!target) return "/";
  let url: URL;
  try {
    url = new URL(target, origin);
  } catch {
    return "/";
  }
  if (url.origin !== new URL(origin).origin) return "/";
  const path = url.pathname + url.search + url.hash;
  // Encoded backslashes or doubled slashes could still be read as another host by something downstream.
  if (/\\|^\/\//.test(decodeURIComponent(url.pathname))) return "/";
  return path;
}
