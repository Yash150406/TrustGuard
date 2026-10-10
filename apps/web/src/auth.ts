import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { ensurePersonalOrg } from "@trustguard/db";
import { accounts, sessions, users, verificationTokens } from "@trustguard/db/schema";
import { db } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [GitHub, Google],
  pages: { signIn: "/signin", error: "/signin" },
  events: {
    async createUser({ user }) {
      await ensurePersonalOrg(db, { id: user.id!, name: user.name ?? null });
    },
  },
  callbacks: {
    // Used by proxy.ts: pages it matches redirect to /signin without a session.
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      return session;
    },
  },
});
