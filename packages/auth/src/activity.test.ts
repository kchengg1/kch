import { describe, expect, it } from "vitest";
import { ACTIVITY_THROTTLE_MS, shouldTouch } from "./activity";

describe("shouldTouch", () => {
  it("writes when never touched", () => {
    expect(shouldTouch(undefined, 1_000)).toBe(true);
  });
  it("skips writes inside the throttle window", () => {
    expect(shouldTouch(1_000, 1_000 + ACTIVITY_THROTTLE_MS - 1)).toBe(false);
  });
  it("writes again once the window has passed", () => {
    expect(shouldTouch(1_000, 1_000 + ACTIVITY_THROTTLE_MS)).toBe(true);
  });
});
