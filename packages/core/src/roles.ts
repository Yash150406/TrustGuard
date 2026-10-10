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
