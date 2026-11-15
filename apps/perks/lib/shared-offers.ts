/**
 * Offers other people in the group have saved. Perks is limited to a small
 * group (ALLOWED_EMAILS), so everyone signed in can see everyone's live offers,
 * read-only. Pure, so it can be tested without a database.
 */
import { groupOffers, merchantKey, type OfferGroup, type OfferLike } from "./offer-groups";
import { offerReturn } from "./offer-value";

export type Person = { id: string; name: string };

/** Offers still worth showing: not used, skipped or past their expiry. */
export const isLive = (o: OfferLike, today: string) =>
  (o.status === "available" || o.status === "added") &&
  (o.expiresOn === null || o.expiresOn >= today);

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name || "Someone";

export type PersonOffers<T extends OfferLike> = {
  id: string;
  firstName: string;
  groups: (OfferGroup<T> & { rate: number | null; maxCents: number | null })[];
};

/**
 * Everyone except the viewer who has at least one live offer, with their
 * offers grouped (one row per deal, listing the cards it is on) and sorted
 * best return first. People are sorted by first name.
 */
export function offersByPerson<T extends OfferLike & { userId: string }>(
  people: Person[],
  offers: T[],
  viewerId: string,
  today: string,
): PersonOffers<T>[] {
  return people
    .filter((p) => p.id !== viewerId)
    .map((p) => {
      const groups = groupOffers(offers.filter((o) => o.userId === p.id && isLive(o, today)))
        .map((g) => {
          const ret = offerReturn(g.details);
          return { ...g, rate: ret?.rate ?? null, maxCents: ret?.maxCents ?? g.valueCents };
        })
        .sort(
          (a, b) =>
            (b.rate ?? -1) - (a.rate ?? -1) ||
            (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"),
        );
      return { id: p.id, firstName: firstName(p.name), groups };
    })
    .filter((p) => p.groups.length > 0)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
}

/** Merchants the viewer already has a live offer for, to flag ones they're missing. */
export const liveMerchantKeys = (offers: OfferLike[], today: string) =>
  new Set(offers.filter((o) => isLive(o, today)).map((o) => merchantKey(o.merchant)));
