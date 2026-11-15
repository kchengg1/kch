/**
 * Earn rates for "Which card should I use?". Points per dollar by spending
 * category for every card in the catalog, from public card terms as reviewed
 * on EARN_REVIEWED. Rates that need booking through a bank's travel site
 * are kept in `portal` as a tip rather than ranked, since most spending
 * doesn't go through a portal.
 */
export const EARN_REVIEWED = "2026-11-15";

export const CATEGORIES = [
  { id: "dining", label: "Dining" },
  { id: "groceries", label: "Groceries" },
  { id: "flights", label: "Flights" },
  { id: "hotels", label: "Hotels" },
  { id: "travel", label: "Other travel" },
  { id: "transit", label: "Rideshare & transit" },
  { id: "gas", label: "Gas" },
  { id: "streaming", label: "Streaming" },
  { id: "drugstores", label: "Drugstores" },
  { id: "wholesale", label: "Costco & warehouse" },
  { id: "phone", label: "Phone & internet" },
  { id: "office", label: "Office supplies" },
  { id: "shipping", label: "Shipping" },
  { id: "other", label: "Everything else" },
] as const;
export type Category = (typeof CATEGORIES)[number]["id"];

export type EarnRate = {
  cat: Category | "everything";
  /** Points (or percent back) per dollar. */
  x: number;
  /** Only at this chain or airline, e.g. "hyatt". */
  chain?: string;
  note?: string;
};

export type CardEarn = {
  /** Program the points go to; "Cash back" means x is percent back. */
  currency: string;
  rates: EarnRate[];
  /** Higher rates only through the bank's travel site. */
  portal?: string;
  /** Has 5% categories that change each quarter. */
  rotating?: boolean;
  /** Chase cards whose points only transfer when you also hold a Sapphire or Ink Preferred. */
  pooledWithChase?: boolean;
};

const MR = "American Express Membership Rewards";
const UR = "Chase Ultimate Rewards";
const C1 = "Capital One Venture Rewards";
const CASH = "Cash back";

