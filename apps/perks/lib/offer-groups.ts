/**
 * The same offer is often listed on several cards (Amex shows most offers on
 * every card). Group identical offers so each appears once, with the cards
 * it is on. Pure, so it can be tested without a database.
 */
export type OfferLike = {
  id: string;
  cardId: string | null;
  merchant: string;
  details: string;
  valueCents: number | null;
  expiresOn: string | null;
  status: string;
};

export type OfferGroup<T extends OfferLike> = {
  key: string;
  merchant: string;
  details: string;
  valueCents: number | null;
  expiresOn: string | null;
  /** One entry per card the offer is on, in the order first seen. */
  items: T[];
};

/** Normalise merchant names so "Marriott Bonvoy®" and "Marriott Bonvoy" group together. */
const norm = (s: string) => s.toLowerCase().replace(/[®™©]/g, "").replace(/\s+/g, " ").trim();

export function groupOffers<T extends OfferLike>(offers: T[]): OfferGroup<T>[] {
  const groups = new Map<string, OfferGroup<T>>();
  for (const o of offers) {
    const key = `${norm(o.merchant)}|${norm(o.details)}|${o.expiresOn ?? ""}`;
    const g = groups.get(key);
    if (g) {
      g.items.push(o);
      // An added-card entry may lack deal text; prefer one that has it.
      if (!g.details && o.details)
        Object.assign(g, { details: o.details, valueCents: o.valueCents });
    } else {
      groups.set(key, {
        key,
        merchant: o.merchant,
        details: o.details,
        valueCents: o.valueCents,
        expiresOn: o.expiresOn,
        items: [o],
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999") ||
      a.merchant.localeCompare(b.merchant),
  );
}
