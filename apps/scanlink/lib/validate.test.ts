import { describe, expect, it } from "vitest";
import { generateSlug, isLikelyBot, normalizeUrl, shortenUrl } from "./validate";

describe("normalizeUrl", () => {
  it("adds https to bare domains", () => {
    expect(normalizeUrl("example.com/menu")).toBe("https://example.com/menu");
  });
  it("keeps http and https", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com/");
    expect(normalizeUrl(" https://example.com/a?b=1 ")).toBe("https://example.com/a?b=1");
  });
  it("rejects other schemes and junk", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("mailto:a@b.co")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("nodots")).toBeNull();
  });
  it("allows localhost for development", () => {
    expect(normalizeUrl("localhost:3000")).toBe("https://localhost:3000/");
  });
});

describe("generateSlug", () => {
  it("makes url-safe slugs of the requested length", () => {
    const slug = generateSlug(7);
    expect(slug).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(generateSlug(7)).not.toBe(slug);
  });
});

describe("isLikelyBot", () => {
  it("flags crawlers and link previews", () => {
    expect(isLikelyBot("facebookexternalhit/1.1")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isLikelyBot(null)).toBe(true);
  });
  it("passes real browsers", () => {
    expect(
      isLikelyBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });
});

describe("shortenUrl", () => {
  it("strips scheme and truncates", () => {
    expect(shortenUrl("https://example.com/")).toBe("example.com");
    expect(shortenUrl("https://example.com/" + "a".repeat(100), 20)).toHaveLength(20);
  });
});

describe("normalizeUrl ports", () => {
  it("treats host:port as a host, not a scheme", () => {
    expect(normalizeUrl("example.com:8080/menu")).toBe("https://example.com:8080/menu");
  });
});
