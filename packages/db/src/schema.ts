import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

export const roleEnum = pgEnum("role", ["viewer", "analyst", "admin", "owner"]);

// Auth.js tables (names and columns follow @auth/drizzle-adapter)
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

export const invites = pgTable("invites", {
  code: text("code").primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  usedBy: text("used_by").references(() => users.id),
  createdAt: createdAt(),
});

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
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
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
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
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
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
  investigationId: uuid("investigation_id")
    .notNull()
    .references(() => investigations.id, { onDelete: "cascade" }),
  signalId: text("signal_id").notNull(),
  category: text("category").notNull(),
  points: real("points").notNull(),
  source: text("source").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  summary: text("summary").notNull(),
});

// Monitoring and response
export const watchlist = pgTable("watchlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  targetUrl: text("target_url").notNull(),
  intervalHours: integer("interval_hours").notNull().default(24),
  active: boolean("active").notNull().default(true),
  nextRunAt: ts("next_run_at"),
  createdAt: createdAt(),
});

export const snapshots = pgTable("snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  watchId: uuid("watch_id").references(() => watchlist.id, { onDelete: "cascade" }),
  investigationId: uuid("investigation_id")
    .notNull()
    .references(() => investigations.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  watchId: uuid("watch_id").references(() => watchlist.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  readAt: ts("read_at"),
  createdAt: createdAt(),
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // domain | url
  value: text("value").notNull(),
  createdAt: createdAt(),
});

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  publicId: text("public_id").notNull().unique(), // TG-INC-YYYY-NNNNNN
  investigationId: uuid("investigation_id").references(() => investigations.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("OPEN"),
  target: text("target").notNull(),
  createdAt: createdAt(),
});

export const incidentEvents = pgTable("incident_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id")
    .notNull()
    .references(() => incidents.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => users.id),
  kind: text("kind").notNull(),
  data: jsonb("data"),
  createdAt: createdAt(),
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  publicId: text("public_id").notNull().unique(), // TG-ART-YYYY-NNNNNN
  investigationId: uuid("investigation_id")
    .notNull()
    .references(() => investigations.id),
  canonical: text("canonical").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: createdAt(),
});

// Graph
export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // domain | ip | certificate | asn | dns_record | url
    value: text("value").notNull(),
    data: jsonb("data"),
    firstSeen: createdAt(),
  },
  (t) => [uniqueIndex("entities_org_kind_value").on(t.orgId, t.kind, t.value)],
);

export const edges = pgTable("edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  fromId: uuid("from_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  toId: uuid("to_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  investigationId: uuid("investigation_id").references(() => investigations.id, {
    onDelete: "set null",
  }),
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
