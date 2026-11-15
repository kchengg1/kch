/**
 * Offers available to other people in the group: everything on their cards as
 * of their last paste, whatever they decided to do with it themselves. Perks is
 * limited to a small group (ALLOWED_EMAILS), so everyone signed in can see
 * these, read-only. Pure, so it can be tested without a database.
 */
import { groupOffers, merchantKey, type OfferGroup, type OfferLike } from "./offer-groups";
import { offerReturn } from "./offer-value";

export type Person = { id: string; name: string };

/**
 * Offers still on the card: not used and not past their expiry. Skipped offers
 * and merchants the owner hid count, since they can still be used.
 */
export const isOnCard = (o: OfferLike, today: string) =>
  o.status !== "used" && (o.expiresOn === null || o.expiresOn >= today);

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name || "Someone";

export type PersonOffers<T extends OfferLike> = {
  id: string;
  firstName: string;
  /** When they last pasted an offers page for any card, if ever. */
  lastPastedAt: Date | null;
  groups: (OfferGroup<T> & { rate: number | null; maxCents: number | null })[];
};

/**
 * Everyone except the viewer who has at least one offer on their cards, with their
 * offers grouped (one row per deal, listing the cards it is on) and sorted
 * best return first. People are sorted by first name.
 */
export function offersByPerson<T extends OfferLike & { userId: string }>(
  people: Person[],
  offers: T[],
  viewerId: string,
  today: string,
  cards: { userId: string; offersCheckedAt: Date | null }[] = [],
): PersonOffers<T>[] {
  return people
    .filter((p) => p.id !== viewerId)
    .map((p) => {
      const groups = groupOffers(offers.filter((o) => o.userId === p.id && isOnCard(o, today)))
        .map((g) => {
          const ret = offerReturn(g.details);
          return { ...g, rate: ret?.rate ?? null, maxCents: ret?.maxCents ?? g.valueCents };
        })
        .sort(
          (a, b) =>
            (b.rate ?? -1) - (a.rate ?? -1) ||
            (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"),
        );
      const lastPastedAt = cards
        .filter((c) => c.userId === p.id && c.offersCheckedAt)
        .reduce<Date | null>(
          (latest, c) => (!latest || c.offersCheckedAt! > latest ? c.offersCheckedAt : latest),
          null,
        );
      return { id: p.id, firstName: firstName(p.name), lastPastedAt, groups };
    })
    .filter((p) => p.groups.length > 0)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
}

/** Merchants the viewer has an offer for on their own cards, to flag ones they're missing. */
export const onCardMerchantKeys = (offers: OfferLike[], today: string) =>
  new Set(offers.filter((o) => isOnCard(o, today)).map((o) => merchantKey(o.merchant)));
