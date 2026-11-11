import type { Cadence } from "./periods";

/**
 * Built-in benefit templates for cards with recurring credits. Adding a card
 * from a template copies these rows into the database, where each one can be
 * edited, switched off or deleted. Issuers change benefits often: treat this
 * as a starting point and confirm against the card's own benefits page.
 */
export const CATALOG_REVIEWED = "2026-11-11";

export type TemplateBenefit = {
  name: string;
  cadence: Cadence;
  /** Dollars available per period. Omit for perks and reminders. */
  amount?: number;
  notes?: string;
  enroll?: boolean;
  /** Last day of a limited-time benefit. */
  endsOn?: string;
};

export type CardTemplate = {
  key: string;
  name: string;
  issuer: string;
  business: boolean;
  annualFee: number;
  /** Matches the names people give this card in spreadsheets. */
  match: RegExp;
  benefits: TemplateBenefit[];
};

const GLOBAL_ENTRY: TemplateBenefit = {
  name: "Global Entry / TSA PreCheck fee credit",
  cadence: "quadrennial",
  amount: 120,
  notes: "Pay the application fee with this card. One credit roughly every four years.",
};

/** Order matters: the first template whose pattern matches a name wins. */
export const CATALOG: CardTemplate[] = [
  {
    key: "amex-business-platinum",
    name: "Amex Business Platinum",
    issuer: "American Express",
    business: true,
    annualFee: 895,
    match: /amex.*(bus\w*|biz)\s+plat/i,
    benefits: [
      {
        name: "Hotel credit (Fine Hotels + Resorts / Hotel Collection)",
        cadence: "semiannual",
        amount: 300,
        notes: "Prepaid bookings through Amex Travel. The Hotel Collection needs a 2-night stay.",
      },
      {
        name: "Dell Technologies credit",
        cadence: "annual",
        amount: 150,
        notes:
          "U.S. purchases at dell.com. A further $1,000 credit unlocks after $5,000 of Dell spend in the calendar year.",
        enroll: true,
      },
      {
        name: "Indeed credit",
        cadence: "quarterly",
        amount: 90,
        notes: "Hiring and recruiting purchases with Indeed.",
        enroll: true,
      },
      {
        name: "Hilton credit",
        cadence: "quarterly",
        amount: 50,
        notes:
          "Purchases made directly with Hilton properties. Needs a Hilton for Business account.",
        enroll: true,
      },
      {
        name: "Wireless credit",
        cadence: "monthly",
        amount: 10,
        notes: "Paid directly to a U.S. wireless provider. Put the phone bill on this card.",
        enroll: true,
      },
      {
        name: "Airline fee credit",
        cadence: "annual",
        amount: 200,
        notes:
          "Incidental fees (bags, seats, lounge passes) on the one airline you select each January.",
        enroll: true,
      },
      {
        name: "CLEAR Plus credit",
        cadence: "annual",
        amount: 209,
        notes: "Covers one CLEAR Plus membership per calendar year.",
      },
      {
        name: "ChatGPT Business credit",
        cadence: "annual",
        amount: 300,
        notes: "U.S. purchases of ChatGPT Business. The plan has a two-seat minimum.",
        enroll: true,
      },
      {
        name: "Adobe credit",
        cadence: "annual",
        amount: 250,
        notes:
          "Reported as $250 back after $600 of Adobe spend in a calendar year. Confirm in your Amex benefits tab.",
        enroll: true,
      },
      GLOBAL_ENTRY,
      {
        name: "Lounge access",
        cadence: "perk",
        notes:
          "Centurion Lounges, Delta Sky Club when flying Delta (limited visits), Priority Pass, Escape, Plaza Premium.",
      },
      {
        name: "Hotel status",
        cadence: "perk",
        notes: "Hilton Honors Gold and Marriott Bonvoy Gold Elite.",
        enroll: true,
      },
      {
        name: "35% points rebate on Pay with Points",
        cadence: "perk",
        notes:
          "On first and business class flights, and any fare on your selected airline, up to 1M points back a year.",
      },
      {
        name: "Cell phone protection",
        cadence: "perk",
        notes: "When the monthly bill is paid with this card.",
      },
    ],
  },
  {
    key: "amex-platinum",
    name: "Amex Platinum",
    issuer: "American Express",
    business: false,
    annualFee: 895,
    match: /amex(?!.*delta).*plat/i,
    benefits: [
      {
        name: "Hotel credit (Fine Hotels + Resorts / Hotel Collection)",
        cadence: "semiannual",
        amount: 300,
        notes: "Prepaid bookings through Amex Travel. The Hotel Collection needs a 2-night stay.",
      },
      {
        name: "Resy dining credit",
        cadence: "quarterly",
        amount: 100,
        notes: "U.S. Resy restaurants.",
        enroll: true,
      },
      {
        name: "Digital entertainment credit",
        cadence: "monthly",
        amount: 25,
        notes:
          "Disney+, Hulu, ESPN+, Peacock, NYT, WSJ, Paramount+, YouTube Premium and YouTube TV.",
        enroll: true,
      },
      {
        name: "Uber Cash",
        cadence: "monthly",
        amount: 15,
        notes:
          "Rides or Uber Eats in the U.S. December carries an extra $20. Add the card to your Uber wallet.",
      },
      {
        name: "lululemon credit",
        cadence: "quarterly",
        amount: 75,
        notes: "U.S. stores and online.",
        enroll: true,
      },
      {
        name: "Saks Fifth Avenue credit",
        cadence: "semiannual",
        amount: 50,
        notes: "In store or at saks.com. No minimum spend.",
        enroll: true,
      },
      {
        name: "Airline fee credit",
        cadence: "annual",
        amount: 200,
        notes: "Incidental fees on the one airline you select each January.",
        enroll: true,
      },
      { name: "CLEAR Plus credit", cadence: "annual", amount: 209 },
      { name: "Uber One membership credit", cadence: "annual", amount: 120, enroll: true },
      {
        name: "Oura Ring credit",
        cadence: "annual",
        amount: 200,
        notes: "Hardware bought at ouraring.com.",
        enroll: true,
      },
      {
        name: "Equinox credit",
        cadence: "annual",
        amount: 300,
        notes: "Equinox clubs or Equinox+.",
        enroll: true,
      },
      {
        name: "Walmart+ credit",
        cadence: "monthly",
        amount: 12.95,
        notes: "Monthly membership fee.",
      },
      GLOBAL_ENTRY,
      {
        name: "Lounge access",
        cadence: "perk",
        notes:
          "Centurion Lounges, Delta Sky Club when flying Delta (limited visits), Priority Pass.",
      },
      {
        name: "Hotel status",
        cadence: "perk",
        notes: "Hilton Honors Gold and Marriott Bonvoy Gold Elite.",
        enroll: true,
      },
    ],
  },
  {
    key: "amex-business-gold",
    name: "Amex Business Gold",
    issuer: "American Express",
    business: true,
    annualFee: 375,
    match: /amex.*(bus\w*|biz)\s+(gold|prg)/i,
    benefits: [
      {
        name: "Flexible business credit",
        cadence: "monthly",
        amount: 20,
        notes:
          "Grubhub, office supply stores, and shipping at UPS.com (UPS replaced FedEx in October 2026).",
        enroll: true,
      },
      {
        name: "Walmart+ credit",
        cadence: "monthly",
        amount: 12.95,
        notes: "Monthly membership fee. Plus Up add-ons do not qualify.",
        enroll: true,
      },
      {
        name: "ChatGPT Business credit",
        cadence: "annual",
        amount: 300,
        notes: "U.S. purchases of ChatGPT Business. The plan has a two-seat minimum.",
        enroll: true,
      },
      {
        name: "4x in your top two categories",
        cadence: "perk",
        notes:
          "On the first $150,000 a year across the two eligible categories you spend most in each month.",
      },
    ],
  },
  {
    key: "amex-gold",
    name: "Amex Gold",
    issuer: "American Express",
    business: false,
    annualFee: 325,
    match: /amex\s+(gold|prg)\b/i,
    benefits: [
      {
        name: "Dining credit",
        cadence: "monthly",
        amount: 10,
        notes:
          "Select partners such as Grubhub and Five Guys. The partner list changed for 2026, so check the current one.",
        enroll: true,
      },
      {
        name: "Uber Cash",
        cadence: "monthly",
        amount: 10,
        notes:
          "Rides or Uber Eats in the U.S. Add the card to your Uber wallet and pay with an Amex.",
      },
      {
        name: "Resy credit",
        cadence: "semiannual",
        amount: 50,
        notes: "U.S. Resy restaurants.",
        enroll: true,
      },
      {
        name: "Dunkin' credit",
        cadence: "monthly",
        amount: 7,
        notes: "U.S. Dunkin' locations.",
        enroll: true,
      },
      {
        name: "4x restaurants and U.S. supermarkets",
        cadence: "perk",
        notes:
          "Restaurants worldwide up to $50,000 a year; U.S. supermarkets up to $25,000 a year.",
      },
    ],
  },
  {
    key: "chase-sapphire-reserve",
    name: "Chase Sapphire Reserve",
    issuer: "Chase",
    business: false,
    annualFee: 795,
    match: /sapphire reserve(?!.*business)/i,
    benefits: [
      {
        name: "Travel credit",
        cadence: "anniversary",
        amount: 300,
        notes: "Applies automatically to the first $300 of travel purchases each cardmember year.",
      },
      {
        name: "The Edit hotel credit",
        cadence: "annual",
        amount: 500,
        notes:
          "Two $250 credits a calendar year on prepaid stays of 2+ nights booked with The Edit by Chase Travel. One credit per booking.",
      },
      {
        name: "Select Chase Travel hotels credit (2026 only)",
        cadence: "annual",
        amount: 250,
        notes:
          "One-time credit for prepaid Chase Travel stays at select brands, for 2026 bookings only.",
        endsOn: "2026-12-31",
      },
      {
        name: "Dining credit (Sapphire Reserve Exclusive Tables)",
        cadence: "semiannual",
        amount: 150,
        notes: "Restaurants in the Exclusive Tables program on OpenTable.",
      },
      {
        name: "StubHub / viagogo credit",
        cadence: "semiannual",
        amount: 150,
        notes: "Concert and event tickets.",
        enroll: true,
      },
      {
        name: "DoorDash credit",
        cadence: "monthly",
        amount: 15,
        notes:
          "Any order type since October 2026. Needs the complimentary DashPass membership activated on this card.",
        enroll: true,
      },
      {
        name: "Lyft credit",
        cadence: "monthly",
        amount: 10,
        notes: "In-app credit when this card is your Lyft payment method.",
      },
      {
        name: "Peloton membership credit",
        cadence: "monthly",
        amount: 10,
        notes: "Toward an eligible Peloton membership.",
        enroll: true,
      },
      {
        name: "Apple TV+ and Apple Music",
        cadence: "annual",
        amount: 250,
        notes:
          "Complimentary subscriptions rather than a statement credit. Activate each service once.",
        enroll: true,
      },
      { ...GLOBAL_ENTRY, name: "Global Entry / TSA PreCheck / NEXUS fee credit" },
      {
        name: "Lounge access",
        cadence: "perk",
        notes: "Chase Sapphire Lounges and Priority Pass Select.",
      },
      { name: "IHG One Rewards Platinum Elite", cadence: "perk", enroll: true },
      {
        name: "$75,000 spend unlocks",
        cadence: "perk",
        notes:
          "Southwest A-List, $500 Southwest credit, IHG Diamond and $250 for The Shops at Chase after $75,000 in a calendar year.",
      },
    ],
  },
  {
    key: "capital-one-venture-x-business",
    name: "Capital One Venture X Business",
    issuer: "Capital One",
    business: true,
    annualFee: 395,
    match: /venture x business/i,
    benefits: [
      {
        name: "Travel credit",
        cadence: "anniversary",
        amount: 300,
        notes: "Bookings through Capital One Business Travel.",
      },
      {
        name: "Anniversary miles",
        cadence: "anniversary",
        amount: 100,
        notes: "10,000 miles post each account anniversary.",
      },
      GLOBAL_ENTRY,
    ],
  },
  {
    key: "capital-one-venture-x",
    name: "Capital One Venture X",
    issuer: "Capital One",
    business: false,
    annualFee: 395,
    match: /venture x/i,
    benefits: [
      {
        name: "Travel credit",
        cadence: "anniversary",
        amount: 300,
        notes: "Bookings made through Capital One Travel. Resets on the account anniversary.",
      },
      {
        name: "Anniversary miles",
        cadence: "anniversary",
        amount: 100,
        notes: "10,000 miles post automatically each anniversary. Mark this once they land.",
      },
      GLOBAL_ENTRY,
      {
        name: "Lounge access",
        cadence: "perk",
        notes: "Capital One Lounges and Priority Pass. Free guests ended in February 2026.",
      },
    ],
  },
  {
    key: "chase-ink-business-preferred",
    name: "Chase Ink Business Preferred",
    issuer: "Chase",
    business: true,
    annualFee: 95,
    match: /ink.*preferred/i,
    benefits: [
      {
        name: "3x travel, shipping, internet, cable, phone and online ads",
        cadence: "perk",
        notes: "On the first $150,000 in combined purchases each account year.",
      },
      {
        name: "Cell phone protection",
        cadence: "perk",
        notes: "Up to $1,000 per claim when the phone bill is paid with this card.",
      },
    ],
  },
  {
    key: "chase-hyatt-business",
    name: "World of Hyatt Business",
    issuer: "Chase",
    business: true,
    annualFee: 199,
    match: /hyatt.*(business|biz)/i,
    benefits: [
      {
        name: "Hyatt credit",
        cadence: "anniversary",
        amount: 100,
        notes: "$50 back on each of two Hyatt purchases of $50 or more per cardmember year.",
      },
      { name: "Discoverist status", cadence: "perk", notes: "For you and up to five employees." },
      {
        name: "Spend bonuses",
        cadence: "perk",
        notes:
          "5 tier-qualifying nights per $10,000 spent; 10% of redeemed points back after $50,000 in a calendar year.",
      },
    ],
  },
  {
    key: "chase-hyatt",
    name: "World of Hyatt",
    issuer: "Chase",
    business: false,
    annualFee: 95,
    match: /hyatt/i,
    benefits: [
      {
        name: "Free night certificate (Category 1–4)",
        cadence: "anniversary",
        amount: 250,
        notes: "Issued after each anniversary and valid for 12 months. Book it before it expires.",
      },
      {
        name: "Second free night after $15,000 spend",
        cadence: "annual",
        amount: 250,
        notes: "Earned by spending $15,000 in a calendar year.",
      },
      {
        name: "Discoverist status",
        cadence: "perk",
        notes: "Plus 5 tier-qualifying night credits every year.",
      },
    ],
  },
  {
    key: "discover-it",
    name: "Discover it",
    issuer: "Discover",
    business: false,
    annualFee: 0,
    match: /discover it/i,
    benefits: [
      {
        name: "Activate 5% rotating categories",
        cadence: "quarterly",
        notes: "5% back on up to $1,500 in the quarter's categories, only after you activate.",
        enroll: true,
      },
    ],
  },
];

export function getTemplate(key: string | null | undefined): CardTemplate | undefined {
  return key ? CATALOG.find((t) => t.key === key) : undefined;
}

/** Best template for a free-form card name, e.g. "Amex Business PRG". */
export function matchTemplate(name: string): CardTemplate | undefined {
  return CATALOG.find((t) => t.match.test(name));
}
