# Deployment

TrustGuard runs on free tiers only. This page covers how each piece is deployed. Environment variables and account setup are in [environment.md](environment.md).

| Piece | Where | Deploys from |
|---|---|---|
| Web app and API (`apps/web`) | Vercel, Hobby plan | Git push |
| Database | Supabase, free plan | Migrations run by hand |
| Analysis worker (`apps/worker`) | Oracle Cloud Always Free VM | Added in phase 2 |

## Web app on Vercel

The Vercel project is owned by the GitHub account that owns the repo, since Vercel can only import repos its GitHub app can see.

### Project settings

| Setting | Value |
|---|---|
| Root Directory | `apps/web` |
| Framework Preset | Next.js |
| Install / build commands | Vercel defaults. It installs from the repo root because of the pnpm workspace. |
| Node.js Version | 24.x |
| Production branch | `main` (see the note below) |

Environment variables: the six listed in [environment.md](environment.md), with a production `AUTH_SECRET` that is different from any local one. `AUTH_TRUST_HOST` is not needed on Vercel.

### Production branch during a phase

Work for each phase happens on a `phase-N` branch and only reaches `main` when the phase is done. Production tracks `main`; each `phase-N` branch gets Vercel preview deployments. Before phase 1 was merged, `main` didn't contain the app at all, so production temporarily tracked `phase-1` (Settings, Environments, Production, Branch Tracking) and was switched back to `main` after the merge.

Vercel's Root Directory picker on the import screen only lists folders that exist on the default branch. If the folder isn't on `main` yet, import with the default root, let the first build fail, then type `apps/web` into Settings, Build and Deployment, Root Directory, which accepts any path.

### OAuth callbacks

Production needs its own GitHub OAuth app, because a GitHub OAuth app takes a single callback URL:

- Homepage: `https://<production domain>`
- Callback: `https://<production domain>/api/auth/callback/github`

The Google client is shared with local development. Add the production domain as an authorized origin and `https://<production domain>/api/auth/callback/google` as a redirect URI.

## Database migrations

Migrations live in `packages/db/drizzle` and are applied by hand with the Supabase session pooler connection (port 5432), not the transaction pooler the app uses:

```powershell
cd packages/db
node --env-file=../../apps/web/.env.migrate ../../node_modules/.pnpm/node_modules/drizzle-kit/bin.cjs migrate
```

`apps/web/.env.migrate` holds a single `DATABASE_URL` line with the session pooler string and is gitignored. Run migrations before deploying code that depends on them.

Every table has row level security enabled with no policies (see issue #2). That keeps Supabase's REST API from reading anything, while the app, which connects as the table owner, is unaffected. New tables need RLS too; `packages/db/src/schema.test.ts` fails if one is missing.

## After deploying

- `https://<production domain>/api/health` returns `{"ok":true}`.
- `curl -sI https://<production domain>/` shows the Content-Security-Policy, Strict-Transport-Security and X-Content-Type-Options headers.
- Signing in with GitHub and with Google both land on the app.
