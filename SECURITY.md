# Security policy

TrustGuard is a security tool, so bugs in it matter more than usual.

## Reporting a vulnerability

Please don't open a public issue for security problems. Use GitHub's private reporting instead: go to the **Security** tab of this repo and click **Report a vulnerability**.

Include what you found, how to reproduce it, and what an attacker could do with it. You should get a reply within a few days.

## In scope

- The web app and its API
- The analysis worker, especially sandbox escapes and SSRF
- The browser extension, especially anything that could read form values or leak browsing data
- Artifact hashing and verification

## Out of scope

- Findings that need a compromised device or browser
- Rate limits on third-party APIs that TrustGuard calls
- Risk scores you disagree with. Open a normal issue for those.
