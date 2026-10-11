# TrustGuard design spec

Date: 2026-10-11
Status: approved design, pre-implementation

TrustGuard investigates URLs and domains, correlates evidence from several free intelligence sources, explains a 0-100 risk score with a separate confidence score, and protects users through a Chromium MV3 extension. This spec turns the product summary into concrete decisions. Anything not written here is out of scope until it is added here.

## 1. Goals and constraints

- Portfolio piece and a real tool people can use. Live public demo, clean public repo.
- Multi-tenant: anyone can sign up and gets their own organization.
- Budget is $0. No paid hosting, APIs, domains, store fees or email. A card on file for Oracle Cloud identity verification is allowed, never charged.
- Every free tier used is non-commercial (Vercel Hobby, VirusTotal public API, Safe Browsing). TrustGuard is never sold or monetized.
- Built from scratch. No existing code to reuse.

## 2. Architecture

```
Extension / Dashboard
        |
apps/web  (Next.js 16 on Vercel Hobby: UI, API routes, auth)
        |  writes investigations, enqueues jobs
Supabase Postgres (free) + Supabase Storage (free, 1 GB)
        |  worker pulls jobs (outbound connection only)
apps/worker  (Oracle Cloud Always Free ARM VM, Docker)
        |  runs sources, calls core, writes results
packages/core  (pure, deterministic: scanner, scoring, DNA, canonical hashing)
```

Repo layout, pnpm workspaces:

| Package | Role |
|---|---|
| `apps/web` | Next.js 16, TypeScript, Tailwind. Dashboard, REST API, Auth.js |
| `apps/worker` | Node, Playwright (Chromium), tesseract, pg-boss consumer, monitoring scheduler |
| `apps/extension` | MV3 extension, TypeScript, esbuild |
| `packages/core` | Shared types, zod schemas, URL scanner, risk and confidence engine, URL DNA, recommendations rules, explanation templates, RFC 8785 canonical JSON, SHA-256 |

`core` makes no network calls and reads no clock. Time is passed in. This is what makes "same evidence, same score" testable.

The worker has no public endpoint. It only connects out to Postgres and to intelligence sources. Supabase was chosen over Neon because a polling queue would burn Neon's free compute-hour cap.

### Scan flow

1. URL arrives from the dashboard or extension.
2. API validates (zod), normalizes the URL, checks quota and the shared intel cache.
3. Creates an `investigations` row and enqueues a pg-boss job.
4. Worker runs every source independently, each with its own timeout, each recorded as `ok`, `unavailable` (with reason) or `error`.
5. Worker passes normalized evidence to `core`, gets signals, risk, confidence, DNA, recommendations, explanation. Stores them.
6. Dashboard polls the investigation about once per second and renders the live timeline.
7. Extension reads the same result through a per-user API token.

## 3. Intelligence sources

All run on the worker. An unavailable source is never treated as safe and is never faked.

| Module | Implementation |
|---|---|
| URL scanner (5.1) | `core`: HTTP/HTTPS, IP host, `@` trick, subdomain depth, phishing keywords, length and structure, entropy, suspicious TLD list, encoded/obfuscated chars, punycode and homograph checks, suspicious ports and params, shortener list |
| VirusTotal (5.2) | Free API v3. Submit, poll until complete, read malicious/suspicious/harmless/undetected. Global DB token bucket keeps under 4/min and 500/day. 24 h cache. Quota exhausted shows `unavailable (quota)`. One source, never the final verdict |
| Google Safe Browsing | Lookup API v4, free key. Used by explicit investigations and extension auto-scans |
| URLhaus | abuse.ch API, free key |
| WHOIS (5.3) | RDAP via IANA bootstrap. Registration date, age, registrar, expiry, name servers |
| DNS (5.4) | Node `dns`: A, AAAA, MX, NS, TXT, CNAME. ASN and hosting via Team Cymru DNS lookups |
| TLS (5.5) | Node `tls`: issuer, validity, expiry, SAN/hostname match, certificate age, protocol and cipher. crt.sh for related certificates and domains |
| Redirects (5.6) | Manual HTTP hop-by-hop follow plus Playwright navigation events for JS and meta-refresh. Every hop stored with status, host and per-hop risk |
| Page behavior (5.7) | Playwright in a fresh context with an init script logging clipboard API use, permission requests (camera, mic, geolocation), `window.open`, downloads, forms and their actions, external scripts, iframes, `eval`/`atob`/long high-entropy strings |
| Phishing (5.8) | Urgency and verification language, credential harvesting indicators, curated list of about 200 brands with their official domains, brand/domain mismatch, login-page patterns |
| Visual (5.9) | Screenshot, tesseract OCR, brand and login-form detection from OCR text and DOM, perceptual hashing of favicon and screenshot against a reference set of real brand login pages. Visual phishing probability is a documented heuristic, not a trained model |

