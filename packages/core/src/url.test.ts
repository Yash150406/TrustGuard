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
