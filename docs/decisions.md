# Decisions

One entry per non-obvious decision, written when it is made.

## 2026-10-11: Design spec approved

**Decided:** the design in `docs/specs/2026-10-11-trustguard-design.md` is approved by the owner as the scope for V1.
**Why:** sign-off before any implementation starts.

## 2026-10-11: $0 hosting split across Vercel, Supabase and an Oracle VM

**Decided:** web app on Vercel Hobby, Postgres and file storage on Supabase free tier, analysis worker on an Oracle Cloud Always Free ARM VM.
**Why:** untrusted pages never run next to user data, and the dashboard stays up if the worker is down. A card on file for Oracle verification is allowed as long as it is never charged.
**Alternatives:** everything on the VM (single point of failure, no isolation), serverless only (timeouts and memory too tight for screenshots and OCR).

## 2026-10-11: Supabase instead of Neon

**Decided:** Supabase Postgres.
**Why:** the worker polls a pg-boss queue, which would burn Neon's free compute-hour cap. Supabase's free database stays on and includes 1 GB of file storage for screenshots and reports.
**Alternatives:** Neon (compute cap), Postgres on the VM (puts the dashboard's data on the box that runs untrusted pages).

## 2026-10-11: Worker has no public endpoint

**Decided:** the worker only makes outbound connections (to Postgres and to intelligence sources).
**Why:** nothing to expose, no domain or TLS setup on the VM, smaller attack surface.

## 2026-10-11: OAuth only, no email sign-in

**Decided:** GitHub and Google sign-in only.
**Why:** sending email to arbitrary addresses on a free tier needs a verified domain, which costs money.

## 2026-10-11: Extension on Edge Add-ons, not the Chrome Web Store

**Decided:** publish on Microsoft Edge Add-ons and attach an unpacked zip to GitHub releases.
**Why:** the Chrome Web Store has a $5 registration fee. Edge is Chromium, so the same MV3 build works.

## 2026-10-11: No LLM in explanations or the extension assistant

**Decided:** explanations are templates filled with real signals.
**Why:** costs nothing, is reproducible, and cannot invent evidence.

## 2026-10-11: Separate packages/db package

**Decided:** add `packages/db` (schema, client, every org-scoped query) next to `packages/core`.
**Why:** both the web app and the worker need the schema and the same queries. Keeping them out of `core` keeps `core` free of database and Node-only code, so the extension can bundle it.
**Alternatives:** schema inside `apps/web` (worker would import from an app), schema inside `core` (breaks the "pure and bundleable" rule).

## 2026-10-11: Plans written one phase at a time

**Decided:** `docs/plans/` gets one plan per roadmap phase, written just before that phase starts.
**Why:** later phases depend on code that doesn't exist yet. Writing their exact code now would go stale.
