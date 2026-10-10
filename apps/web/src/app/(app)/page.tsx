export default async function Home({ searchParams }: PageProps<"/">) {
  const { joined } = await searchParams;
  return (
    <div className="grid gap-4">
      {joined && (
        <p role="status" className="rounded-full border border-hair px-4 py-2 text-sm text-muted">
          You joined the org. Switch between orgs from the menu at the top.
        </p>
      )}
      <div className="panel-shell">
        <div className="panel-core grid gap-2 py-12 text-center">
          <h1 className="font-display text-2xl font-light">No investigations yet</h1>
          <p className="mx-auto max-w-md text-muted">
            Scanning arrives in the next phase. For now you can invite your team and create API
            tokens for the browser extension in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
