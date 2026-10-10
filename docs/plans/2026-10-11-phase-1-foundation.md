# Phase 1: Foundation implementation plan

> Work through the tasks in order. Steps use checkboxes (`- [ ]`) for tracking. Every commit message is shown to the repo owner and approved before `git commit` runs.

**Goal:** a deployed, signed-in TrustGuard shell with the monorepo, shared contracts, the full database schema, orgs and roles, invites, API tokens, rate limiting, the shared intel cache and CI in place, so phase 2 can start adding intelligence sources.

**Architecture:** pnpm workspace. `packages/core` holds pure, deterministic logic and contracts. `packages/db` holds the Drizzle schema plus every function that touches the database, all org-scoped. `apps/web` is Next.js 16 with Auth.js. Packages are consumed as TypeScript source (no build step); Next transpiles them.

**Tech stack:** Node 24, pnpm 11, TypeScript (strict), Next.js 16.4, Tailwind CSS 4, Auth.js v5 (`next-auth@beta`), Drizzle ORM 0.45 with `postgres` driver, PGlite for tests, zod 4, Vitest.

**Spec:** [`docs/specs/2026-10-11-trustguard-design.md`](../specs/2026-10-11-trustguard-design.md)

## Global constraints

- Budget is $0. No paid service, no new dependency that needs one.
- Every org-owned row has `org_id`; every query on such rows goes through `packages/db` functions that take an `orgId`.
- API keys and secrets live only in env vars on the server. Never in client code, never in responses, never in git.
- Error responses never include raw exception text.
- `packages/core` makes no network calls and reads no clock; time is passed in as a `Date` argument.
- Roles: `owner`, `admin`, `analyst`, `viewer`.
- Sign-in: GitHub and Google OAuth only.
- Text everywhere (UI copy, docs, comments, commits) is plain and direct, no em dashes.
- UI screens are not styled until the design direction (Task 13) is approved by the owner.

## Review focus

1. **Messy URL input** (spaces, no scheme, `javascript:`, `ftp://`, IDN hosts, host with port and no scheme): normalized or rejected with a clear message, never crashes. Tests in Task 2.
2. **Concurrent requests hitting the rate limiter**: exactly `limit` requests allowed per window, never more. Test in Task 8.
3. **Last owner demoting or removing themselves**: refused with a clear message, org never ends up ownerless. Test in Task 5.
4. **Invite link reused, expired, or opened by an existing member**: refused or no-op with a clear message, no duplicate membership, no role escalation. Tests in Task 6.
5. **Pasted API token with surrounding whitespace, or a revoked token**: whitespace tolerated, revoked token rejected. Tests in Task 7.

## File map

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.js, .prettierrc, .env.example
packages/core/src/index.ts       re-exports
packages/core/src/url.ts         normalizeTarget
packages/core/src/types.ts       shared domain types
packages/core/src/schemas.ts     zod API contracts
packages/core/src/roles.ts       role checks
packages/db/src/schema.ts        every table
packages/db/src/client.ts        production client
packages/db/src/testing.ts       PGlite test database
packages/db/src/orgs.ts          personal org, members, roles
packages/db/src/invites.ts       invite links
packages/db/src/tokens.ts        API tokens
packages/db/src/rate-limit.ts    fixed-window limiter
packages/db/src/intel-cache.ts   shared source cache
packages/db/src/investigations.ts org-scoped investigation access
packages/db/drizzle/             generated SQL migrations
apps/web/                        Next.js app (env, auth, headers, errors, settings UI, API routes)
.github/workflows/ci.yml
docs/architecture.md, docs/environment.md, docs/decisions.md, docs/HANDOFF.md
```

---

### Task 1: Workspace scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/src/index.test.ts`

