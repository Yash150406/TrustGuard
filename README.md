# TrustGuard

TrustGuard investigates suspicious URLs and domains. It pulls evidence from several sources (URL structure, domain registration, DNS, TLS certificates, redirect chains, page behavior, screenshots and reputation feeds), correlates it, and produces a 0-100 risk score with a separate confidence score and a plain explanation of why. A Chromium extension uses the same engine to warn people before they open, click or paste a risky link.

> **Status:** in development. The design is done and implementation is starting. The full design is in [`docs/specs`](docs/specs/2026-10-11-trustguard-design.md).

## What it does

- **Investigations.** One click runs every source and shows a live timeline, then a single assessment with each signal's contribution to the score.
- **Risk and confidence.** Risk says how dangerous it looks, confidence says how much evidence backs that up. A source that fails is reported as unavailable, never as safe.
- **Threat graph.** Domains, IPs, certificates, ASNs and redirects drawn as an interactive graph.
- **Campaign matching.** Finds pages that share favicons, page structure, scripts or certificates.
- **Monitoring.** Watch a target and get alerted when its DNS, certificate, page or reputation changes, with a diff of what changed.
- **Incidents and reports.** Track incidents from open to resolved and export PDF reports.
- **Verifiable artifacts.** Each investigation can be saved as a canonical JSON record with a SHA-256 hash that anyone can check on a public verify page.
- **Browser extension.** Scans pages as you visit them, links as you click or hover, and links you copy. Warns on risky downloads and on password or card forms that submit somewhere suspicious, without ever reading what you type.

## Risk levels

| Score | Level | Meaning |
|---|---|---|
| 0-39 | SAFE | No significant risk signals found. Not a guarantee. |
| 40-69 | SUSPICIOUS | At least one meaningful indicator. Be careful. |
| 70-100 | HIGH RISK | Strong evidence. Avoid interacting. |

## Stack

| Part | Tech |
|---|---|
| Web app and API | Next.js 16, TypeScript, Tailwind CSS, Auth.js |
| Database and queue | PostgreSQL (Supabase), Drizzle ORM, pg-boss |
| Analysis worker | Node.js, Playwright, Tesseract, Docker |
| Extension | Chromium Manifest V3 |
| Shared engine | `packages/core`: scanner, scoring, URL DNA, canonical hashing |

Intelligence sources: VirusTotal, Google Safe Browsing, URLhaus, RDAP, crt.sh, Team Cymru, plus live DNS and TLS lookups.

## Repository layout

```
apps/web         dashboard, API, auth
apps/worker      analysis worker (runs untrusted pages in a sandbox)
apps/extension   browser extension
packages/core    shared types and the scoring engine
docs/            design spec, architecture, deployment notes
```

## Scope

TrustGuard is not a replacement for VirusTotal, an EDR, a SIEM or a browser sandbox. What it adds is the layer on top: combining different kinds of evidence, mapping how infrastructure connects, explaining the score, and tracking changes over time.

## License

[MIT](LICENSE)
