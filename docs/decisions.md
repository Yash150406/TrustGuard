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

## 2026-10-12: Design directions

**Decided:** direction C ("Signal room", dark glass panels with a risk-tinted glow) for the app and website, direction B ("Analyst report", findings document) for PDF reports.
**Why:** owner's pick from three previews of the same investigation. C gives the product a distinct look; B reads well for people outside security and suits a printable report.
**Alternatives:** A ("Case file", dense dark workbench) was recommended for scan speed but not chosen.

## 2026-10-12: Investigation assistant (RAG) added as phase 11

**Decided:** add an "Ask about this result" assistant that answers questions from an investigation's own evidence, with citations. Design is approved now; it is built after phase 10.
**Why:** owner request. People want to ask follow-up questions in plain language.
**What changes:** this narrows the earlier "no LLM" decision. The score explanation stays template-based and reproducible. The assistant is a separate Q&A layer that must cite evidence, refuse when evidence is missing, stay inside the org's data and cost $0.
**Open:** model and embedding provider, chosen at the start of phase 11 from free options.

## 2026-10-13: Two maintainers

**Decided:** Aniruddha More (Aniruddha072) joins as a collaborator and project lead alongside Yash More. From now on commits are split by area: Aniruddha takes backend, infra, security, CI and deployment; Yash takes the UI, design and the browser extension. Earlier history is left as it is.
**Why:** both are working on the project, and the history should show who did which part.
**Also:** external accounts and API keys (Supabase, Vercel, OAuth apps, threat intel keys, Oracle, Edge Add-ons) are registered under Aniruddha's account.