**Interfaces:**
- Produces: root scripts `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; package name `@trustguard/core`.

- [ ] **Step 1: Root files**

`package.json`:
```json
{
  "name": "trustguard",
  "private": true,
  "packageManager": "pnpm@11.25.0",
  "engines": { "node": ">=24" },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "format": "prettier --write ."
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

`.prettierrc`:
```json
{ "semi": true, "singleQuote": false, "printWidth": 100, "trailingComma": "all" }
```

- [ ] **Step 2: Install root dev tools**

Run: `pnpm add -Dw typescript eslint @eslint/js typescript-eslint prettier vitest`

`eslint.config.js`:
```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/drizzle/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
```
Add `"type": "module"` to the root `package.json`.

- [ ] **Step 3: core package with a smoke test**

`packages/core/package.json`:
```json
{
  "name": "@trustguard/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc -p .", "test": "vitest run" },
  "dependencies": { "zod": "^4.1.0" }
}
```
`packages/core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```
`packages/core/src/index.ts`:
```ts
export const CORE_VERSION = "0.1.0";
```
`packages/core/src/index.test.ts`:
```ts
import { expect, test } from "vitest";
import { CORE_VERSION } from "./index";

test("core loads", () => {
  expect(CORE_VERSION).toBe("0.1.0");
});
```

- [ ] **Step 4: Verify**

Run: `pnpm install && pnpm test && pnpm typecheck && pnpm lint`
Expected: 1 test passes, no type or lint errors.

- [ ] **Step 5: Commit** (show message to owner first)

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json eslint.config.js .prettierrc packages/core
git commit -m "chore: set up pnpm workspace with core package"
```

---

### Task 2: Target URL normalization

**Files:**
- Create: `packages/core/src/url.ts`, `packages/core/src/url.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `normalizeTarget(input: string): NormalizedTarget`, `type NormalizedTarget = { url: string; host: string; schemeProvided: boolean }`, `class TargetError extends Error`.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/url.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { normalizeTarget, TargetError } from "./url";

describe("normalizeTarget", () => {
  test("trims and keeps https", () => {
    expect(normalizeTarget("  https://Example.com/a  ")).toEqual({
      url: "https://example.com/a",
      host: "example.com",
      schemeProvided: true,
    });
  });
  test("adds http when no scheme is given", () => {
    const t = normalizeTarget("example.com/login");
    expect(t.url).toBe("http://example.com/login");
    expect(t.schemeProvided).toBe(false);
  });
  test("host with port and no scheme", () => {
    expect(normalizeTarget("example.com:8080/x").url).toBe("http://example.com:8080/x");
  });
  test("drops the fragment", () => {
    expect(normalizeTarget("https://example.com/#secret").url).toBe("https://example.com/");
  });
  test("converts IDN hosts to punycode", () => {
    expect(normalizeTarget("https://bücher.de").host).toBe("xn--bcher-kva.de");
  });
  test.each(["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "ftp://example.com"])(
    "rejects %s",
    (input) => {
      expect(() => normalizeTarget(input)).toThrow(TargetError);
    },
  );
  test("rejects empty input", () => {
    expect(() => normalizeTarget("   ")).toThrow("Enter a URL or domain.");
  });
  test("rejects over 2048 characters", () => {
    expect(() => normalizeTarget("https://a.com/" + "a".repeat(2048))).toThrow(TargetError);
  });
  test("rejects input with no host", () => {
    expect(() => normalizeTarget("http://")).toThrow(TargetError);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @trustguard/core test`
Expected: FAIL, cannot resolve `./url`.

- [ ] **Step 3: Implement**

`packages/core/src/url.ts`:
```ts
export type NormalizedTarget = { url: string; host: string; schemeProvided: boolean };

export class TargetError extends Error {}

const MAX_LENGTH = 2048;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const BLOCKED_SCHEME = /^(javascript|data|file|vbscript|blob|about|mailto):/i;

export function normalizeTarget(input: string): NormalizedTarget {
  const raw = input.trim();
  if (!raw) throw new TargetError("Enter a URL or domain.");
  if (raw.length > MAX_LENGTH) throw new TargetError(`URL is longer than ${MAX_LENGTH} characters.`);
  if (BLOCKED_SCHEME.test(raw)) throw new TargetError("Only http and https URLs can be scanned.");

  const schemeProvided = HAS_SCHEME.test(raw);
  let parsed: URL;
  try {
    parsed = new URL(schemeProvided ? raw : `http://${raw}`);
  } catch {
    throw new TargetError("That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TargetError("Only http and https URLs can be scanned.");
  }
  if (!parsed.hostname) throw new TargetError("The URL has no host.");
  parsed.hash = "";
  return { url: parsed.href, host: parsed.hostname, schemeProvided };
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from "./url";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @trustguard/core test`
Expected: all pass. If `http://` parses with an empty host on Node 24 it throws inside `new URL`, which is also a `TargetError`; both paths satisfy the test.

- [ ] **Step 5: Commit** (show message to owner first)

```bash
git add packages/core/src
git commit -m "feat(core): normalize and validate scan targets"
```

---

### Task 3: Shared types, API schemas and roles

**Files:**
- Create: `packages/core/src/types.ts`, `packages/core/src/schemas.ts`, `packages/core/src/schemas.test.ts`, `packages/core/src/roles.ts`, `packages/core/src/roles.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `normalizeTarget`, `TargetError` from Task 2.
- Produces: types `SourceId`, `SourceStatus`, `RiskLevel`, `Signal`, `SourceResult`, `InvestigationStatus`; schemas `createInvestigationInput`, `createInviteInput`, `createTokenInput`; `ROLES`, `type Role`, `type Action`, `can(role, action)`, `isRole(value)`.

- [ ] **Step 1: Types**

`packages/core/src/types.ts`:
```ts
export const SOURCE_IDS = [
  "local", "virustotal", "safebrowsing", "urlhaus", "rdap", "dns", "tls",
  "crtsh", "redirects", "page", "phishing", "visual",
] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export type SourceStatus = "queued" | "running" | "ok" | "unavailable" | "error";
export type RiskLevel = "SAFE" | "SUSPICIOUS" | "HIGH_RISK";
export type InvestigationStatus = "queued" | "running" | "complete" | "failed";

export type SourceResult<T = unknown> = {
  source: SourceId;
  status: SourceStatus;
  reason?: string; // why it is unavailable or errored, safe to show users
  startedAt?: string;
  finishedAt?: string;
  data?: T;
};

export type Signal = {
  id: string;
  category: string;
  points: number; // positive raises risk, negative lowers it
  source: SourceId;
  evidenceRef: string;
  summary: string;
};

export function levelFor(score: number): RiskLevel {
  if (score >= 70) return "HIGH_RISK";
  if (score >= 40) return "SUSPICIOUS";
  return "SAFE";
}
```

- [ ] **Step 2: Write failing tests for schemas and roles**

`packages/core/src/schemas.test.ts`:
```ts
import { expect, test } from "vitest";
import { createInvestigationInput, createInviteInput, createTokenInput } from "./schemas";
import { levelFor } from "./types";

test("investigation input normalizes the target", () => {
  const r = createInvestigationInput.parse({ target: " example.com " });
  expect(r.target.url).toBe("http://example.com/");
});
test("investigation input reports a readable error", () => {
  const r = createInvestigationInput.safeParse({ target: "javascript:alert(1)" });
  expect(r.success).toBe(false);
  expect(r.error?.issues[0]?.message).toBe("Only http and https URLs can be scanned.");
});
test("invites cannot grant owner", () => {
  expect(createInviteInput.safeParse({ role: "owner" }).success).toBe(false);
  expect(createInviteInput.parse({ role: "analyst" }).role).toBe("analyst");
});
test("token name is required and trimmed", () => {
  expect(createTokenInput.parse({ name: "  laptop  " }).name).toBe("laptop");
  expect(createTokenInput.safeParse({ name: "  " }).success).toBe(false);
});
test("level boundaries", () => {
  expect([0, 39, 40, 69, 70, 100].map(levelFor)).toEqual([
    "SAFE", "SAFE", "SUSPICIOUS", "SUSPICIOUS", "HIGH_RISK", "HIGH_RISK",
  ]);
});
```

`packages/core/src/roles.test.ts`:
```ts
import { expect, test } from "vitest";
import { can, isRole } from "./roles";

test("viewers read but do not create", () => {
  expect(can("viewer", "investigation:read")).toBe(true);
  expect(can("viewer", "investigation:create")).toBe(false);
});
test("analysts investigate but do not manage members", () => {
  expect(can("analyst", "investigation:create")).toBe(true);
  expect(can("analyst", "org:manageMembers")).toBe(false);
});
test("admins invite, only owners delete the org", () => {
  expect(can("admin", "org:invite")).toBe(true);
  expect(can("admin", "org:delete")).toBe(false);
  expect(can("owner", "org:delete")).toBe(true);
});
test("isRole", () => {
  expect(isRole("admin")).toBe(true);
  expect(isRole("root")).toBe(false);
});
```

- [ ] **Step 3: Run to see them fail**

Run: `pnpm --filter @trustguard/core test`
Expected: FAIL, missing `./schemas` and `./roles`.

- [ ] **Step 4: Implement**

`packages/core/src/schemas.ts`:
```ts
import { z } from "zod";
import { normalizeTarget, TargetError } from "./url";

export const targetSchema = z.string().transform((value, ctx) => {
  try {
    return normalizeTarget(value);
  } catch (e) {
    ctx.addIssue({ code: "custom", message: e instanceof TargetError ? e.message : "Invalid URL." });
    return z.NEVER;
  }
});

export const createInvestigationInput = z.object({ target: targetSchema });
export const createInviteInput = z.object({ role: z.enum(["admin", "analyst", "viewer"]) });
export const createTokenInput = z.object({ name: z.string().trim().min(1).max(60) });
```

`packages/core/src/roles.ts`:
```ts
export const ROLES = ["viewer", "analyst", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export type Action =
  | "investigation:read"
  | "investigation:create"
  | "watchlist:write"
  | "incident:write"
  | "org:invite"
  | "org:manageMembers"
  | "org:settings"
  | "org:delete";

const MIN_ROLE: Record<Action, Role> = {
  "investigation:read": "viewer",
  "investigation:create": "analyst",
  "watchlist:write": "analyst",
  "incident:write": "analyst",
  "org:invite": "admin",
  "org:manageMembers": "admin",
  "org:settings": "admin",
  "org:delete": "owner",
};

export function can(role: Role, action: Action): boolean {
  return ROLES.indexOf(role) >= ROLES.indexOf(MIN_ROLE[action]);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
```

`packages/core/src/index.ts`:
```ts
export const CORE_VERSION = "0.1.0";
export * from "./url";
export * from "./types";
export * from "./schemas";
export * from "./roles";
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @trustguard/core test && pnpm --filter @trustguard/core typecheck`
Expected: all pass.

- [ ] **Step 6: Commit** (show message to owner first)

```bash
git add packages/core/src
git commit -m "feat(core): add shared types, API schemas and role checks"
```

---

### Task 4: Database schema and test database

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`, `packages/db/src/schema.ts`, `packages/db/src/client.ts`, `packages/db/src/testing.ts`, `packages/db/src/index.ts`, `packages/db/src/schema.test.ts`, `packages/db/drizzle/*` (generated)

**Interfaces:**
- Produces: `type DB`, `createDb(url: string): DB`, `testDb(): Promise<DB>`, all table objects exported from `@trustguard/db/schema`.

- [ ] **Step 1: Package**

`packages/db/package.json`:
```json
{
  "name": "@trustguard/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./schema": "./src/schema.ts", "./testing": "./src/testing.ts" },
  "scripts": {
    "typecheck": "tsc -p .",
    "test": "vitest run",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate"
  }
}
```
Run: `pnpm --filter @trustguard/db add drizzle-orm postgres @trustguard/core@workspace:* && pnpm --filter @trustguard/db add -D drizzle-kit @electric-sql/pglite`

`packages/db/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "drizzle.config.ts"] }
```

`packages/db/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

- [ ] **Step 2: Schema**

`packages/db/src/schema.ts`:
```ts
import {
  boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

export const roleEnum = pgEnum("role", ["viewer", "analyst", "admin", "owner"]);

// Auth.js tables (names and columns follow @auth/drizzle-adapter)
export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// Orgs
export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  settings: jsonb("settings").notNull().default({}),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

export const invites = pgTable("invites", {
  code: text("code").primaryKey(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  createdBy: text("created_by").notNull().references(() => users.id),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  usedBy: text("used_by").references(() => users.id),
  createdAt: createdAt(),
});

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  hash: text("hash").notNull().unique(),
  lastUsedAt: ts("last_used_at"),
  revokedAt: ts("revoked_at"),
  createdAt: createdAt(),
});

// Investigations
export const investigations = pgTable(
  "investigations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id),
    targetUrl: text("target_url").notNull(),
    targetHost: text("target_host").notNull(),
    status: text("status").notNull().default("queued"),
    risk: integer("risk"),
    confidence: integer("confidence"),
    level: text("level"),
    scoringVersion: text("scoring_version"),
    dna: text("dna"),
    summary: jsonb("summary"),
    createdAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [index("investigations_org_created").on(t.orgId, t.createdAt)],
);

export const sourceResults = pgTable(
  "source_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    status: text("status").notNull(),
    reason: text("reason"),
    data: jsonb("data"),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [uniqueIndex("source_results_inv_source").on(t.investigationId, t.source)],
);

export const signals = pgTable("signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  investigationId: uuid("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
  signalId: text("signal_id").notNull(),
  category: text("category").notNull(),
  points: real("points").notNull(),
  source: text("source").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  summary: text("summary").notNull(),
});

export const snapshots = pgTable("snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  watchId: uuid("watch_id").references(() => watchlist.id, { onDelete: "cascade" }),
  investigationId: uuid("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

// Graph
export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // domain | ip | certificate | asn | dns_record | url
    value: text("value").notNull(),
    data: jsonb("data"),
    firstSeen: createdAt(),
  },
  (t) => [uniqueIndex("entities_org_kind_value").on(t.orgId, t.kind, t.value)],
);

export const edges = pgTable("edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  fromId: uuid("from_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  toId: uuid("to_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  investigationId: uuid("investigation_id").references(() => investigations.id, { onDelete: "set null" }),
});

// Monitoring and response
export const watchlist = pgTable("watchlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  targetUrl: text("target_url").notNull(),
  intervalHours: integer("interval_hours").notNull().default(24),
  active: boolean("active").notNull().default(true),
  nextRunAt: ts("next_run_at"),
  createdAt: createdAt(),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  watchId: uuid("watch_id").references(() => watchlist.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  readAt: ts("read_at"),
  createdAt: createdAt(),
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // domain | url
  value: text("value").notNull(),
  createdAt: createdAt(),
});

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  publicId: text("public_id").notNull().unique(), // TG-INC-YYYY-NNNNNN
  investigationId: uuid("investigation_id").references(() => investigations.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("OPEN"),
  target: text("target").notNull(),
  createdAt: createdAt(),
});

export const incidentEvents = pgTable("incident_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => users.id),
  kind: text("kind").notNull(),
  data: jsonb("data"),
  createdAt: createdAt(),
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  publicId: text("public_id").notNull().unique(), // TG-ART-YYYY-NNNNNN
  investigationId: uuid("investigation_id").notNull().references(() => investigations.id),
  canonical: text("canonical").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: createdAt(),
});

// Shared infrastructure
export const intelCache = pgTable(
  "intel_cache",
  {
    source: text("source").notNull(),
    key: text("key").notNull(),
    data: jsonb("data").notNull(),
    fetchedAt: ts("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.source, t.key] })],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull(),
});
```

- [ ] **Step 3: Clients**

`packages/db/src/client.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

// prepare: false is required by Supabase's transaction pooler
export function createDb(url: string): DB {
  return drizzle(postgres(url, { prepare: false, max: 5 }), { schema }) as unknown as DB;
}
```

`packages/db/src/testing.ts`:
```ts
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DB } from "./client";
import * as schema from "./schema";
import { users } from "./schema";

export async function testDb(): Promise<DB> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  return db as unknown as DB;
}

export async function makeUser(db: DB, name = "Test User") {
  const [u] = await db.insert(users).values({ name, email: `${crypto.randomUUID()}@test.local` }).returning();
  return u!;
}
```

`packages/db/src/index.ts`:
```ts
export * from "./client";
```

- [ ] **Step 4: Generate the first migration**

Run: `pnpm --filter @trustguard/db generate`
Expected: `packages/db/drizzle/0000_*.sql` and `meta/` created. `drizzle-kit generate` does not need a live database.

- [ ] **Step 5: Failing test that the schema migrates**

`packages/db/src/schema.test.ts`:
```ts
import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { testDb } from "./testing";

test("all tables exist after migrating", async () => {
  const db = await testDb();
  const rows = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables where table_schema = 'public'`,
  );
  const names = (rows as unknown as { rows: { table_name: string }[] }).rows.map((r) => r.table_name);
  for (const t of [
    "user", "account", "orgs", "memberships", "invites", "api_tokens", "investigations",
    "source_results", "signals", "snapshots", "entities", "edges", "watchlist", "alerts",
    "assets", "incidents", "incident_events", "artifacts", "intel_cache", "rate_limits",
  ]) {
    expect(names).toContain(t);
  }
});
```

- [ ] **Step 6: Run**

Run: `pnpm --filter @trustguard/db test && pnpm --filter @trustguard/db typecheck`
Expected: PASS. If the `execute` result shape differs between drivers, read `.rows` as shown; PGlite returns `{ rows }`.

- [ ] **Step 7: Commit** (show message to owner first)

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): add schema for all tables and PGlite test database"
```

---

### Task 5: Orgs, members and roles

**Files:**
- Create: `packages/db/src/orgs.ts`, `packages/db/src/orgs.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `DB`, `testDb`, `makeUser`, tables `orgs`, `memberships`; `Role` from core.
- Produces: `ensurePersonalOrg(db, user: { id: string; name: string | null }): Promise<string>`, `listMemberships(db, userId)`, `getRole(db, orgId, userId): Promise<Role | null>`, `setMemberRole(db, orgId, userId, role)`, `removeMember(db, orgId, userId)`, `class OrgRuleError extends Error`.

- [ ] **Step 1: Failing tests**

`packages/db/src/orgs.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import type { DB } from "./client";
import { testDb, makeUser } from "./testing";
import { ensurePersonalOrg, getRole, listMemberships, OrgRuleError, removeMember, setMemberRole } from "./orgs";
import { memberships } from "./schema";

let db: DB;
beforeEach(async () => { db = await testDb(); });

test("first sign-in creates a personal org with the user as owner", async () => {
  const u = await makeUser(db, "Asha");
  const orgId = await ensurePersonalOrg(db, u);
  expect(await getRole(db, orgId, u.id)).toBe("owner");
});

test("ensurePersonalOrg is idempotent", async () => {
  const u = await makeUser(db);
  const a = await ensurePersonalOrg(db, u);
  const b = await ensurePersonalOrg(db, u);
  expect(a).toBe(b);
  expect(await listMemberships(db, u.id)).toHaveLength(1);
});

test("the last owner cannot be demoted or removed", async () => {
  const u = await makeUser(db);
  const orgId = await ensurePersonalOrg(db, u);
  await expect(setMemberRole(db, orgId, u.id, "admin")).rejects.toThrow(OrgRuleError);
  await expect(removeMember(db, orgId, u.id)).rejects.toThrow(OrgRuleError);
});

test("an owner can step down once another owner exists", async () => {
  const a = await makeUser(db);
  const b = await makeUser(db);
  const orgId = await ensurePersonalOrg(db, a);
  await db.insert(memberships).values({ orgId, userId: b.id, role: "owner" });
  await setMemberRole(db, orgId, a.id, "admin");
  expect(await getRole(db, orgId, a.id)).toBe("admin");
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @trustguard/db test`
Expected: FAIL, missing `./orgs`.

- [ ] **Step 3: Implement**

`packages/db/src/orgs.ts`:
```ts
import { and, count, eq } from "drizzle-orm";
import type { Role } from "@trustguard/core";
import type { DB } from "./client";
import { memberships, orgs } from "./schema";

export class OrgRuleError extends Error {}

export async function listMemberships(db: DB, userId: string) {
  return db.select().from(memberships).where(eq(memberships.userId, userId));
}

export async function getRole(db: DB, orgId: string, userId: string): Promise<Role | null> {
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  return m?.role ?? null;
}

export async function ensurePersonalOrg(db: DB, user: { id: string; name: string | null }) {
  const existing = await listMemberships(db, user.id);
  if (existing[0]) return existing[0].orgId;
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(orgs)
      .values({ name: user.name ? `${user.name}'s org` : "My org" })
      .returning({ id: orgs.id });
    await tx.insert(memberships).values({ orgId: org!.id, userId: user.id, role: "owner" });
    return org!.id;
  });
}

async function ownerCount(db: DB, orgId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
  return r?.n ?? 0;
}

async function guardLastOwner(db: DB, orgId: string, userId: string) {
  if ((await getRole(db, orgId, userId)) === "owner" && (await ownerCount(db, orgId)) <= 1) {
    throw new OrgRuleError("An org needs at least one owner. Make someone else an owner first.");
  }
}

export async function setMemberRole(db: DB, orgId: string, userId: string, role: Role) {
  if (role !== "owner") await guardLastOwner(db, orgId, userId);
  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
}

export async function removeMember(db: DB, orgId: string, userId: string) {
  await guardLastOwner(db, orgId, userId);
  await db.delete(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
}
```

Append to `packages/db/src/index.ts`:
```ts
export * from "./orgs";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @trustguard/db test`
Expected: PASS.

- [ ] **Step 5: Commit** (show message to owner first)

```bash
git add packages/db/src
git commit -m "feat(db): add personal orgs, member roles and last-owner guard"
```

---

### Task 6: Invite links

**Files:**
- Create: `packages/db/src/invites.ts`, `packages/db/src/invites.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `getRole`, tables `invites`, `memberships`.
- Produces: `createInvite(db, { orgId, role, createdBy, now }): Promise<string>` (returns code), `acceptInvite(db, { code, userId, now }): Promise<{ status: "joined" | "already-member"; orgId: string }>`, `class InviteError extends Error`. Invites are single-use and expire after 7 days.

- [ ] **Step 1: Failing tests**

`packages/db/src/invites.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import type { DB } from "./client";
import { makeUser, testDb } from "./testing";
import { ensurePersonalOrg, getRole } from "./orgs";
import { acceptInvite, createInvite, InviteError } from "./invites";

let db: DB;
const now = new Date("2026-10-11T10:00:00Z");
const day = 86_400_000;
beforeEach(async () => { db = await testDb(); });

async function setup() {
  const owner = await makeUser(db, "Owner");
  const orgId = await ensurePersonalOrg(db, owner);
  const code = await createInvite(db, { orgId, role: "analyst", createdBy: owner.id, now });
  return { owner, orgId, code };
}

test("invite adds the user with the invited role", async () => {
  const { orgId, code } = await setup();
  const guest = await makeUser(db, "Guest");
  expect(await acceptInvite(db, { code, userId: guest.id, now })).toEqual({ status: "joined", orgId });
  expect(await getRole(db, orgId, guest.id)).toBe("analyst");
});

test("invites are single use", async () => {
  const { code } = await setup();
  await acceptInvite(db, { code, userId: (await makeUser(db)).id, now });
  await expect(acceptInvite(db, { code, userId: (await makeUser(db)).id, now })).rejects.toThrow(
    "This invite has already been used.",
  );
});

test("expired invites are refused", async () => {
  const { code } = await setup();
  const later = new Date(now.getTime() + 8 * day);
  await expect(acceptInvite(db, { code, userId: (await makeUser(db)).id, now: later })).rejects.toThrow(
    "This invite has expired.",
  );
});

test("existing members keep their role and the invite stays unused", async () => {
  const { owner, orgId, code } = await setup();
  expect(await acceptInvite(db, { code, userId: owner.id, now })).toEqual({ status: "already-member", orgId });
  expect(await getRole(db, orgId, owner.id)).toBe("owner");
  const guest = await makeUser(db);
  expect((await acceptInvite(db, { code, userId: guest.id, now })).status).toBe("joined");
});

test("unknown codes are refused", async () => {
  await expect(acceptInvite(db, { code: "nope", userId: "x", now })).rejects.toThrow(InviteError);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @trustguard/db test`
Expected: FAIL, missing `./invites`.

- [ ] **Step 3: Implement**

`packages/db/src/invites.ts`:
```ts
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Role } from "@trustguard/core";
import type { DB } from "./client";
import { getRole } from "./orgs";
import { invites, memberships } from "./schema";

export class InviteError extends Error {}

const TTL_MS = 7 * 86_400_000;

export async function createInvite(
  db: DB,
  o: { orgId: string; role: Exclude<Role, "owner">; createdBy: string; now: Date },
): Promise<string> {
  const code = randomBytes(18).toString("base64url");
  await db.insert(invites).values({
    code, orgId: o.orgId, role: o.role, createdBy: o.createdBy,
    expiresAt: new Date(o.now.getTime() + TTL_MS),
  });
  return code;
}

export async function acceptInvite(db: DB, o: { code: string; userId: string; now: Date }) {
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invites).where(eq(invites.code, o.code)).for("update");
    if (!inv) throw new InviteError("This invite link isn't valid.");
    if (inv.usedAt) throw new InviteError("This invite has already been used.");
    if (inv.expiresAt <= o.now) throw new InviteError("This invite has expired.");
    if (await getRole(tx as unknown as DB, inv.orgId, o.userId)) {
      return { status: "already-member" as const, orgId: inv.orgId };
    }
    await tx.insert(memberships).values({ orgId: inv.orgId, userId: o.userId, role: inv.role });
    await tx.update(invites).set({ usedAt: o.now, usedBy: o.userId }).where(eq(invites.code, o.code));
    return { status: "joined" as const, orgId: inv.orgId };
  });
}
```

Append to `packages/db/src/index.ts`:
```ts
export * from "./invites";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @trustguard/db test`
Expected: PASS.

- [ ] **Step 5: Commit** (show message to owner first)

```bash
git add packages/db/src
git commit -m "feat(db): add single-use expiring invite links"
```

---

### Task 7: API tokens

**Files:**
- Create: `packages/db/src/tokens.ts`, `packages/db/src/tokens.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Produces: `createToken(db, { userId, orgId, name }): Promise<{ id: string; token: string; prefix: string }>` (the plain token is returned once and never stored), `verifyToken(db, presented: string, now: Date): Promise<{ userId: string; orgId: string; tokenId: string } | null>`, `listTokens(db, userId)`, `revokeToken(db, { id, userId, now })`. Token format: `tg_` + 32 random bytes base64url. Stored as SHA-256 hex.

- [ ] **Step 1: Failing tests**

`packages/db/src/tokens.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import type { DB } from "./client";
import { makeUser, testDb } from "./testing";
import { ensurePersonalOrg } from "./orgs";
import { createToken, listTokens, revokeToken, verifyToken } from "./tokens";
import { apiTokens } from "./schema";

let db: DB;
const now = new Date("2026-10-11T10:00:00Z");
beforeEach(async () => { db = await testDb(); });

async function setup() {
  const u = await makeUser(db);
  const orgId = await ensurePersonalOrg(db, u);
  return { u, orgId, ...(await createToken(db, { userId: u.id, orgId, name: "laptop" })) };
}

test("a fresh token verifies, even with surrounding whitespace", async () => {
  const { u, orgId, token } = await setup();
  expect(token.startsWith("tg_")).toBe(true);
  expect(await verifyToken(db, `  ${token}\n`, now)).toMatchObject({ userId: u.id, orgId });
});

test("only the hash is stored", async () => {
  const { token } = await setup();
  const rows = await db.select().from(apiTokens);
  expect(JSON.stringify(rows)).not.toContain(token);
});

test("revoked tokens fail", async () => {
  const { u, id, token } = await setup();
  await revokeToken(db, { id, userId: u.id, now });
  expect(await verifyToken(db, token, now)).toBeNull();
});

test("users cannot revoke someone else's token", async () => {
  const { id, token } = await setup();
  const other = await makeUser(db);
  await revokeToken(db, { id, userId: other.id, now });
  expect(await verifyToken(db, token, now)).not.toBeNull();
});

test("unknown tokens fail and listing hides hashes", async () => {
  const { u } = await setup();
  expect(await verifyToken(db, "tg_wrong", now)).toBeNull();
  const list = await listTokens(db, u.id);
  expect(list[0]).not.toHaveProperty("hash");
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @trustguard/db test`
Expected: FAIL, missing `./tokens`.

- [ ] **Step 3: Implement**

`packages/db/src/tokens.ts`:
```ts
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "./client";
import { apiTokens } from "./schema";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createToken(db: DB, o: { userId: string; orgId: string; name: string }) {
  const token = `tg_${randomBytes(32).toString("base64url")}`;
  const prefix = token.slice(0, 10);
  const [row] = await db
    .insert(apiTokens)
    .values({ userId: o.userId, orgId: o.orgId, name: o.name, prefix, hash: sha256(token) })
    .returning({ id: apiTokens.id });
  return { id: row!.id, token, prefix };
}

export async function verifyToken(db: DB, presented: string, now: Date) {
  const [row] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId, orgId: apiTokens.orgId })
    .from(apiTokens)
    .where(and(eq(apiTokens.hash, sha256(presented.trim())), isNull(apiTokens.revokedAt)));
  if (!row) return null;
  await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.id));
  return { userId: row.userId, orgId: row.orgId, tokenId: row.id };
}

export async function listTokens(db: DB, userId: string) {
  return db
    .select({
      id: apiTokens.id, name: apiTokens.name, prefix: apiTokens.prefix,
      lastUsedAt: apiTokens.lastUsedAt, revokedAt: apiTokens.revokedAt, createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId));
}

export async function revokeToken(db: DB, o: { id: string; userId: string; now: Date }) {
  await db
    .update(apiTokens)
    .set({ revokedAt: o.now })
    .where(and(eq(apiTokens.id, o.id), eq(apiTokens.userId, o.userId)));
}
```

Append to `packages/db/src/index.ts`:
```ts
export * from "./tokens";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @trustguard/db test`
Expected: PASS.

- [ ] **Step 5: Commit** (show message to owner first)

```bash
git add packages/db/src
git commit -m "feat(db): add hashed, revocable API tokens"
```

---

### Task 8: Rate limiter

**Files:**
- Create: `packages/db/src/rate-limit.ts`, `packages/db/src/rate-limit.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Produces: `hit(db, { key, limit, windowMs, now }): Promise<{ allowed: boolean; remaining: number; resetAt: Date }>`. Fixed window, one atomic upsert per call.

- [ ] **Step 1: Failing tests**

`packages/db/src/rate-limit.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import type { DB } from "./client";
import { testDb } from "./testing";
import { hit } from "./rate-limit";

let db: DB;
const t0 = new Date("2026-10-11T10:00:00Z");
beforeEach(async () => { db = await testDb(); });

test("allows up to the limit, then refuses", async () => {
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await hit(db, { key: "u1", limit: 3, windowMs: 60_000, now: t0 }));
  expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
  expect(results[2]!.remaining).toBe(0);
});

test("a new window resets the count", async () => {
  for (let i = 0; i < 3; i++) await hit(db, { key: "u1", limit: 3, windowMs: 60_000, now: t0 });
  const next = new Date(t0.getTime() + 60_000);
  expect((await hit(db, { key: "u1", limit: 3, windowMs: 60_000, now: next })).allowed).toBe(true);
});

test("concurrent hits never exceed the limit", async () => {
  const rs = await Promise.all(
    Array.from({ length: 10 }, () => hit(db, { key: "burst", limit: 5, windowMs: 60_000, now: t0 })),
  );
  expect(rs.filter((r) => r.allowed)).toHaveLength(5);
});

test("keys are independent", async () => {
  await hit(db, { key: "a", limit: 1, windowMs: 60_000, now: t0 });
  expect((await hit(db, { key: "b", limit: 1, windowMs: 60_000, now: t0 })).allowed).toBe(true);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @trustguard/db test`
Expected: FAIL, missing `./rate-limit`.

- [ ] **Step 3: Implement**

`packages/db/src/rate-limit.ts`:
```ts
import { sql } from "drizzle-orm";
import type { DB } from "./client";
import { rateLimits } from "./schema";

export async function hit(db: DB, o: { key: string; limit: number; windowMs: number; now: Date }) {
  const windowStart = new Date(Math.floor(o.now.getTime() / o.windowMs) * o.windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key: o.key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} = excluded.window_start then ${rateLimits.count} + 1 else 1 end`,
        windowStart: sql`excluded.window_start`,
      },
    })
    .returning({ count: rateLimits.count });
  const used = row!.count;
  return {
    allowed: used <= o.limit,
    remaining: Math.max(0, o.limit - used),
    resetAt: new Date(windowStart.getTime() + o.windowMs),
  };
}
```

Append to `packages/db/src/index.ts`:
```ts
export * from "./rate-limit";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @trustguard/db test`
Expected: PASS.

- [ ] **Step 5: Commit** (show message to owner first)

```bash
git add packages/db/src
git commit -m "feat(db): add atomic fixed-window rate limiter"
```

---

### Task 9: Shared intel cache

**Files:**
- Create: `packages/db/src/intel-cache.ts`, `packages/db/src/intel-cache.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `SourceResult`, `SourceId` from core.
- Produces: `cached<T>(db, { source, key, ttlMs, now }, fetcher: () => Promise<SourceResult<T>>): Promise<SourceResult<T> & { cacheHit: boolean }>`. Only `ok` results are cached; `unavailable` and `error` are never cached so the next request retries.

