import { expect, test } from "vitest";
import { CORE_VERSION } from "./index";

test("core loads", () => {
  expect(CORE_VERSION).toBe("0.1.0");
});
