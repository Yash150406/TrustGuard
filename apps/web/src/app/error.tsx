"use client";

import { signOutAction } from "./(app)/shell-actions";

// Last-resort screen for anything that breaks a page or the signed-in layout.
// It always offers a way out: try again, or sign out and start fresh.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const btn =
    "rounded-full px-5 py-2.5 text-sm font-semibold transition-transform duration-300 ease-spring active:scale-[0.98]";
  return (
    <main className="risk-glow grid min-h-dvh place-items-center px-4">
      <div className="panel-shell w-full max-w-sm">
        <div className="panel-core grid gap-4 p-7">
          <h1 className="font-display text-2xl font-light">Something went wrong</h1>
          <p className="text-sm text-muted">
            This page couldn&apos;t load. Try again, or sign out and back in.
            {error.digest && (
              <>
                {" "}
                Reference: <code className="font-mono text-[12.5px]">{error.digest}</code>
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={reset} className={`${btn} bg-fg text-bg`}>
              Try again
            </button>
            <form action={signOutAction}>
              <button type="submit" className={`${btn} border border-hair text-fg`}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