- [ ] **Step 1: Failing tests**

`packages/db/src/intel-cache.test.ts`:
```ts
import { beforeEach, expect, test, vi } from "vitest";
import type { SourceResult } from "@trustguard/core";
import type { DB } from "./client";
import { testDb } from "./testing";
import { cached } from "./intel-cache";

let db: DB;
const t0 = new Date("2026-10-11T10:00:00Z");
const opts = { source: "rdap" as const, key: "example.com", ttlMs: 3_600_000 };
const ok: SourceResult<{ age: number }> = { source: "rdap", status: "ok", data: { age: 400 } };
beforeEach(async () => { db = await testDb(); });

test("second call within TTL skips the fetcher", async () => {
  const f = vi.fn().mockResolvedValue(ok);
  await cached(db, { ...opts, now: t0 }, f);
  const r = await cached(db, { ...opts, now: new Date(t0.getTime() + 1000) }, f);
  expect(f).toHaveBeenCalledTimes(1);
  expect(r).toMatchObject({ status: "ok", data: { age: 400 }, cacheHit: true });
});

test("expired entries are fetched again", async () => {
  const f = vi.fn().mockResolvedValue(ok);
  await cached(db, { ...opts, now: t0 }, f);
  await cached(db, { ...opts, now: new Date(t0.getTime() + opts.ttlMs + 1) }, f);
  expect(f).toHaveBeenCalledTimes(2);
});

test("unavailable results are not cached", async () => {
  const f = vi.fn().mockResolvedValue({ source: "rdap", status: "unavailable", reason: "timeout" });
  await cached(db, { ...opts, now: t0 }, f);
  await cached(db, { ...opts, now: t0 }, f);
  expect(f).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @trustguard/db test`
