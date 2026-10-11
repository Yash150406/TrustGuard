export { auth as proxy } from "@/auth";

// Everything except API routes, static files and the public pages needs a session.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|signin|invite|verify).*)"],
};
