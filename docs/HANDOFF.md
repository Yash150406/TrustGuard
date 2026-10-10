# Handoff

**Status:** phase 1 in progress, on branch `phase-1`. Tasks 1 to 14 of the phase 1 plan are built and tested (79 tests). Paused at the owner's request after the settings page.

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
- Task 15: CI workflow (lint, typecheck, test, build, gitleaks)
- Task 16: deploy to Vercel, `docs/architecture.md`, verify on the live site
- Manual checks that need real accounts: sign in with both providers, invite a second account, use a token with curl, run migrations on Supabase

## Waiting on the owner
- P0.09 Supabase project, P0.10 Vercel project, P0.12 GitHub and Google OAuth apps. Steps are in `docs/environment.md`.
- P0.08 Oracle VM, P0.11 API keys and P0.13 Edge account are needed from phase 2 and phase 7 on.

## Notes for the next session
- Work in plan order and finish phase 1 to 100% before writing the phase 2 plan.
- Commit approval is suspended for now; commit and push as each task passes.
- Visual check of the new screens in a browser is still to do once sign-in works.

## Next step
Phase 1, Task 15: CI workflow.
