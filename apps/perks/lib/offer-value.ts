/**
 * How good an offer is: what it pays back as a share of the spend needed to
 * earn it. A $200 reward on $1,000 (20%) is a worse deal than $5 back on $5
 * (100%), even though the number is bigger. Worked out from the deal text.
 */

/** Value of one Membership Rewards or Ultimate Rewards point, in cents. */
export const POINT_CENTS = 2;
/** Offers paying back less than this share of the spend are treated as weak. */
export const WEAK_RATE = 0.1;

export type OfferReturn = {
  /** Share of the qualifying spend paid back, e.g. 0.2 for 20%. */
  rate: number;
  /** Most the offer can pay back in total, in cents, when the text says. */
  maxCents: number | null;
};

const dollars = (s: string) => Math.round(Number(s.replace(/,/g, "")) * 100);
const MONEY = String.raw`\$\s?([\d,]+(?:\.\d{1,2})?)`;
const POINTS = String.raw`([\d,]+)\s*(?:membership rewards®?|ultimate rewards®?)?\s*(?:points|pts)`;

export function offerReturn(details: string): OfferReturn | null {
  const text = details.replace(/\s+/g, " ");
  const times = Number(/up to (\d+) times/i.exec(text)?.[1] ?? 1);
  const total = new RegExp(`total of ${MONEY}`, "i").exec(text);
  const spend = new RegExp(`spend ${MONEY}`, "i").exec(text);

  // "Spend $50 or more, earn $10 back" / "get $50 back" / "earn $25".
  const cash = new RegExp(String.raw`(?:earn|get) ${MONEY}`, "i").exec(text);
  if (spend && cash) {
    const reward = dollars(cash[1]!);
    return {
      rate: reward / dollars(spend[1]!),
      maxCents: total ? dollars(total[1]!) : reward * times,
    };
  }

  // "Spend $125 or more, earn 3,000 Membership Rewards® points".
  const points = new RegExp(String.raw`earn ${POINTS}`, "i").exec(text);
  if (spend && points && !/per (eligible )?dollar/i.test(text)) {
    const reward = Number(points[1]!.replace(/,/g, "")) * POINT_CENTS;
    return { rate: reward / dollars(spend[1]!), maxCents: reward * times };
  }

  // "Earn +6 Membership Rewards® points per eligible dollar spent, up to 5,000 points".
  const perDollar =
    /\+?(\d+(?:\.\d+)?)\s*(?:x|membership rewards®? points|points?) per (?:eligible )?dollar/i.exec(
      text,
    );
  if (perDollar) {
    const cap = new RegExp(String.raw`up to ${POINTS}`, "i").exec(text);
    return {
      rate: (Number(perDollar[1]) * POINT_CENTS) / 100,
      maxCents: cap ? Number(cap[1]!.replace(/,/g, "")) * POINT_CENTS : null,
    };
  }

  // "Earn 10% back on purchases, up to a total of $20" / Chase "10% cash back".
  const percent = /(\d+(?:\.\d+)?)\s*%\s*(?:cash\s*)?back/i.exec(text);
  if (percent) {
    const cap = total ?? new RegExp(String.raw`up to ${MONEY}`, "i").exec(text);
    return { rate: Number(percent[1]) / 100, maxCents: cap ? dollars(cap[1]!) : null };
  }
  return null;
}

/** True for offers that pay back under WEAK_RATE; unscored offers are not weak. */
export function isWeakOffer(details: string): boolean {
  const ret = offerReturn(details);
  return ret !== null && ret.rate < WEAK_RATE;
}

/** "20% back", "100% back", "12% back" — whole percent, rounded down below 1%. */
export function rateLabel(rate: number): string {
  const pct = rate * 100;
  return `${pct >= 1 ? Math.round(pct) : pct.toFixed(1)}% back`;
}