export const EARN: Record<string, CardEarn> = {
  "amex-platinum": {
    currency: MR,
    rates: [
      { cat: "flights", x: 5, note: "Booked directly with the airline or through Amex Travel" },
      { cat: "everything", x: 1 },
    ],
    portal: "5x on prepaid hotels booked through Amex Travel",
  },
  "amex-business-platinum": {
    currency: MR,
    rates: [
      { cat: "shipping", x: 1.5, note: "Also 1.5x on purchases of $5,000 or more" },
      { cat: "everything", x: 1 },
    ],
    portal: "5x on flights and prepaid hotels booked through Amex Travel",
  },
  "amex-gold": {
    currency: MR,
    rates: [
      { cat: "dining", x: 4, note: "Up to $50,000 a year" },
      { cat: "groceries", x: 4, note: "U.S. supermarkets, up to $25,000 a year" },
      { cat: "flights", x: 3, note: "Booked directly with the airline" },
      { cat: "everything", x: 1 },
    ],
  },
  "amex-business-gold": {
    currency: MR,
    rates: [
      { cat: "dining", x: 4, note: "Only if it's one of your two top categories this month" },
      { cat: "gas", x: 4, note: "Only if it's one of your two top categories this month" },
      { cat: "flights", x: 4, note: "Only if it's one of your two top categories this month" },
      { cat: "shipping", x: 4, note: "Only if it's one of your two top categories this month" },
      { cat: "transit", x: 4, note: "Only if it's one of your two top categories this month" },
      { cat: "everything", x: 1 },
    ],
  },
  "amex-everyday": {
    currency: MR,
    rates: [
      { cat: "groceries", x: 2, note: "U.S. supermarkets, up to $6,000 a year" },
      { cat: "everything", x: 1 },
    ],
  },
  "amex-blue-business-plus": {
    currency: MR,
    rates: [{ cat: "everything", x: 2, note: "On the first $50,000 a year" }],
  },
  "chase-sapphire-reserve": {
    currency: UR,
    rates: [
      { cat: "flights", x: 4, note: "Booked directly with the airline" },
      { cat: "hotels", x: 4, note: "Booked directly with the hotel" },
      { cat: "dining", x: 3 },
      { cat: "transit", x: 5, chain: "lyft", note: "Lyft rides" },
      { cat: "everything", x: 1 },
    ],
    portal: "8x on Chase Travel",
  },
  "chase-sapphire-preferred": {
    currency: UR,
    rates: [
      { cat: "dining", x: 3 },
      { cat: "streaming", x: 3 },
      { cat: "gas", x: 3, note: "Gas stations and EV charging" },
      { cat: "groceries", x: 3, note: "Online grocery orders only" },
      { cat: "flights", x: 2 },
      { cat: "hotels", x: 2 },
      { cat: "travel", x: 2 },
      { cat: "transit", x: 2 },
      { cat: "everything", x: 1 },
    ],
    portal: "5x on Chase Travel",
  },
  "chase-freedom-unlimited": {
    currency: UR,
    pooledWithChase: true,
    rates: [
      { cat: "dining", x: 3 },
      { cat: "drugstores", x: 3 },
      { cat: "everything", x: 1.5 },
    ],
    portal: "5x on Chase Travel",
  },
  "chase-freedom-flex": {
    currency: UR,
    pooledWithChase: true,
    rotating: true,
    rates: [
      { cat: "dining", x: 3 },
      { cat: "drugstores", x: 3 },
      { cat: "everything", x: 1 },
    ],
  },
  "chase-freedom": {
    currency: UR,
    pooledWithChase: true,
    rotating: true,
    rates: [{ cat: "everything", x: 1 }],
  },
  "chase-ink-business-preferred": {
    currency: UR,
    rates: [
      { cat: "flights", x: 3, note: "Up to $150,000 a year across the 3x categories" },
      { cat: "hotels", x: 3, note: "Up to $150,000 a year across the 3x categories" },
      { cat: "travel", x: 3, note: "Up to $150,000 a year across the 3x categories" },
      { cat: "transit", x: 3, note: "Up to $150,000 a year across the 3x categories" },
      { cat: "shipping", x: 3, note: "Up to $150,000 a year across the 3x categories" },
      { cat: "phone", x: 3, note: "Up to $150,000 a year across the 3x categories" },
      { cat: "everything", x: 1 },
    ],
  },
  "chase-ink-business-cash": {
    currency: UR,
    pooledWithChase: true,
    rates: [
      { cat: "office", x: 5, note: "Up to $25,000 a year across the 5x categories" },
      { cat: "phone", x: 5, note: "Up to $25,000 a year across the 5x categories" },
      { cat: "gas", x: 2, note: "Up to $25,000 a year across the 2x categories" },
      { cat: "dining", x: 2, note: "Up to $25,000 a year across the 2x categories" },
      { cat: "everything", x: 1 },
    ],
  },
  "chase-ink-business-unlimited": {
    currency: UR,
    pooledWithChase: true,
    rates: [{ cat: "everything", x: 1.5 }],
  },
  "capital-one-venture-x": {
    currency: C1,
    rates: [{ cat: "everything", x: 2 }],
    portal: "10x on hotels and rental cars, 5x on flights through Capital One Travel",
  },
  "capital-one-venture-x-business": {
    currency: C1,
    rates: [{ cat: "everything", x: 2 }],
    portal: "10x on hotels and rental cars, 5x on flights through Capital One Business Travel",
  },
  "chase-hyatt": {
    currency: "Hyatt",
    rates: [
      { cat: "hotels", x: 4, chain: "hyatt", note: "At Hyatt, plus points you earn as a member" },
      { cat: "dining", x: 2 },
      { cat: "flights", x: 2 },
      { cat: "transit", x: 2 },
      { cat: "everything", x: 1 },
    ],
  },
  "chase-hyatt-business": {
    currency: "Hyatt",
    rates: [
      { cat: "hotels", x: 4, chain: "hyatt", note: "At Hyatt, plus points you earn as a member" },
      { cat: "dining", x: 2, note: "Only if it's one of your top three categories" },
      { cat: "flights", x: 2, note: "Only if it's one of your top three categories" },
      { cat: "gas", x: 2, note: "Only if it's one of your top three categories" },
      { cat: "shipping", x: 2, note: "Only if it's one of your top three categories" },
      { cat: "everything", x: 1 },
    ],
  },
  "chase-marriott-boundless": {
    currency: "Marriott Bonvoy",
    rates: [
      {
        cat: "hotels",
        x: 6,
        chain: "marriott",
        note: "At Marriott, plus points you earn as a member",
      },
      { cat: "dining", x: 3, note: "On the first $6,000 a year across dining, groceries and gas" },
      {
        cat: "groceries",
        x: 3,
        note: "On the first $6,000 a year across dining, groceries and gas",
      },
      { cat: "gas", x: 3, note: "On the first $6,000 a year across dining, groceries and gas" },
      { cat: "everything", x: 2 },
    ],
  },
  "chase-ihg-premier": {
    currency: "IHG One Rewards",
    rates: [
      {
        cat: "hotels",
        x: 10,
        chain: "ihg",
        note: "At IHG hotels, plus points you earn as a member",
      },
      { cat: "flights", x: 5 },
      { cat: "hotels", x: 5 },
      { cat: "travel", x: 5 },
      { cat: "gas", x: 5 },
      { cat: "dining", x: 5 },
      { cat: "everything", x: 3 },
    ],
  },
  "chase-aeroplan": {
    currency: "Aeroplan",
    rates: [
      { cat: "flights", x: 3, chain: "air canada", note: "Air Canada directly" },
      { cat: "dining", x: 3, note: "Reported to drop to 2x in 2027" },
      { cat: "groceries", x: 3, note: "Reported to drop to 2x in 2027" },
      { cat: "everything", x: 1 },
    ],
  },
  "atmos-summit": {
    currency: "Alaska / Hawaiian Atmos Rewards",
    rates: [
      { cat: "flights", x: 3, chain: "alaska", note: "Alaska and Hawaiian Airlines" },
      { cat: "dining", x: 3 },
      { cat: "everything", x: 1 },
    ],
  },
  "citi-aadvantage-platinum-select": {
    currency: "American AAdvantage",
    rates: [
      { cat: "flights", x: 2, chain: "american", note: "American Airlines" },
      { cat: "dining", x: 2 },
      { cat: "gas", x: 2 },
      { cat: "everything", x: 1 },
    ],
  },
  "costco-citi": {
    currency: CASH,
    rates: [
      { cat: "gas", x: 4, note: "Up to $7,000 a year, Costco gas included" },
      { cat: "dining", x: 3 },
      { cat: "flights", x: 3 },
      { cat: "hotels", x: 3 },
      { cat: "travel", x: 3 },
      { cat: "wholesale", x: 2, chain: "costco", note: "At Costco and costco.com" },
      { cat: "everything", x: 1 },
    ],
  },
  "citi-double-cash": {
    currency: CASH,
    rates: [{ cat: "everything", x: 2, note: "1% when you buy, 1% when you pay" }],
  },
  "discover-it": {
    currency: CASH,
    rotating: true,
    rates: [{ cat: "everything", x: 1 }],
  },
};

