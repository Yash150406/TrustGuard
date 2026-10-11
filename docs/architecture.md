# Architecture

How TrustGuard is put together and what each part exposes. The design and the reasons behind it are in [the spec](specs/2026-10-11-trustguard-design.md); decisions are logged in [decisions.md](decisions.md).

## Packages

```
apps/web         Next.js 16 app: pages, API routes, server actions, sign-in
apps/worker      analysis worker (phase 2)
apps/extension   browser extension (phase 7)
packages/core    pure logic and contracts: URL normalization, shared types, zod schemas, roles
packages/db      Drizzle schema, migrations and every database query
```

Dependencies only point one way: `apps/*` use `packages/db` and `packages/core`, `packages/db` uses `packages/core`, and `packages/core` uses nothing but zod. `core` makes no network calls and never reads the clock (time is passed in), so the extension can bundle it and its results are reproducible.

Packages are consumed as TypeScript source. Next.js compiles them through `transpilePackages`; there is no separate build step.

## Request flow today

```
browser ──> proxy.ts (session check) ──> page or server action ──> requireMember() ──> packages/db ──> Supabase Postgres
extension or script ──> /api/* with Bearer token ──> requireMember() ──> packages/db ──> Supabase Postgres
```

- `proxy.ts` redirects signed-out visitors to `/signin` for every page except `/signin`, `/invite/*` and the API.
- `requireMember(action, { allowToken })` (`apps/web/src/lib/session.ts`) works out who is calling and in which org, from the session cookie (dashboard) or, where the route allows it, a `Bearer tg_...` token (extension, scripts), then checks the role allows the action. It throws `AppError` with 401 or 403 otherwise. The logic lives in `resolveMember()` so it can be tested without Next.
- Every org-owned query goes through `packages/db` functions that take an `orgId`. `forOrg(db, orgId)` is the entry point for investigations and grows with each phase.

## Organizations and roles

Every piece of data belongs to an org. A personal org is created on first sign-in, and again if a signed-in user ever ends up with no org (for example, removed from their only one). People join others through invite links. The active org for the dashboard is the `tg_org` cookie, falling back to the user's oldest membership. Settings forms also send the org they were rendered for, and the server refuses the action if the active org has changed since (for example, another tab switched orgs). An API token is tied to the org it was created in.

| Role | Can |
|---|---|
| viewer | read investigations, reports, graphs |
| analyst | everything a viewer can, plus run investigations, edit the watchlist, handle incidents |
| admin | everything an analyst can, plus invite people, change roles below owner, edit org settings |
| owner | everything, including granting or removing the owner role and deleting the org |

An org always keeps at least one owner. Invite links can't grant the owner role. These rules live in `packages/core/src/roles.ts` and `packages/db/src/orgs.ts`.

## Sign-in

Auth.js v5 with GitHub and Google, JWT sessions, users and linked accounts stored through the Drizzle adapter.

- A first sign-in with a provider whose email already belongs to another account is refused (`OAuthAccountNotLinked`), so nobody can take over an account by adding its email to their own GitHub.
- While signed in, connecting the other provider from Settings links it to the current user. A sign-in method can be disconnected as long as another one remains.

## HTTP API

All responses are JSON. Errors look like `{ "error": "<message for people>" }`; unexpected errors return 500 with a generic message and an `id` for the logs, never the underlying exception text.

Authentication: a session cookie from the dashboard. API tokens (`Authorization: Bearer tg_<token>`) only work on routes that opt in with `requireMember(action, { allowToken: true })`; everything that manages the account (tokens, invites, members) is session-only, so a stolen token can't create more access. No route accepts tokens yet. The extension's endpoints will be the first, in later phases.

| Method | Path | Auth | Input | Success | Errors |
|---|---|---|---|---|---|
| GET | `/api/health` | none | none | `200 { "ok": true }` | none |
| GET, POST | `/api/auth/*` | none | Auth.js endpoints (sign-in, callback, session, csrf, providers, sign-out) | Auth.js responses | Auth.js errors |
| GET | `/api/tokens` | any member, session only | none | `200 [{ id, name, prefix, lastUsedAt, revokedAt, createdAt }]` for the caller's tokens. The token itself and its hash are never returned. | 401, 403 |
| POST | `/api/tokens` | any member, session only | `{ "name": string, 1-60 chars after trimming }` | `201 { id, token, prefix }`. `token` is shown only in this response. | 400 bad name or JSON, 401, 403, 429 after 10 tokens per user per hour |
| DELETE | `/api/tokens/:id` | any member, session only | none | `204`. Only the caller's own token is revoked. | 401, 403 |
| POST | `/api/invites` | admin or owner, session only | `{ "role": "admin" \| "analyst" \| "viewer" }` | `201 { "url": "<origin>/invite/<code>" }` | 400 bad role, 401, 403 |

Request bodies are validated with the zod schemas in `packages/core/src/schemas.ts`. Malformed JSON is a 400, not a 500.

## Server actions (dashboard only)

Settings uses server actions rather than API routes. Each returns `{ ok?, error?, url?, token? }` so the form can show the message inline.

| Action | Who | Does |
|---|---|---|
| `changeRole(userId, role)` | admin or owner, owner-only for anything touching the owner role | Changes a member's role; refuses to leave the org without an owner |
| `removeMemberAction(userId)` | same as above | Removes a member, same owner rule |
| `createInviteAction(role)` | admin or owner | Returns a single-use invite link that expires in 7 days |
| `createTokenAction(name)` | any member | Returns a new API token once |
| `revokeTokenAction(id)` | any member | Revokes one of the caller's tokens |
| `connectSignInMethod(provider)` | any member | Starts the GitHub or Google login and links it to the current user |
| `disconnectSignInMethod(provider)` | any member | Removes a sign-in method if another remains |
| `switchOrg(orgId)` | any member of that org | Sets the active org |
| `signOutAction()` | signed in | Clears the active org and signs out |

The invite page (`/invite/:code`) joins through a button that submits a server action, not on page load, so link previewers can't use up a single-use invite.

## Data

Schema: `packages/db/src/schema.ts`. Migrations: `packages/db/drizzle`. Every table has row level security on with no policies, which keeps Supabase's REST API out while the app (the table owner) has full access. Tables for later phases (investigations, signals, graph, watchlist, incidents, artifacts) already exist so the schema doesn't churn.

Shared, non-org data:

- `intel_cache`: raw responses from public sources, keyed by source and target, reused across orgs. Only successful results are stored.
- `rate_limits`: fixed-window counters, one atomic upsert per check.

## Security headers

Set in `apps/web/src/lib/headers.ts` for every response: Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy. The CSP still allows inline scripts; moving to nonces is part of phase 10 hardening.

## Testing

- `packages/core`: plain unit tests.
- `packages/db` and the web routes and actions: tests run against PGlite, an in-memory Postgres, with the real migrations applied. Each test gets a fresh clone of a migrated template database. Database test files run one at a time because each boots a WASM Postgres.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the web build on every PR and push to `main`, plus a gitleaks secret scan.
