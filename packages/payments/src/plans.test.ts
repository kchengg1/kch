import { describe, expect, it } from "vitest";
import { findPlan, findPlanByPriceId, type Plan } from "./plans";

const plans: Plan[] = [
  {
    id: "pro",
    name: "Pro",
    price: "$9",
    interval: "/mo",
    priceId: "price_1",
    mode: "subscription",
    features: [],
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: "$99",
    priceId: "price_2",
    mode: "payment",
    features: [],
  },
];

describe("plans", () => {
  it("finds by id", () => expect(findPlan(plans, "lifetime")?.mode).toBe("payment"));
  it("finds by price id", () => expect(findPlanByPriceId(plans, "price_1")?.id).toBe("pro"));
  it("returns undefined for unknown", () => expect(findPlan(plans, "nope")).toBeUndefined());
});
