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
