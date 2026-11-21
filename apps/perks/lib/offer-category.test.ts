import { describe, expect, it } from "vitest";
import { isOfferCategory, OFFER_CATEGORIES, offerCategory } from "./offer-category";

describe("offerCategory", () => {
  it("categorizes travel merchants including hotels, airlines, transit and gas", () => {
    expect(offerCategory("Hyatt Essentials")).toBe("travel");
    expect(offerCategory("Hilton Garden Inn")).toBe("travel");
    expect(offerCategory("Emirates")).toBe("travel");
    expect(offerCategory("Lyft")).toBe("travel");
    expect(offerCategory("Turo")).toBe("travel");
    expect(offerCategory("Sunoco")).toBe("travel");
    expect(offerCategory("Mercedes-Benz High-Power Charging")).toBe("travel");
  });

  it("categorizes restaurants, meal delivery, groceries and wine as dining", () => {
    expect(offerCategory("Potbelly")).toBe("dining");
    expect(offerCategory("Tony's Pizza")).toBe("dining");
    expect(offerCategory("Meraki Greek Bistro Williamsburg")).toBe("dining");
    expect(offerCategory("Smashburger")).toBe("dining");
    expect(offerCategory("Uber Eats")).toBe("dining");
    expect(offerCategory("Blue Apron")).toBe("dining");
    expect(offerCategory("La Colombe")).toBe("dining");
    expect(offerCategory("Winc")).toBe("dining");
    expect(offerCategory("Sam's Club")).toBe("dining");
  });

  it("categorizes shopping, entertainment, health, home, and services", () => {
    expect(offerCategory("Lululemon")).toBe("shopping");
    expect(offerCategory("Sony Electronics")).toBe("shopping");
    expect(offerCategory("Pandora Jewelry")).toBe("shopping");

    expect(offerCategory("YouTube TV")).toBe("entertainment");
    expect(offerCategory("Disney+")).toBe("entertainment");
    expect(offerCategory("Event Tickets Center")).toBe("entertainment");
    expect(offerCategory("The Economist")).toBe("entertainment");

    expect(offerCategory("Tonal")).toBe("health");
    expect(offerCategory("Club Pilates")).toBe("health");
    expect(offerCategory("La Roche-Posay")).toBe("health");
    expect(offerCategory("AG1 - Foundational Nutrition Supplement")).toBe("health");

    expect(offerCategory("Mattress Firm")).toBe("home");
    expect(offerCategory("iRobot")).toBe("home");
    expect(offerCategory("The Farmer's Dog")).toBe("home");
    expect(offerCategory("Terminix")).toBe("home");

    expect(offerCategory("Visible by Verizon")).toBe("services");
    expect(offerCategory("Dropbox")).toBe("services");
    expect(offerCategory("LegalZoom - Personal & Business Legal Solutions")).toBe("services");
  });

  it("uses deal details when the merchant name is unfamiliar and falls back to other", () => {
    expect(offerCategory("Acme Co", "Spend $200 on a hotel stay, get $40 back")).toBe("travel");
    expect(offerCategory("Local Spot", "Spend $50 on dining, get $10 back")).toBe("dining");
    expect(offerCategory("Mystery Corp", "Spend $50, get $10 back")).toBe("other");
  });

  it("validates category ids against OFFER_CATEGORIES", () => {
    for (const c of OFFER_CATEGORIES) {
      expect(isOfferCategory(c.id)).toBe(true);
    }
    expect(isOfferCategory("bogus")).toBe(false);
    expect(isOfferCategory(undefined)).toBe(false);
  });
});
