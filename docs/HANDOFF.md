# Handoff

**Status:** phase 1 is complete and merged (PR #1). Production on Vercel serves `main` at https://usetrustguard.vercel.app. CI is green on `main` and 119 tests pass. Phase 2 hasn't started.

**Maintainers:** Aniruddha More (lead: backend, infra, security, CI, deploy) and Yash More (UI, design, extension). Each also takes some tasks in the other's area.

## Done in phase 1
- Monorepo with `packages/core`, `packages/db` and `apps/web`
- Database schema and migrations on Supabase, row level security on every table
- GitHub and Google sign-in, connect or disconnect either from Settings
- Orgs, roles, invite links, org switching, API tokens (session-only account routes), rate limiting, intel cache
- Settings page in the approved design (direction C), error page with sign-out
- CI, deployment on Vercel, `docs/architecture.md`, `docs/deployment.md`, `docs/environment.md`
- Independent review of the whole branch; all 15 bugs found during the phase (#2 to #16) fixed and closed with tests

## Before phase 2 starts (still open in phase 0)
- P0.08 Oracle Cloud Always Free account and ARM VM (the analysis worker runs there)
- P0.11 VirusTotal, Google Safe Browsing and URLhaus API keys
- P0.13 Microsoft Partner Center account for Edge Add-ons (free; needed by phase 7, but it's a phase 0 item)

## Notes for the next session
- Work in plan order; finish each phase to 100% before writing the next phase's plan.
- Commit approval is suspended; commit and push as each task passes. Split authorship per task with `git ca` (Aniruddha) and `git cy` (Yash).
- Every PR and issue gets labels, assignees, a reviewer and the phase milestone.
- Status items P2.36 and P7.28 check that the worker and extension use the shared types in `core`.

## Next step
Set up the three phase 0 accounts above, then write the phase 2 plan (scanner, reputation and scoring) on a new `phase-2` branch with a draft PR.