/** Merchants people type, mapped to a category and, for loyalty cards, a chain. */
const MERCHANTS: [RegExp, Category, string?][] = [
  [/\bhyatt|andaz|park hyatt|thompson hotel/i, "hotels", "hyatt"],
  [
    /marriott|westin|sheraton|ritz|st\.? regis|w hotel|courtyard|aloft|bonvoy/i,
    "hotels",
    "marriott",
  ],
  [/\bihg\b|holiday inn|intercontinental|kimpton|crowne plaza|indigo/i, "hotels", "ihg"],
  [/hilton|hampton|conrad|waldorf|doubletree|embassy suites/i, "hotels", "hilton"],
  [/airbnb|vrbo|hotel|resort|inn\b/i, "hotels"],
  [/american airlines|\baa\.com|\baadvantage/i, "flights", "american"],
  [/alaska air|hawaiian air/i, "flights", "alaska"],
  [/air canada/i, "flights", "air canada"],
  [/delta|united|southwest|jetblue|airline|airways|\bflight/i, "flights"],
  [/\blyft\b/i, "transit", "lyft"],
  [/uber|taxi|subway|\bmta\b|metro|transit|parking|toll/i, "transit"],
  [/amtrak|rental car|hertz|avis|enterprise|cruise|train/i, "travel"],
  [/costco|sam'?s club|bj'?s/i, "wholesale", "costco"],
  [
    /whole foods|trader joe|safeway|kroger|grocery|supermarket|wegmans|publix|aldi|h-?mart/i,
    "groceries",
  ],
  [/shell|exxon|chevron|\bbp\b|sunoco|mobil|\bgas\b|fuel|ev charg/i, "gas"],
  [/netflix|spotify|hulu|disney|hbo|youtube|peacock|paramount|apple tv|streaming/i, "streaming"],
  [/cvs|walgreens|duane reade|rite aid|pharmacy|drugstore/i, "drugstores"],
  [/verizon|at&t|t-?mobile|comcast|xfinity|spectrum|internet|phone bill/i, "phone"],
  [/staples|office depot|officemax|office supply/i, "office"],
  [/\bups\b|fedex|usps|shipping/i, "shipping"],
  [
    /restaurant|dining|starbucks|coffee|cafe|doordash|grubhub|uber ?eats|chipotle|pizza|bar\b|sweetgreen/i,
    "dining",
  ],
];

