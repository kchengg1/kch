import { getTemplate, type TemplateBenefit } from "./catalog";

type ExistingBenefit = {
  id: string;
  name: string;
  cadence: string;
  amountCents: number;
  endsOn: string | null;
};

export type CatalogChange<B extends ExistingBenefit = ExistingBenefit> = {
  benefit: B;
  template: TemplateBenefit;
};

const centsOf = (t: TemplateBenefit) =>
  t.cadence === "perk" ? 0 : Math.round((t.amount ?? 0) * 100);

/**
 * What the catalog now says about a card that the card's own rows don't:
 * benefits added since the card was set up, and same-named benefits whose
 * amount, reset schedule or end date changed. Notes are left out, since
 * people edit those.
 */
export function catalogUpdates<B extends ExistingBenefit>(
  templateKey: string | null | undefined,
  benefits: B[],
): { added: TemplateBenefit[]; changed: CatalogChange<B>[] } {
  const template = getTemplate(templateKey);
  if (!template) return { added: [], changed: [] };
  const byName = new Map(benefits.map((b) => [b.name.trim().toLowerCase(), b]));
  const added: TemplateBenefit[] = [];
  const changed: CatalogChange<B>[] = [];
  for (const t of template.benefits) {
    const existing = byName.get(t.name.trim().toLowerCase());
    if (!existing) added.push(t);
    else if (
      existing.cadence !== t.cadence ||
      existing.amountCents !== centsOf(t) ||
      (existing.endsOn ?? null) !== (t.endsOn ?? null)
    )
      changed.push({ benefit: existing, template: t });
  }
  return { added, changed };
}

export function templateRow(t: TemplateBenefit) {
  return {
    name: t.name,
    cadence: t.cadence,
    amountCents: centsOf(t),
    notes: t.notes ?? "",
    enrollRequired: t.enroll ?? false,
    endsOn: t.endsOn ?? null,
  };
}
