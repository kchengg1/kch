import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
  it("drops falsy values", () => {
    const hidden = false as boolean;
    expect(cn("a", hidden && "b", undefined, "c")).toBe("a c");
  });
});