Expected: FAIL, missing `./intel-cache`.

- [ ] **Step 3: Implement**

`packages/db/src/intel-cache.ts`:
```ts
import { and, eq, gt } from "drizzle-orm";
import type { SourceId, SourceResult } from "@trustguard/core";
import type { DB } from "./client";
import { intelCache } from "./schema";

export async function cached<T>(
  db: DB,
  o: { source: SourceId; key: string; ttlMs: number; now: Date },
  fetcher: () => Promise<SourceResult<T>>,
): Promise<SourceResult<T> & { cacheHit: boolean }> {
  const fresh = new Date(o.now.getTime() - o.ttlMs);
  const [hit] = await db
    .select()
    .from(intelCache)
    .where(and(eq(intelCache.source, o.source), eq(intelCache.key, o.key), gt(intelCache.fetchedAt, fresh)));
  if (hit) return { ...(hit.data as SourceResult<T>), cacheHit: true };

  const result = await fetcher();
  if (result.status === "ok") {
    await db
      .insert(intelCache)
      .values({ source: o.source, key: o.key, data: result, fetchedAt: o.now })
      .onConflictDoUpdate({ target: [intelCache.source, intelCache.key], set: { data: result, fetchedAt: o.now } });
  }
  return { ...result, cacheHit: false };
}
```