/** Category and chain for a merchant or category word someone typed. */
export function classify(query: string): { category: Category; chain?: string } {
  const q = query.trim();
  const byLabel = CATEGORIES.find(
    (c) => c.id === q.toLowerCase() || c.label.toLowerCase() === q.toLowerCase(),
  );
  if (byLabel) return { category: byLabel.id };
  const hit = MERCHANTS.find(([re]) => re.test(q));
  return hit ? { category: hit[1], chain: hit[2] } : { category: "other" };
}

export type Pick = {
  cardId: string;
  cardName: string;
  templateKey: string | null;
  issuer: string;
  x: number;
  currency: string;
  /** Cents per point used for the estimate. */
  centsPerPoint: number;
  /** Estimated return per dollar, as a percent (2 means 2%). */
  returnPct: number;
  note?: string;
  portal?: string;
  rotating?: boolean;
};

/**
 * Ranks open cards for a purchase. `valueOf` gives the owner's cents per
 * point for a program. Chase cards that only earn cash back on their own get
 * the Ultimate Rewards value only when a Sapphire or Ink Preferred is open.
 */
export function rankCards(
  cards: {
    id: string;
    name: string;
    templateKey: string | null;
    issuer: string;
    closed: boolean;
  }[],
  query: { category: Category; chain?: string },
  valueOf: (program: string) => number,
): Pick[] {
  const open = cards.filter((c) => !c.closed && c.templateKey && EARN[c.templateKey]);
  const premiumChase = open.some((c) =>
    ["chase-sapphire-reserve", "chase-sapphire-preferred", "chase-ink-business-preferred"].includes(
      c.templateKey!,
    ),
  );
  const picks: Pick[] = open.map((card) => {
    const earn = EARN[card.templateKey!]!;
    const applies = (r: EarnRate) =>
      (r.cat === query.category || r.cat === "everything") && (!r.chain || r.chain === query.chain);
    const best = earn.rates
      .filter(applies)
      .sort(
        (a, b) => b.x - a.x || Number(a.cat === "everything") - Number(b.cat === "everything"),
      )[0] ?? {
      cat: "everything" as const,
      x: 1,
    };
    const cash = earn.currency === "Cash back" || (earn.pooledWithChase && !premiumChase);
    const centsPerPoint = cash ? 1 : valueOf(earn.currency);
    return {
      cardId: card.id,
      cardName: card.name,
      templateKey: card.templateKey,
      issuer: card.issuer,
      x: best.x,
      currency: cash ? "Cash back" : earn.currency,
      centsPerPoint,
      returnPct: Math.round(best.x * centsPerPoint * 100) / 100,
      note: best.cat === "everything" ? undefined : best.note,
      portal: earn.portal,
      rotating: earn.rotating,
    };
  });
  return picks.sort(
    (a, b) => b.returnPct - a.returnPct || b.x - a.x || a.cardName.localeCompare(b.cardName),
  );
}
