import { expect, test } from "vitest";
import { inviteErrorMessage } from "./invite-errors";

test("known invite problems are shown", () => {
  expect(inviteErrorMessage("This invite has expired.")).toBe(
    "This invite has expired. Ask whoever sent it for a new one.",
  );
  expect(inviteErrorMessage("This invite has already been used.")).toBe(
    "This invite has already been used. Ask whoever sent it for a new one.",
  );
});

test("an unexpected failure is shown instead of silently showing the Join button again", () => {
  expect(inviteErrorMessage("Something went wrong.")).toBe("Something went wrong. Try the link again.");
});

test("text that we didn't write is never echoed back", () => {
  expect(inviteErrorMessage("<script>alert(1)</script>")).toBeNull();
  expect(inviteErrorMessage(undefined)).toBeNull();
});