Append to `packages/db/src/index.ts`:
```ts
export * from "./intel-cache";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @trustguard/db test`
Expected: PASS.

- [ ] **Step 5: Commit** (show message to owner first)

```bash
git add packages/db/src
git commit -m "feat(db): add shared intel cache that only stores successful results"
```

---

### Task 10: Org-scoped investigation access

**Files:**
- Create: `packages/db/src/investigations.ts`, `packages/db/src/investigations.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `NormalizedTarget` from core.
- Produces: `forOrg(db, orgId)` returning `{ investigations: { create(target: NormalizedTarget, createdBy: string), get(id: string), list(limit?: number) } }`. Every later phase adds its org-owned queries to this same `forOrg` object.

- [ ] **Step 1: Failing tests**

`packages/db/src/investigations.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { normalizeTarget } from "@trustguard/core";
import type { DB } from "./client";
import { makeUser, testDb } from "./testing";
import { ensurePersonalOrg } from "./orgs";
import { forOrg } from "./investigations";

let db: DB;
beforeEach(async () => { db = await testDb(); });

test("orgs only see their own investigations", async () => {
  const a = await makeUser(db, "A");
  const b = await makeUser(db, "B");
  const orgA = await ensurePersonalOrg(db, a);
  const orgB = await ensurePersonalOrg(db, b);

  const inv = await forOrg(db, orgA).investigations.create(normalizeTarget("example.com"), a.id);

  expect(await forOrg(db, orgA).investigations.get(inv.id)).not.toBeNull();
  expect(await forOrg(db, orgB).investigations.get(inv.id)).toBeNull();
  expect(await forOrg(db, orgB).investigations.list()).toHaveLength(0);
  expect(await forOrg(db, orgA).investigations.list()).toHaveLength(1);
});

