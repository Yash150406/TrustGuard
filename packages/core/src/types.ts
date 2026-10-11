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
