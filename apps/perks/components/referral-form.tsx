import { Input, Label } from "@kch/ui";
import { addReferralAction } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/action-form";
import { CATALOG } from "@/lib/catalog";

const select =
  "flex h-10 w-full rounded-[var(--radius)] border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

/** Share a referral link with the group. Your own cards are listed first. */
export function ReferralForm({
  myTemplateKeys,
  defaultKey,
}: {
  myTemplateKeys: string[];
  /** Card to preselect, such as one picked from "Ready to share". */
  defaultKey?: string;
}) {
  const mine = CATALOG.filter((t) => myTemplateKeys.includes(t.key));
  const others = CATALOG.filter((t) => !myTemplateKeys.includes(t.key));
  return (
    <ActionForm action={addReferralAction} submit="Share link" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ref-card">Card</Label>
          <select
            id="ref-card"
            name="card"
            className={select}
            key={defaultKey}
            defaultValue={defaultKey ?? mine[0]?.key ?? ""}
          >
            {mine.length > 0 && (
              <optgroup label="Your cards">
                {mine.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Other cards">
              {others.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
              <option value="">Another card (name it)</option>
            </optgroup>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ref-card-name">Card name, if not listed</Label>
          <Input id="ref-card-name" name="cardName" placeholder="Bilt Mastercard" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ref-url">Referral link</Label>
          <Input
            id="ref-url"
            name="url"
            type="url"
            inputMode="url"
            placeholder="https://americanexpress.com/en-us/referral/..."
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ref-reward">What you earn (optional)</Label>
          <Input id="ref-reward" name="reward" placeholder="15,000 points per approval" />
        </div>
      </div>
    </ActionForm>
  );
}