test("create stores the normalized target", async () => {
  const u = await makeUser(db);
  const org = await ensurePersonalOrg(db, u);
  const inv = await forOrg(db, org).investigations.create(normalizeTarget(" Example.com/x "), u.id);
  expect(inv).toMatchObject({ targetUrl: "http://example.com/x", targetHost: "example.com", status: "queued" });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @trustguard/db test`
Expected: FAIL, missing `./investigations`.

- [ ] **Step 3: Implement**

`packages/db/src/investigations.ts`:
```ts
import { and, desc, eq } from "drizzle-orm";
import type { NormalizedTarget } from "@trustguard/core";
import type { DB } from "./client";
import { investigations } from "./schema";

// Every org-owned query lives behind forOrg so an org id can't be forgotten.
export function forOrg(db: DB, orgId: string) {
  return {
    investigations: {
      async create(target: NormalizedTarget, createdBy: string) {
        const [row] = await db
          .insert(investigations)
          .values({ orgId, createdBy, targetUrl: target.url, targetHost: target.host })
          .returning();
        return row!;
      },
      async get(id: string) {
        const [row] = await db
          .select()
          .from(investigations)
          .where(and(eq(investigations.id, id), eq(investigations.orgId, orgId)));
        return row ?? null;
      },
      async list(limit = 50) {
        return db
          .select()
          .from(investigations)
          .where(eq(investigations.orgId, orgId))
          .orderBy(desc(investigations.createdAt))
          .limit(limit);
      },
    },
  };
}
```

Append to `packages/db/src/index.ts`:
```ts
export * from "./investigations";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @trustguard/db test`
Expected: PASS.

- [ ] **Step 5: Commit** (show message to owner first)

```bash
git add packages/db/src
git commit -m "feat(db): add org-scoped investigation access"
```

---

### Task 11: Next.js app, env, security headers and safe errors

**Files:**
- Create: `apps/web/` (from create-next-app), `apps/web/src/env.ts`, `apps/web/src/lib/errors.ts`, `apps/web/src/lib/errors.test.ts`, `apps/web/src/lib/headers.ts`, `apps/web/src/lib/headers.test.ts`, `apps/web/src/db.ts`, `apps/web/src/app/api/health/route.ts`, `.env.example`
- Modify: `apps/web/next.config.ts`, `apps/web/package.json`

**Interfaces:**
- Consumes: `createDb` from `@trustguard/db`.
- Produces: `env` (validated), `db` singleton, `AppError(status, publicMessage)`, `errorResponse(err: unknown): Response`, `redact(text, secrets)`, `securityHeaders` array.

- [ ] **Step 1: Scaffold**

Run from repo root:
```bash
pnpm create next-app@16.4.0 apps/web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-turbopack --skip-install
pnpm --filter web add zod @trustguard/core@workspace:* @trustguard/db@workspace:*
pnpm --filter web add -D vitest
pnpm install
```
Rename the package in `apps/web/package.json` to `"name": "web"` if create-next-app named it differently, and add scripts `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`. Delete `apps/web/eslint.config.mjs` only if it conflicts with the root config; otherwise keep it.

- [ ] **Step 2: Failing tests for errors and headers**

`apps/web/src/lib/errors.test.ts`:
```ts
import { expect, test } from "vitest";
import { AppError, errorResponse, redact } from "./errors";

test("unknown errors never leak their message", async () => {
  const res = errorResponse(new Error("upstream said key=sk_live_123 is invalid"));
  expect(res.status).toBe(500);
  const body = await res.text();
  expect(body).not.toContain("sk_live_123");
  expect(JSON.parse(body).error).toBe("Something went wrong. Try again in a moment.");
});

test("AppError shows its public message and status", async () => {
  const res = errorResponse(new AppError(429, "Daily scan limit reached."));
  expect(res.status).toBe(429);
  expect((await res.json()).error).toBe("Daily scan limit reached.");
});

test("redact removes every secret", () => {
  expect(redact("a=SECRET1 b=SECRET2", ["SECRET1", "SECRET2", ""])).toBe("a=[redacted] b=[redacted]");
});
```

`apps/web/src/lib/headers.test.ts`:
```ts
import { expect, test } from "vitest";
import { securityHeaders } from "./headers";

const get = (k: string) => securityHeaders.find((h) => h.key === k)?.value;

test("sets the core security headers", () => {
  expect(get("X-Content-Type-Options")).toBe("nosniff");
  expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  expect(get("Strict-Transport-Security")).toContain("max-age=");
  expect(get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  expect(get("Content-Security-Policy")).toContain("default-src 'self'");
});
```

- [ ] **Step 3: Run to see them fail**

Run: `pnpm --filter web test`
Expected: FAIL, missing modules.

- [ ] **Step 4: Implement**

`apps/web/src/lib/errors.ts`:
```ts
export class AppError extends Error {
  constructor(public status: number, public publicMessage: string) {
    super(publicMessage);
  }
}

export function redact(text: string, secrets: string[]): string {
  return secrets.filter(Boolean).reduce((t, s) => t.split(s).join("[redacted]"), text);
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) return Response.json({ error: err.publicMessage }, { status: err.status });
  const id = crypto.randomUUID();
  console.error(`[${id}]`, err instanceof Error ? err.name : "UnknownError");
  return Response.json({ error: "Something went wrong. Try again in a moment.", id }, { status: 500 });
}
```

`apps/web/src/lib/headers.ts`:
```ts
const dev = process.env.NODE_ENV !== "production";

// ponytail: 'unsafe-inline' scripts until nonce-based CSP lands in phase 10 hardening
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
  "connect-src 'self'",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
];
```

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/headers";

const config: NextConfig = {
  transpilePackages: ["@trustguard/core", "@trustguard/db"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default config;
```

`apps/web/src/env.ts`:
```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_GITHUB_ID: z.string().min(1),
  AUTH_GITHUB_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Missing or invalid environment variables: ${missing}. See docs/environment.md.`);
}
export const env = parsed.data;
```

`apps/web/src/db.ts`:
```ts
import { createDb, type DB } from "@trustguard/db";
import { env } from "./env";

