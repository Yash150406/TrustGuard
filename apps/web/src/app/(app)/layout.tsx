import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyOrgs } from "@trustguard/db";
import { auth } from "@/auth";
import { db } from "@/db";
import { AppError } from "@/lib/errors";
import { requireMember } from "@/lib/session";
import { OrgSwitcher } from "./org-switcher";
import { signOutAction } from "./shell-actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  let me;
  try {
    me = await requireMember("investigation:read");
  } catch (e) {
    if (e instanceof AppError && e.status === 401) redirect("/signin");
    throw e;
  }
  const [orgs, session] = await Promise.all([listMyOrgs(db, me.userId), auth()]);

  return (
    <div className="risk-glow min-h-dvh">
      <header className="sticky top-4 z-10 mx-auto mt-4 w-fit max-w-[calc(100%-2rem)]">
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-full border border-hair bg-core/80 py-2 pr-2 pl-5 backdrop-blur-xl">
          <Link href="/" className="font-display text-[15px] font-medium tracking-tight">
            TrustGuard
          </Link>
          <Link href="/" className="text-sm text-muted transition-colors duration-300 ease-spring hover:text-fg">
            Investigations
          </Link>
          <Link href="/settings" className="text-sm text-muted transition-colors duration-300 ease-spring hover:text-fg">
            Settings
          </Link>
          <OrgSwitcher orgs={orgs} current={me.orgId} />
          <form action={signOutAction}>
            <button
              type="submit"
              title={session?.user?.email ?? undefined}
              className="rounded-full bg-fg px-4 py-1.5 text-sm font-semibold text-bg transition-transform duration-300 ease-spring active:scale-[0.97]"
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-24">{children}</main>
    </div>
  );
}
