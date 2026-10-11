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