## 4. Risk, confidence and explanations

- Every finding becomes a signal: `id`, `category`, `points`, `evidenceRef`, `source`.
- Risk is the sum of points with a cap per category, clamped to 0-100.
- Floors: Safe Browsing hit, URLhaus hit, or 3+ VirusTotal malicious engines set risk to at least 70.
- HTTPS never lowers risk. Low VirusTotal detections alone never produce SAFE.
- Levels: SAFE 0-39, SUSPICIOUS 40-69, HIGH RISK 70-100.
- The points table is versioned (`scoringVersion`) and stored with each result. Same evidence and same version always give the same score.
- Confidence is separate: based on source coverage (which sources returned data, weighted) and agreement. Conflicts lower confidence and are named in the explanation.
- Explanations come from templates filled with real signals. No LLM here: the score explanation must be reproducible. The separate investigation assistant (section 15) answers follow-up questions.
- Financial exposure (5.16): per-org configurable values (credential compromise, payment fraud, business impact). Output is a low-high range scaled by risk, always labeled as an estimate.
- Recommendations (5.17): rule table from signals to user actions (credential warning, download warning) and org actions (block, investigate, watchlist), each linked to its evidence.

## 5. Accounts, orgs, quotas, data

- Auth.js with GitHub and Google OAuth only. No email login (sending to arbitrary addresses needs a paid domain).
- One sign-in method per email on first sign-in, so someone can't take over an account by adding its email to their own GitHub. Signed-in users can connect the other provider from Settings (linked to the current user) and disconnect one as long as another remains.
- Each user gets a personal org on signup. Invites are copyable links. Roles: owner, admin, analyst, viewer.
- Every org-owned table has `org_id`. All queries go through one data-access layer that requires an org id. Tests prove cross-org reads fail.
- Shared `intel_cache` holds raw public-source responses keyed by source and target. Investigations, watchlists, incidents and artifacts are private per org.
- Quotas: about 20 full investigations per user per day (configurable), cache hits free. Extension auto-scans never call VirusTotal. VirusTotal's 500/day is global and shown as unavailable when spent.
- Extension auth: per-user API token, stored hashed, revocable.
- Storage limits: screenshots compressed and kept 30 days unless referenced by an incident or artifact. Snapshots thinned over time. Admin page shows usage against free-tier limits.
- ORM: Drizzle with SQL migrations.
- Tables: `users`, `orgs`, `memberships`, `invites`, `api_tokens`, `investigations`, `source_results`, `signals`, `snapshots`, `entities`, `edges`, `watchlist`, `alerts`, `assets`, `incidents`, `incident_events`, `artifacts`, `intel_cache`, `rate_limits`, plus Auth.js tables.

## 6. Analyst features

