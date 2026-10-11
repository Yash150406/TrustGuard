// Options for the tg_org cookie. Secure only in production, so local testing over
// plain http (another device on the LAN, not just localhost) still keeps it.
export function orgCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
