import { describe, expect, it } from "vitest";
import { formatLastActive } from "./last-active";

const now = new Date("2026-11-16T12:00:00Z");

describe("formatLastActive", () => {
  it("handles missing or invalid timestamps", () => {
    expect(formatLastActive(null, now)).toBe("Not recorded yet");
    expect(formatLastActive("nope", now)).toBe("Not recorded yet");
  });
  it("formats ISO strings relative to now", () => {
    expect(formatLastActive("2026-11-16T11:59:00Z", now)).toBe("Just now");
    expect(formatLastActive("2026-11-16T07:00:00Z", now)).toBe("5 hours ago");
    expect(formatLastActive("2026-09-02T10:00:00Z", now)).toBe("Sep 2, 2026");
  });
});