const g = globalThis as unknown as { __db?: DB };
export const db = g.__db ?? createDb(env.DATABASE_URL);
if (process.env.NODE_ENV !== "production") g.__db = db;
```

`apps/web/src/app/api/health/route.ts`:
```ts
export function GET() {
  return Response.json({ ok: true });
}
```

`.env.example` (repo root):
```
# Postgres connection string (Supabase transaction pooler, port 6543)
DATABASE_URL=
# 32+ random characters: openssl rand -base64 32
AUTH_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

- [ ] **Step 5: Run tests, typecheck and build**

Run: `pnpm --filter web test && pnpm --filter web typecheck && pnpm --filter web build`
Expected: tests pass. Build needs env vars; for a local build set placeholder values in `apps/web/.env.local` (gitignored). Build succeeds.

- [ ] **Step 6: Commit** (show message to owner first)

```bash
git add apps/web .env.example pnpm-lock.yaml
git commit -m "feat(web): scaffold Next.js app with env validation, security headers and safe errors"
```

---

### Task 12: Sign-in with GitHub and Google

**Files:**
- Create: `apps/web/src/auth.ts`, `apps/web/src/app/api/auth/[...nextauth]/route.ts`, `apps/web/src/lib/session.ts`, `apps/web/src/proxy.ts`, `apps/web/src/types/next-auth.d.ts`

**Interfaces:**
- Consumes: `db`, `ensurePersonalOrg`, `listMemberships`, `getRole`, `verifyToken`, `users`, `accounts`, `sessions`, `verificationTokens`.
- Produces: `auth()`, `signIn`, `signOut`, `requireMember(action: Action): Promise<{ userId: string; orgId: string; role: Role }>` (works with a session cookie or a `Bearer tg_...` token), cookie `tg_org` for the active org.

- [ ] **Step 1: Install**

Run: `pnpm --filter web add next-auth@beta @auth/drizzle-adapter`

- [ ] **Step 2: Auth config**

`apps/web/src/auth.ts`:
```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { ensurePersonalOrg } from "@trustguard/db";
import { accounts, sessions, users, verificationTokens } from "@trustguard/db/schema";
import { db } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [GitHub, Google],
  pages: { signIn: "/signin" },
  events: {
    async createUser({ user }) {
      await ensurePersonalOrg(db, { id: user.id!, name: user.name ?? null });
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      return session;
    },
  },
});
```
Auth.js reads `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` from env automatically.

`apps/web/src/types/next-auth.d.ts`:
```ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  }
}
```

`apps/web/src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Membership guard**

`apps/web/src/lib/session.ts`:
```ts
import { cookies, headers } from "next/headers";
import { can, type Action, type Role } from "@trustguard/core";
import { getRole, listMemberships, verifyToken } from "@trustguard/db";
import { auth } from "@/auth";
import { db } from "@/db";
import { AppError } from "./errors";

export async function requireMember(action: Action): Promise<{ userId: string; orgId: string; role: Role }> {
  const bearer = (await headers()).get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  let userId: string | undefined;
  let orgId: string | undefined;

  if (bearer) {
    const t = await verifyToken(db, bearer, new Date());
    if (!t) throw new AppError(401, "This API token is invalid or has been revoked.");
    userId = t.userId;
    orgId = t.orgId;
  } else {
    userId = (await auth())?.user?.id;
    if (!userId) throw new AppError(401, "Sign in to continue.");
    const wanted = (await cookies()).get("tg_org")?.value;
    const mine = await listMemberships(db, userId);
    orgId = mine.find((m) => m.orgId === wanted)?.orgId ?? mine[0]?.orgId;
  }

  const role = orgId ? await getRole(db, orgId, userId) : null;
  if (!orgId || !role) throw new AppError(403, "You're not a member of this org.");
  if (!can(role, action)) throw new AppError(403, "Your role doesn't allow this.");
  return { userId, orgId, role };
}
```

`apps/web/src/proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`):
```ts
export { auth as proxy } from "@/auth";

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|signin|invite|verify).*)"] };
```

- [ ] **Step 4: Minimal sign-in page (unstyled until Task 13)**

`apps/web/src/app/signin/page.tsx`:
```tsx
import { signIn } from "@/auth";

