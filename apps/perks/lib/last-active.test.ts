import { describe, expect, it } from "vitest";
import { formatLastActive } from "./last-active";

const now = new Date("2026-11-16T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("formatLastActive", () => {
  it("handles never-recorded users", () => {
    expect(formatLastActive(null, now)).toBe("Not recorded yet");
  });
  it("uses relative wording for recent activity", () => {
    expect(formatLastActive(ago(60_000), now)).toBe("Just now");
    expect(formatLastActive(ago(20 * 60_000), now)).toBe("20 minutes ago");
    expect(formatLastActive(ago(60 * 60_000), now)).toBe("1 hour ago");
    expect(formatLastActive(ago(5 * 3_600_000), now)).toBe("5 hours ago");
    expect(formatLastActive(ago(24 * 3_600_000), now)).toBe("1 day ago");
    expect(formatLastActive(ago(10 * 86_400_000), now)).toBe("10 days ago");
  });
  it("falls back to a date after a month", () => {
    expect(formatLastActive(new Date("2026-09-02T10:00:00Z"), now)).toBe("Sep 2, 2026");
  });
});
