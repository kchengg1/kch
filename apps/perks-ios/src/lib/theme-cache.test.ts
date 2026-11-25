import { describe, expect, it, vi } from "vitest";
import { getCachedThemedStyles } from "./theme-cache";

describe("getCachedThemedStyles", () => {
  it("computes each stylesheet factory only once per theme object", () => {
    const light = { bg: "#fff" };
    const dark = { bg: "#000" };
    const factory = vi.fn((c: { bg: string }) => ({ root: { backgroundColor: c.bg } }));

    const a = getCachedThemedStyles(light, factory);
    const b = getCachedThemedStyles(light, factory);
    expect(a).toBe(b);
    expect(factory).toHaveBeenCalledTimes(1);

    const c = getCachedThemedStyles(dark, factory);
    const d = getCachedThemedStyles(dark, factory);
    expect(c).toBe(d);
    expect(c).not.toBe(a);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("isolates distinct factories under the same theme object", () => {
    const light = { bg: "#fff" };
    const f1 = (c: { bg: string }) => ({ a: c.bg });
    const f2 = (c: { bg: string }) => ({ b: c.bg });

    expect(getCachedThemedStyles(light, f1)).toEqual({ a: "#fff" });
    expect(getCachedThemedStyles(light, f2)).toEqual({ b: "#fff" });
  });
});