export default function SignIn() {
  return (
    <main>
      <h1>Sign in to TrustGuard</h1>
      <form action={async () => { "use server"; await signIn("github", { redirectTo: "/" }); }}>
        <button type="submit">Continue with GitHub</button>
      </form>
      <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
        <button type="submit">Continue with Google</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Verify locally**

Create GitHub and Google OAuth apps (owner step, see `docs/environment.md`) with callback `http://localhost:3000/api/auth/callback/github` and `.../google`. Put values in `apps/web/.env.local`. Run migrations against the Supabase database: `DATABASE_URL=... pnpm --filter @trustguard/db migrate`.

Run: `pnpm --filter web dev`, open `/`, get redirected to `/signin`, sign in with GitHub, land on `/`. Check in Supabase that a row exists in `orgs` and `memberships` with role `owner`. Sign out, sign in with Google using a different email, confirm a second personal org.

If the same email is used for both providers, Auth.js refuses with `OAuthAccountNotLinked`. Add `apps/web/src/app/signin/error` handling: show "This email is already linked to your other sign-in method. Use that one." when `searchParams.error === "OAuthAccountNotLinked"`.

- [ ] **Step 6: Commit** (show message to owner first)

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add GitHub and Google sign-in with personal orgs"
```

---

### Task 13: UI design direction (owner gate)

**Files:**
- Create: `docs/design.md`, `apps/web/src/app/globals.css` (theme tokens)

**Interfaces:**
- Produces: color, type, spacing and radius tokens in `globals.css` (Tailwind 4 `@theme`), documented in `docs/design.md`. Every later screen uses only these tokens.

- [ ] **Step 1: Run the design pass**

Work through the frontend design guidance and the high-end visual design pass before drawing anything. Inputs: SOC analysts and security-curious users, dark-first, dense data, risk states (SAFE / SUSPICIOUS / HIGH RISK) that must be readable at a glance and in both themes, plus the extension popup and warning page which share the same tokens.

- [ ] **Step 2: Show three real previews**

Build three single-screen previews of the same investigation result page (score, confidence, source timeline, top signals), each in a different direction. Share them with the owner.

- [ ] **Step 3: Owner picks one; record it**

Write the chosen tokens into `apps/web/src/app/globals.css` and the rationale into `docs/design.md` and `docs/decisions.md`.

- [ ] **Step 4: Verify**

Owner confirms in writing that the direction is approved. Mark status item P1.20.

- [ ] **Step 5: Commit** (show message to owner first)

```bash
git add docs/design.md docs/decisions.md apps/web/src/app/globals.css
git commit -m "feat(web): add approved design tokens"
```

---

### Task 14: Settings: members, invites and API tokens

**Files:**
- Create: `apps/web/src/app/api/tokens/route.ts`, `apps/web/src/app/api/tokens/[id]/route.ts`, `apps/web/src/app/api/invites/route.ts`, `apps/web/src/app/invite/[code]/page.tsx`, `apps/web/src/app/(app)/settings/page.tsx`, `apps/web/src/app/(app)/layout.tsx`, `apps/web/e2e/` is deferred to phase 10

**Interfaces:**
- Consumes: `requireMember`, `errorResponse`, `createToken`, `listTokens`, `revokeToken`, `createInvite`, `acceptInvite`, `hit`, `createTokenInput`, `createInviteInput`.
- Produces: `GET/POST /api/tokens`, `DELETE /api/tokens/:id`, `POST /api/invites` returning `{ url }`, page `/invite/:code`, page `/settings`.

- [ ] **Step 1: Token routes**

`apps/web/src/app/api/tokens/route.ts`:
```ts
import { createTokenInput } from "@trustguard/core";
import { createToken, hit, listTokens } from "@trustguard/db";
import { db } from "@/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireMember } from "@/lib/session";

export async function GET() {
  try {
    const m = await requireMember("investigation:read");
    return Response.json(await listTokens(db, m.userId));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const m = await requireMember("investigation:read");
    const rl = await hit(db, { key: `token-create:${m.userId}`, limit: 10, windowMs: 3_600_000, now: new Date() });
    if (!rl.allowed) throw new AppError(429, "Too many tokens created. Try again later.");
    const input = createTokenInput.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new AppError(400, "Give the token a name up to 60 characters.");
    const t = await createToken(db, { userId: m.userId, orgId: m.orgId, name: input.data.name });
    return Response.json(t, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`apps/web/src/app/api/tokens/[id]/route.ts`:
```ts
import { revokeToken } from "@trustguard/db";
import { db } from "@/db";
import { errorResponse } from "@/lib/errors";
import { requireMember } from "@/lib/session";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const m = await requireMember("investigation:read");
    await revokeToken(db, { id: (await ctx.params).id, userId: m.userId, now: new Date() });
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 2: Invite route and accept page**

`apps/web/src/app/api/invites/route.ts`:
```ts
import { createInviteInput } from "@trustguard/core";
import { createInvite } from "@trustguard/db";
import { db } from "@/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireMember } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const m = await requireMember("org:invite");
    const input = createInviteInput.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new AppError(400, "Pick a role: admin, analyst or viewer.");
    const code = await createInvite(db, { orgId: m.orgId, role: input.data.role, createdBy: m.userId, now: new Date() });
    return Response.json({ url: `${new URL(req.url).origin}/invite/${code}` }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`apps/web/src/app/invite/[code]/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { acceptInvite, InviteError } from "@trustguard/db";
import { auth } from "@/auth";
import { db } from "@/db";

export default async function Invite({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/invite/${code}`);
  let result;
  try {
    result = await acceptInvite(db, { code, userId: session.user.id, now: new Date() });
  } catch (e) {
    return <main><p>{e instanceof InviteError ? e.message : "Something went wrong."}</p></main>;
  }
  (await cookies()).set("tg_org", result.orgId, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  redirect(result.status === "joined" ? "/?joined=1" : "/");
}
```

- [ ] **Step 3: Settings page**

Build `/settings` with three sections using the approved tokens from Task 13: Members (list with role select and remove, calling server actions that use `setMemberRole` / `removeMember` and show `OrgRuleError` messages), Invite (role select, "Create invite link", copy button), API tokens (name input, "Create token" showing the token once with a copy button and the note "You won't see this again", list with revoke). Server actions call `requireMember("org:manageMembers")` before member changes.

- [ ] **Step 4: Verify by hand**

1. Create an invite as owner, open it in a private window signed in as a second account, land in the org as analyst.
2. Open the same link again with a third account: "This invite has already been used."
3. Try to demote yourself as the only owner: the error message shows, role unchanged.
4. Create a token, `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/tokens` returns the list. Revoke it, same call returns 401 with "This API token is invalid or has been revoked."

- [ ] **Step 5: Commit** (two commits, show each message to owner first)

```bash
git add apps/web/src/app/api
git commit -m "feat(web): add API routes for tokens and invites"
git add apps/web/src/app
git commit -m "feat(web): add settings page for members, invites and tokens"
```

---

### Task 15: CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm --filter web build
        env:
          DATABASE_URL: postgres://ci:ci@localhost:5432/ci
          AUTH_SECRET: ci-only-secret-ci-only-secret-ci-only
          AUTH_GITHUB_ID: ci
          AUTH_GITHUB_SECRET: ci
          AUTH_GOOGLE_ID: ci
          AUTH_GOOGLE_SECRET: ci

  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Verify**

Push, then run: `gh run watch` 
Expected: both jobs green. If the build step fails because a page queries the database at build time, mark that page `export const dynamic = "force-dynamic"`.

- [ ] **Step 3: Commit** (show message to owner first)

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run lint, typecheck, tests, build and secret scan"
```

---

### Task 16: Deploy and document

**Files:**
- Create: `docs/architecture.md`, `docs/environment.md`, `docs/decisions.md` (append), `docs/HANDOFF.md` (rewrite)

- [ ] **Step 1: Owner steps (cannot be automated)**

1. Supabase: create project, copy the transaction pooler connection string (port 6543).
2. Vercel: import the GitHub repo, root directory `apps/web`, add all env vars from `.env.example`.
3. Add production OAuth callback URLs on GitHub and Google: `https://<vercel-domain>/api/auth/callback/github` and `.../google`.
4. Run migrations once: `DATABASE_URL=<pooler url> pnpm --filter @trustguard/db migrate`.

- [ ] **Step 2: Docs**

`docs/environment.md`: every env var from `.env.example` with where to get it and which app reads it.
`docs/architecture.md`: package layout, the scan flow from the spec, and every API route so far (`/api/health`, `/api/auth/*`, `/api/tokens`, `/api/tokens/:id`, `/api/invites`) with method, auth requirement, input and output.

- [ ] **Step 3: Verify the deployment**

Open the Vercel URL, sign in with both providers, create an invite and a token. `curl -sI https://<vercel-domain>/` shows the CSP, HSTS and nosniff headers.

- [ ] **Step 4: Update tracking**

Check off P1.01 to P1.21 in `docs/status.html` (only those whose verification passed), republish the status page, rewrite `docs/HANDOFF.md`.

- [ ] **Step 5: Commit** (show message to owner first)

```bash
git add docs
git commit -m "docs: add architecture and environment docs for phase 1"
```