- URL DNA (5.10): fixed-order tag string such as `TG1 · HTTPS · NEWDOM · RDR×3 · PHISH-KW · LOGIN · VT2` plus a deterministic color strip. Versioned.
- Correlation (5.11): cross-source evidence grouped by entity, corroborating and conflicting indicators highlighted.
- Threat graph (5.12): Cytoscape.js over `entities` and `edges`. Edge types `RESOLVES_TO`, `REDIRECTS_TO`, `HOSTED_ON`, `USES_CERTIFICATE`, `RELATED_TO`, `SHARES_FAVICON`, `SHARES_SCRIPT`. Clicking a node opens its intelligence and linked investigations.
- Campaign fingerprinting (5.13): favicon hash, DOM structure simhash, script set Jaccard, cert issuer and SAN overlap, IP/ASN. Weighted similarity 0-100. Compared within the org and against the brand reference set only.
- Investigation mode (5.18): one click runs all sources, live per-source timeline with timings, unified assessment.
- Monitoring (5.19): watch interval 1 h to 24 h, VirusTotal at most daily. Each run is a snapshot. Alerts in-app and via optional per-org Discord or Slack webhook.
- Security diff (5.20): forms, scripts, redirects, DNS, certificate, reputation and score between snapshots, with an explanation of why risk moved.
- Org dashboard (5.24): assets, domains, investigations, incidents, watchlist, users, risk overview with high-risk and suspicious counts.
- Incidents (5.25): IDs `TG-INC-YYYY-NNNNNN`, severity, target, indicators, evidence links, timeline, status OPEN, INVESTIGATING, CONTAINED, RESOLVED, recommended actions.
- PDF reports (5.26): @react-pdf on the server. Executive summary, score and confidence, domain intelligence, VirusTotal/DNS/TLS findings, redirect chain, visual analysis, graph summary, risk factors, recommendations, timeline.
- Security artifacts (5.27, section 10 of the summary): IDs `TG-ART-YYYY-NNNNNN`, created timestamp, schema version, target, risk and confidence, DNA, all source results, relationships, recommendations, timeline. RFC 8785 canonical JSON, SHA-256 via Node `crypto`. Viewer page and a public no-login verify page that recomputes the hash and shows VALID or MODIFIED, with the note that a hash proves integrity, not authorship.

## 7. Browser extension (MV3)

Parts: service worker (API, cache, badge, context menu, downloads), content script (clicks, copies, hover, forms), popup, warning page, options page.

| Feature | Behavior |
|---|---|
| Page scan + badge | Every top-level navigation checked via local `core` scanner, cache and Safe Browsing. Badge shows score, green/orange/red |
| Link click | Captured on every page. Monitor: link opens, warning follows. Protect/Strict: click held up to about 1 s for a verdict; HIGH RISK (and SUSPICIOUS in Strict) shows the warning page instead. Middle-click, Ctrl+click and new-tab opens checked before load |
| Copy | URLs extracted from text copied inside web pages and scanned, toast with result, recent list in popup. Only URLs leave the browser. Copies from password, card, CVV, OTP fields ignored |
| Paste & scan | Popup button, reads the clipboard once on user action, for links copied outside the browser. `clipboardRead` is an optional permission requested on first use |
| Popup | Score, confidence, top 3 reasons, DNA strip, recent copied links, open full investigation |
| Warning page | Go back, Investigate, Proceed anyway (allows that site for the session) |
| Hover | 400 ms debounce, small tooltip, session cache checked first |
| Context menu | Scan with TrustGuard on links, selection, page |
| Sensitive forms | Detects password, card, CVV, OTP fields by type, autocomplete and name. Never reads values. Checks submit destination and warns inline |
| Downloads | On start, checks filename/extension and source reputation. Risky downloads paused with Keep/Cancel notification |
| Security assistant | "Why?" panel explaining current-page findings with the shared templates. No LLM |
| Modes | Monitor, Protect, Strict |

Permissions: `storage`, `tabs`, `contextMenus`, `downloads`, `notifications`, `webNavigation`, all-sites host access; optional `clipboardRead`. The extension holds only the user's TrustGuard token, never intelligence keys.

Distribution: Microsoft Edge Add-ons (free) and unpacked zip on GitHub releases for Chrome, Brave, Opera. No Chrome Web Store ($5 fee).

## 8. Security

- Worker sandbox: fresh browser context per job, non-root container, read-only filesystem, CPU/memory limits, 45 s job kill.
- SSRF: every hostname resolved before any request, including each redirect hop and sub-resource. Private, loopback, link-local and metadata (`169.254.169.254`) addresses refused.
- Downloads never executed. Only name, size and SHA-256 recorded, then deleted.
- VM: no inbound ports except key-only SSH.
- Web: zod on every input, DB-backed rate limits, strict security headers and CSP, Auth.js session and CSRF protection, error messages sanitized so secrets never reach clients.
- Secrets only in Vercel env and the VM `.env`. Never committed. gitleaks in CI.

