type Card = {
  id: string;
  name: string;
  closed: boolean;
  templateKey: string | null;
  issuer: string;
};
type Referral = { userId: string; templateKey: string | null; cardName: string };

/** Open catalog cards the user holds but hasn't shared a referral link for, one per card type. */
export function shareableCards<C extends Card>(
  cards: C[],
  referrals: Referral[],
  userId: string,
): C[] {
  const shared = new Set(
    referrals.filter((r) => r.userId === userId && r.templateKey).map((r) => r.templateKey),
  );
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (c.closed || !c.templateKey || shared.has(c.templateKey) || seen.has(c.templateKey))
      return false;
    seen.add(c.templateKey);
    return true;
  });
}

/** Links other people shared for a given card type. */
export function friendsLinksFor<R extends Referral>(
  referrals: R[],
  templateKey: string | null,
  userId: string,
): R[] {
  return templateKey
    ? referrals.filter((r) => r.userId !== userId && r.templateKey === templateKey)
    : [];
}
