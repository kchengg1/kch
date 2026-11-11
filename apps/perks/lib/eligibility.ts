import { addDays, formatDate } from "./periods";

/**
 * Rough sign-up bonus eligibility from card history. These are the published
 * and widely observed issuer rules, not a guarantee: the issuer decides.
 */
export type HistoryCard = {
  name: string;
  issuer: string;
  business: boolean;
  templateKey: string | null;
  openedOn: string | null;
  closed: boolean;
};

export type BonusOffer = {
  id: string;
  card: string;
  issuer: string;
  business: boolean;
  /** Headline bonus, e.g. "100,000 points". */
  bonus: string;
  /** Spend requirement, e.g. "$6,000 in 3 months". */
  spend: string | null;
  annualFee: number;
  /** Estimated bonus value in dollars at the owner's point valuations. */
  estValue: number | null;
  note?: string;
  url?: string;
  /** Regex source matched against card names to find past or current holdings. */
  match: string;
  templateKey?: string;
  /** "No lifetime language": past cardholders can still earn the bonus. */
  noLifetimeLanguage?: boolean;
  /** True when the offer is above the card's usual bonus. */
  elevated?: boolean;
};

export type Verdict = {
  status: "eligible" | "caution" | "ineligible";
  reasons: string[];
};

/** Personal cards opened in the 24 months up to today (Chase's 5/24 rule). */
export function fiveTwentyFour(cards: HistoryCard[], today: string): number {
  const cutoff = addDays(today, -730);
  return cards.filter(
    (c) => !c.business && c.openedOn && c.openedOn > cutoff && c.openedOn <= today,
  ).length;
}

export function checkEligibility(offer: BonusOffer, cards: HistoryCard[], today: string): Verdict {
  const pattern = new RegExp(offer.match, "i");
  const matching = cards.filter(
    (c) => (offer.templateKey && c.templateKey === offer.templateKey) || pattern.test(c.name),
  );
  const held = matching.filter((c) => !c.closed);
  const had = matching.filter((c) => c.closed);
  const lastHad = had
    .map((c) => c.openedOn)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();
  const hadText = lastHad ? ` (last opened ${formatDate(lastHad)})` : "";
  const issuer = offer.issuer.toLowerCase();
  const reasons: string[] = [];
  let status: Verdict["status"] = "eligible";
  const raise = (to: Verdict["status"], reason: string) => {
    if (to === "ineligible" || status === "eligible") status = to;
    reasons.push(reason);
  };

  if (held.length > 0) raise("ineligible", `You currently hold ${held[0]!.name}.`);

  if (issuer.includes("american express")) {
    if (matching.length > 0 && offer.noLifetimeLanguage) {
      raise(
        held.length ? "ineligible" : "caution",
        "This offer has no lifetime language, so past cardholders can qualify. Watch for the pop-up before submitting.",
      );
    } else if (had.length > 0) {
      raise(
        "ineligible",
        `Amex welcome offers are once per lifetime per card, and you had this one${hadText}.`,
      );
    }
  } else if (issuer.includes("chase")) {
    const count = fiveTwentyFour(cards, today);
    if (count >= 5) raise("ineligible", `You are at ${count}/24. Chase declines at 5 or more.`);
    else reasons.push(`You are at ${count}/24, under Chase's limit of 5.`);
    if (had.length > 0) {
      raise(
        "caution",
        `You had this card before${hadText}. Chase limits bonuses for past cardholders, so read the offer terms.`,
      );
    }
  } else if (issuer.includes("capital one")) {
    const recent = cards.some(
      (c) => /capital one/i.test(c.issuer) && c.openedOn && c.openedOn > addDays(today, -183),
    );
    if (recent) raise("caution", "Capital One usually approves one card every six months.");
    if (had.length > 0) {
      raise(
        "caution",
        `You had this card before${hadText}. Capital One often denies the bonus to past holders.`,
      );
    }
  } else if (had.length > 0) {
    raise("caution", `You had this card before${hadText}. Check the issuer's repeat-bonus rule.`);
  }

  if (reasons.length === 0) reasons.push("No conflicts with your card history.");
  return { status, reasons };
}