## 9. Testing

- `core`: scanner rules, scoring determinism, unavailable never yields SAFE, DNA, canonical JSON and SHA-256 golden vectors.
- API: org isolation, quotas, source failure does not crash an investigation.
- Sources: recorded fixtures, no live calls in CI.
- Dashboard: Playwright end-to-end for sign-in, investigate, report, artifact verify.
- Extension: unit tests for click, copy, form and download logic.

## 10. CI/CD and ops

- GitHub Actions on every push: lint, typecheck, test, build, gitleaks.
- Vercel deploys `apps/web`.
- Worker ARM image built in Actions, pushed to GHCR. VM pulls on a systemd timer, no inbound deploy.
- Tagged releases attach the extension zip.
- VM setup script kept in the repo so the box can be rebuilt quickly (Oracle may reclaim idle free VMs; monitoring jobs keep it active).

## 11. UI

Dashboard and website use direction C, "Signal room": near-black ground, two-layer machined panels (outer shell, inner core) in a bento grid, light hairlines, a ring gauge for the score, and one background glow tinted by the verdict. Dark first, with a light theme from the same tokens. Sora for display, Manrope for text, JetBrains Mono only for literal technical values (URLs, IPs, hashes). Tokens live in `apps/web/src/app/globals.css` and are documented in `docs/design.md`.

PDF reports use direction B, "Analyst report": a findings document on cool paper with a plain-language headline, a verdict seal, numbered findings, then the evidence. Newsreader headings, Public Sans text.

The extension popup and warning page use the direction C tokens.

## 12. Docs

`README.md`, `docs/architecture.md`, `docs/deployment.md`, `docs/environment.md`, `docs/testing-and-hardening.md`, `docs/decisions.md`, `docs/HANDOFF.md`, `docs/design.md`.

## 13. Completion tracking

`docs/status.html` is the ground truth checklist, published as a page and republished whenever an item is verified done. It lists every spec item, every Definition of Done item, every deliverable and every roadmap phase, each with how it is verified. The project is 100% complete only when every item is checked and its verification has passed.

## 14. Roadmap

| Phase | Scope |
|---|---|
| 1 | Monorepo, shared types, API contracts, validation, env config, Supabase schema, auth, orgs, CI |
| 2 | URL scanner, VirusTotal, Safe Browsing, URLhaus, RDAP, scoring engine, worker and queue |
| 3 | DNS, TLS, crt.sh, redirect intelligence, SSRF guard |
| 4 | Page behavior and phishing analysis, screenshots and OCR |
| 5 | URL DNA, correlation, confidence model, explanations, recommendations, financial estimate |
| 6 | Threat graph and campaign fingerprinting |
| 7 | Browser extension, all features in section 7, Edge submission |
| 8 | Monitoring, history, security diff, incidents, org dashboard, webhooks |
| 9 | Security artifacts, viewer, public verifier |
| 10 | PDF reports, UI polish, full test pass, security hardening, docs, deploy |
| 11 | Investigation assistant (RAG): retrieval over investigation evidence, grounded answers with citations |

## 15. Investigation assistant (planned, phase 11)

An "Ask about this result" panel on the investigation page (design approved as part of direction C). People ask follow-up questions in plain language; answers are built only from that investigation's stored evidence.

- Retrieval: the investigation's source results, signals, redirect chain, graph neighbors and linked incidents are chunked and embedded. Vectors stored with pgvector on the existing Supabase database (free tier).
- Grounding: every claim in an answer cites the source it came from (rendered as source chips). If the evidence doesn't cover the question, the assistant says so instead of guessing. It never invents intelligence results.
- Scope: an answer can only read the asking org's own data. Retrieval goes through the same org-scoped access layer as everything else.
- Limits: per-user daily question quota, and the assistant is shown as unavailable (never faked) when the model or quota is exhausted.
- Budget: must stay at $0. The model and embedding provider are chosen at the start of phase 11 from free options (for example a small open model served on the Oracle VM, or a free API tier), and the choice is logged in `docs/decisions.md`.
- The template-based score explanation (section 4) stays as is. The assistant adds Q&A on top of it, it doesn't replace it.
