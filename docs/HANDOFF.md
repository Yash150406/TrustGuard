# Handoff

**Status:** phase 1 in progress, on branch `phase-1` (draft PR #1). Tasks 1 to 15 of the phase 1 plan are built and tested (79 tests), and CI runs on the PR.

**Maintainers:** Aniruddha More (lead: backend, infra, security, CI, deploy) and Yash More (UI, design, extension).

## Done in phase 1
- Monorepo: `packages/core`, `packages/db`, `apps/web`
- Target URL normalization, shared types, zod contracts, role checks (owner-only rules for the owner role)
- Full database schema and first migration, tested on in-memory Postgres
- Personal orgs, members, last-owner guard, invite links, hashed API tokens, rate limiter, shared intel cache, org-scoped investigation access
- Next.js app: env validation, security headers, safe error responses, `/api/health`
- GitHub and Google sign-in, membership guard for sessions and API tokens
- API routes for tokens and invites, invite page with an explicit Join step
- Design direction chosen (C for the app, B for PDF reports), tokens in `globals.css`, `docs/design.md`
- App shell with org switcher and sign-out, settings page for members, invites and API tokens
- Investigation assistant (RAG) added to the spec as phase 11

## Left in phase 1
- Task 16: deploy to Vercel, `docs/architecture.md`, verify on the live site
- Manual checks that need real accounts: sign in with both providers, invite a second account, use a token with curl, run migrations on Supabase

## Waiting on Aniruddha (accounts are registered under his GitHub and email)
- P0.09 Supabase project, P0.10 Vercel project, P0.12 GitHub and Google OAuth apps. Steps are in `docs/environment.md`.
- When importing into Vercel, Yash has to let the Vercel GitHub app access this repo, since his account owns it.
- P0.08 Oracle VM, P0.11 API keys and P0.13 Edge account are needed from phase 2 and phase 7 on.

## Notes for the next session
- CI also runs on every push to the PR. The "green on main" check (P1.19) completes when the PR is merged.
- Work in plan order and finish phase 1 to 100% before writing the phase 2 plan.
- Commit approval is suspended for now; commit and push as each task passes.
- Visual check of the new screens in a browser is still to do once sign-in works.

## Next step
Phase 1, Task 16: deploy and document, once the accounts above exist.
