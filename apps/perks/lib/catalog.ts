import type { Cadence } from "./periods";

/**
 * Built-in benefit templates for cards with recurring credits. Adding a card
 * from a template copies these rows into the database, where each one can be
 * edited, switched off or deleted. Issuers change benefits often: treat this
 * as a starting point and confirm against the card's own benefits page.
 */
export const CATALOG_REVIEWED = "2026-11-16";

/**
 * Benefits a card no longer has, or that were renamed. Cards set up before the
 * change still carry them, so catalog updates offer to remove them.
 */
export const RETIRED: Record<string, string[]> = {
  "amex-platinum": ["Saks Fifth Avenue credit"],
  "chase-ihg-premier": [
    "Anniversary free night (up to 40,000 points)",
    "Platinum Elite status and 4th award night free",
  ],
};

export type TemplateBenefit = {
  name: string;
  cadence: Cadence;
  /** Dollars available per period. Omit for perks and reminders. */
  amount?: number;
  notes?: string;
  enroll?: boolean;
  /**
   * Applied inside an app or at checkout (Uber Cash, Lyft, Capital One Travel)
   * rather than as a statement line, so a statement import can never find it.
   */
  inApp?: boolean;
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
        notes:
          "Prepaid Fine Hotels + Resorts, Hotel Collection or Airbnb Luxe bookings through Amex Travel. From Jan 1, 2027 every booking needs a 2-night stay.",
      },
      {
        name: "Airbnb Experiences credit",
        cadence: "annual",
        amount: 250,
        notes:
          "Airbnb Experiences booked after a prepaid Airbnb Luxe stay through Amex Travel. New in late 2026; confirm the reset date in your Amex benefits tab.",
        enroll: true,
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
        notes:
          "Paid directly to a U.S. wireless provider. From Feb 17, 2027 only Verizon, AT&T, T-Mobile, Frontier, Comcast, Charter, Spectrum Mobile, UScellular, Optimum, Ultra Mobile and Mint Mobile count.",
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
        name: "ZO Clubhouse and Studio membership",
        cadence: "perk",
        notes:
          "Lounge and coworking spaces in NYC, Boston, DC, Chicago, SF and LA, plus up to $500 a calendar year toward ZO event space or a Dining Club membership.",
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
        notes:
          "Prepaid Fine Hotels + Resorts, Hotel Collection or Airbnb Luxe bookings through Amex Travel. From Jan 1, 2027 every booking needs a 2-night stay.",
      },
      {
        name: "Airbnb Experiences credit",
        cadence: "annual",
        amount: 250,
        notes:
          "Airbnb Experiences booked after a prepaid Airbnb Luxe stay through Amex Travel. New in late 2026; confirm the reset date in your Amex benefits tab.",
        enroll: true,
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
          "Disney+, Hulu, ESPN+, Peacock, NYT, WSJ, Paramount+, YouTube Premium and YouTube TV. Bundles, add-ons and third-party billing don't count since Aug 2026.",
        enroll: true,
      },
      {
        name: "Uber Cash",
        inApp: true,
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
        name: "Airline fee credit",
        cadence: "annual",
        amount: 200,
        notes:
          "Incidental fees on the one airline you select each January. United TravelBank no longer triggers it (Feb 2026).",
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
        name: "SoulCycle credit",
        cadence: "annual",
        amount: 300,
        notes: "Toward a SoulCycle at-home bike. Resets each calendar year.",
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
          "Centurion Lounges, Delta Sky Club when flying Delta (limited visits), Priority Pass. Two free Centurion guests after $75,000 in a calendar year.",
      },
      {
        name: "Venue Collection: 10% back at stadiums",
        cadence: "perk",
        notes:
          "10% back on food and drink at participating stadiums and arenas, up to $250 a calendar year. Moves to the Benefits tab on Jan 6, 2027.",
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
        name: "Squarespace credit",
        cadence: "annual",
        amount: 150,
        notes: "Squarespace purchases. Resets each calendar year.",
        enroll: true,
      },
      {
        name: "4x in your top two categories",
        cadence: "perk",
        notes:
          "On the first $150,000 a year across the two eligible categories you spend most in each month. From Feb 17, 2027 ads count only with Meta, Google, Amazon, Microsoft, GoDaddy and Yelp, and wireless only with major carriers.",
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
        inApp: true,
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
        inApp: true,
        cadence: "monthly",
        amount: 15,
        notes:
          "Any order type since October 2026. Needs the complimentary DashPass membership activated on this card.",
        enroll: true,
      },
      {
        name: "DoorDash grocery and retail promos",
        inApp: true,
        cadence: "monthly",
        amount: 20,
        notes:
          "Two $10 promos a month on grocery, convenience and other non-restaurant orders of $20 or more. Needs DashPass activated on this card.",
        enroll: true,
      },
      {
        name: "Lyft credit",
        inApp: true,
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
        inApp: true,
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
          "Southwest status, a $500 Southwest credit, IHG Diamond, Hyatt Explorist and $250 for The Shops at Chase after $75,000 in a calendar year.",
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
        inApp: true,
        cadence: "anniversary",
        amount: 300,
        notes: "Bookings through Capital One Business Travel.",
      },
      {
        name: "Anniversary miles",
        inApp: true,
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
        inApp: true,
        cadence: "anniversary",
        amount: 300,
        notes:
          "Taken off the price at checkout on Capital One Travel, so it never shows as a statement credit. Resets on the account anniversary.",
      },
      {
        name: "Anniversary miles",
        inApp: true,
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
        name: "Hyatt transfers at 4:3",
        cadence: "perk",
        notes:
          "Since Oct 1, 2026, points move to Hyatt at 4:3. Move them to a Sapphire Reserve first to transfer 1:1.",
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
        inApp: true,
        cadence: "anniversary",
        amount: 250,
        notes: "Issued after each anniversary and valid for 12 months. Book it before it expires.",
      },
      {
        name: "Second free night after $15,000 spend",
        inApp: true,
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
    key: "chase-sapphire-preferred",
    name: "Chase Sapphire Preferred",
    issuer: "Chase",
    business: false,
    annualFee: 95,
    match: /sapphire pref/i,
    benefits: [
      {
        name: "Chase Travel hotel credit",
        cadence: "anniversary",
        amount: 100,
        notes: "Hotel stays booked through Chase Travel each account year. Applies automatically.",
      },
      {
        name: "DoorDash non-restaurant coupon",
        cadence: "monthly",
        amount: 10,
        notes:
          "Up to $10 off a grocery, convenience or other non-restaurant order. Needs DashPass activated on this card.",
        enroll: true,
        inApp: true,
      },
      {
        name: "Activate Apple TV",
        cadence: "annual",
        notes: "Complimentary Apple TV for 12 months, but only if activated by Dec 31, 2026.",
        enroll: true,
        inApp: true,
        endsOn: "2026-12-31",
      },
      GLOBAL_ENTRY,
      {
        name: "3x dining, gas, EV charging and vacation rentals",
        cadence: "perk",
        notes:
          "Plus 5x on Chase Travel and 2x on other travel. The 10% anniversary points bonus ended in October 2026.",
      },
      {
        name: "Hyatt transfers at 4:3",
        cadence: "perk",
        notes:
          "Since Oct 1, 2026, points move to Hyatt at 4:3. Move them to a Sapphire Reserve first to transfer 1:1.",
      },
    ],
  },
  {
    key: "chase-aeroplan",
    name: "Chase Air Canada Aeroplan",
    issuer: "Chase",
    business: false,
    annualFee: 195,
    match: /aeroplan/i,
    benefits: [
      {
        name: "Air Canada credit",
        cadence: "semiannual",
        amount: 50,
        notes:
          "$50 on Air Canada purchases from January through June and another $50 from July through December.",
      },
      {
        name: "Aeroplan 25K status",
        cadence: "perk",
        notes:
          "Automatic while the card is open and linked to your Aeroplan account. Also 15% off eligible Air Canada awards.",
      },
      { ...GLOBAL_ENTRY, name: "Global Entry / TSA PreCheck / NEXUS fee credit" },
      {
        name: "Free checked bag on Air Canada",
        cadence: "perk",
        notes:
          "For you and up to 8 companions. Points can also pay the annual fee at 2¢ each through Pay Yourself Back.",
      },
      {
        name: "Annual fee rises to $195",
        cadence: "perk",
        notes: "Was $95. Existing cardmembers pay $195 from renewals on or after Dec 1, 2026.",
      },
    ],
  },
  {
    key: "chase-freedom-flex",
    name: "Chase Freedom Flex",
    issuer: "Chase",
    business: false,
    annualFee: 0,
    match: /freedom flex/i,
    benefits: [
      {
        name: "Activate 5% quarterly categories",
        cadence: "quarterly",
        notes:
          "5% back on up to $1,500 in the quarter's categories, only after you activate in the Chase app.",
        enroll: true,
      },
    ],
  },
  {
    key: "chase-freedom-unlimited",
    name: "Chase Freedom Unlimited",
    issuer: "Chase",
    business: false,
    annualFee: 0,
    match: /freedom unlimited/i,
    benefits: [
      {
        name: "1.5x on everything",
        cadence: "perk",
        notes: "Plus 3x dining and drugstores. Points move to a Sapphire card for transfers.",
      },
    ],
  },
  {
    key: "chase-freedom",
    name: "Chase Freedom",
    issuer: "Chase",
    business: false,
    annualFee: 0,
    match: /freedom(?! (unlimited|flex))/i,
    benefits: [
      {
        name: "Activate 5% quarterly categories",
        cadence: "quarterly",
        notes:
          "The original Freedom still gets rotating 5% categories. Activate each quarter in the Chase app.",
        enroll: true,
      },
    ],
  },
  {
    key: "chase-ink-business-cash",
    name: "Chase Ink Business Cash",
    issuer: "Chase",
    business: true,
    annualFee: 0,
    match: /ink.*cash/i,
    benefits: [
      {
        name: "5x office supply stores, internet, cable and phone",
        cadence: "perk",
        notes:
          "On the first $25,000 combined each account year; 2x gas and restaurants on the next $25,000.",
      },
    ],
  },
  {
    key: "chase-ink-business-unlimited",
    name: "Chase Ink Business Unlimited",
    issuer: "Chase",
    business: true,
    annualFee: 0,
    match: /ink.*unlimited/i,
    benefits: [{ name: "1.5x on everything", cadence: "perk" }],
  },
  {
    key: "amex-everyday",
    name: "Amex EveryDay",
    issuer: "American Express",
    business: false,
    annualFee: 0,
    match: /amex every ?day(?!.*pref)/i,
    benefits: [
      {
        name: "Amex Offers",
        cadence: "perk",
        notes:
          "Gets most of the same Amex Offers as your other Amex cards; paste its offers page too.",
      },
    ],
  },
  {
    key: "amex-blue-business-plus",
    name: "Amex Blue Business Plus",
    issuer: "American Express",
    business: true,
    annualFee: 0,
    match: /blue business|bbp/i,
    benefits: [
      {
        name: "2x on everything",
        cadence: "perk",
        notes: "On the first $50,000 a year. Earns transferable Membership Rewards.",
      },
    ],
  },
  {
    key: "atmos-summit",
    name: "Atmos Rewards Summit (Bank of America)",
    issuer: "Bank of America",
    business: false,
    annualFee: 395,
    match: /atmos.*summit/i,
    benefits: [
      {
        name: "25,000-point companion award",
        cadence: "anniversary",
        notes:
          "Arrives each card anniversary with no spend needed. Valid 12 months on awards where both tickets cost 25,000+ points.",
        inApp: true,
      },
      {
        name: "Alaska Lounge passes",
        cadence: "quarterly",
        notes: "Two lounge passes and two Wi-Fi passes each calendar quarter, 8 of each a year.",
        inApp: true,
      },
      GLOBAL_ENTRY,
      {
        name: "Global 100K companion award after $60,000",
        cadence: "perk",
        notes: "Earned by spending $60,000 in a card anniversary year.",
      },
      {
        name: "Free checked bag and preferred boarding",
        cadence: "perk",
        notes:
          "For you and up to six guests on the same Alaska or Hawaiian reservation paid with this card.",
      },
      { name: "Faster Atmos elite status", cadence: "perk" },
    ],
  },
  {
    key: "citi-aadvantage-platinum-select",
    name: "Citi AAdvantage Platinum Select",
    issuer: "Citibank",
    business: false,
    annualFee: 99,
    match: /citi.*(aadvantage|\baa\b)(?!.*exec)/i,
    benefits: [
      {
        name: "First checked bag free on American",
        cadence: "perk",
        notes: "Plus preferred boarding. Citi announced a refresh raising the fee to $150 in 2027.",
      },
      {
        name: "Turo credit",
        cadence: "annual",
        amount: 180,
        notes: "Up to $30 off each Turo trip, $180 a calendar year.",
      },
      {
        name: "Flight discount after $20,000 spend",
        cadence: "perk",
        notes:
          "A $125 American Airlines flight discount ($150 from Jan 24, 2027) after $20,000 of spend in a cardmember year, counted over 12 statements rather than the calendar year.",
      },
      {
        name: "Changes on Jan 24, 2027",
        cadence: "perk",
        notes:
          "Annual fee rises to $150. Adds up to $100 a calendar year in inflight credits, a Walmart+ membership, a Global Entry / TSA PreCheck credit and trip protections.",
      },
    ],
  },
  {
    key: "costco-citi",
    name: "Costco Anywhere Visa (Citi)",
    issuer: "Citibank",
    business: false,
    annualFee: 0,
    match: /costco/i,
    benefits: [
      {
        name: "Annual reward certificate",
        cadence: "annual",
        notes:
          "Arrives with the February statement and is redeemed at Costco. Mark done once you cash it.",
        inApp: true,
      },
    ],
  },
  {
    key: "citi-double-cash",
    name: "Citi Double Cash",
    issuer: "Citibank",
    business: false,
    annualFee: 0,
    match: /double cash/i,
    benefits: [{ name: "2% back on everything", cadence: "perk" }],
  },
  {
    key: "chase-marriott-boundless",
    name: "Marriott Bonvoy Boundless",
    issuer: "Chase",
    business: false,
    annualFee: 95,
    match: /boundless/i,
    benefits: [
      {
        name: "Free night award (up to 35,000 points)",
        cadence: "anniversary",
        notes: "Posts after each card anniversary and expires a year later. Book it before then.",
        inApp: true,
      },
      {
        name: "Airline credit",
        cadence: "semiannual",
        amount: 50,
        notes:
          "$50 back after $250 spent directly with airlines, July to December 2026 and again January to June 2027. Activate first.",
        enroll: true,
        endsOn: "2027-06-30",
      },
      {
        name: "Silver Elite status",
        cadence: "perk",
        notes:
          "Gold Elite after $35,000 of spend in a calendar year. 1 elite night credit per $5,000 spent.",
      },
    ],
  },
  {
    key: "chase-ihg-premier",
    name: "IHG One Rewards Premier",
    issuer: "Chase",
    business: false,
    annualFee: 150,
    match: /ihg/i,
    benefits: [
      {
        name: "Anniversary free night (up to 50,000 points)",
        cadence: "anniversary",
        notes: "Posts after each card anniversary. Book it before it expires.",
        inApp: true,
      },
      {
        name: "United TravelBank credit",
        cadence: "semiannual",
        amount: 25,
        notes:
          "$25 lands in a linked United TravelBank around January 5 and again around July 5. Register first.",
        enroll: true,
        inApp: true,
      },
      {
        name: "IHG food and beverage credit",
        cadence: "quarterly",
        amount: 25,
        notes:
          "One $25 voucher per quarter for food and drink at IHG hotels. Only works during an active stay.",
      },
      {
        name: "Airline credit",
        cadence: "annual",
        amount: 100,
        notes:
          "Statement credit once you spend $250 on airfare in the calendar year. Slated to end after 2027.",
        endsOn: "2027-12-31",
      },
      GLOBAL_ENTRY,
      {
        name: "Gold Elite status and 4th award night free",
        cadence: "perk",
        notes:
          "Status dropped from Platinum to Gold in October 2026. 15 elite night credits each January. From 2027 the fourth award night is free only after $5,000 of spend in the calendar year.",
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
      {
        name: "5% on Capital One Travel",
        cadence: "perk",
        notes:
          "Hotels, vacation rentals and rental cars booked on Capital One Travel. Discover accounts are moving to the Capital One app in rounds through January 2027.",
      },
    ],
  },
];

export function getTemplate(key: string | null | undefined): CardTemplate | undefined {
  return key ? CATALOG.find((t) => t.key === key) : undefined;
}

/** Best template for a free-form card name, e.g. "Amex Business PRG". */
/**
 * Whether a card's benefit can appear as a line on a statement. Looks the
 * benefit up by name in the card's template; renamed or custom benefits are
 * assumed to be statement credits.
 */
export function onStatement(templateKey: string | null | undefined, benefitName: string): boolean {
  const benefit = getTemplate(templateKey)?.benefits.find((b) => b.name === benefitName);
  return !benefit?.inApp;
}

export function matchTemplate(name: string): CardTemplate | undefined {
  return CATALOG.find((t) => t.match.test(name));
}
