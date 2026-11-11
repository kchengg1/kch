import { Input, Label } from "@kch/ui";
import { CADENCES, CADENCE_LABEL } from "@/lib/periods";

const select =
  "flex h-10 w-full rounded-[var(--radius)] border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

type Values = {
  name: string;
  cadence: string;
  amountCents: number;
  notes: string;
  enrollRequired: boolean;
  endsOn: string | null;
};

/** Inputs shared by the add-benefit and edit-benefit forms. `prefix` keeps ids unique. */
export function BenefitFields({ prefix, values }: { prefix: string; values?: Values }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px_120px]">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-name`}>Benefit</Label>
          <Input id={`${prefix}-name`} name="name" defaultValue={values?.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-cadence`}>Resets</Label>
          <select
            id={`${prefix}-cadence`}
            name="cadence"
            className={select}
            defaultValue={values?.cadence ?? "monthly"}
          >
            {CADENCES.map((c) => (
              <option key={c} value={c}>
                {CADENCE_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-amount`}>$ per period</Label>
          <Input
            id={`${prefix}-amount`}
            name="amount"
            inputMode="decimal"
            defaultValue={values ? String(values.amountCents / 100) : ""}
            placeholder="10"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-notes`}>How to use it</Label>
          <Input id={`${prefix}-notes`} name="notes" defaultValue={values?.notes} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-endsOn`}>Ends (limited-time only)</Label>
          <Input
            id={`${prefix}-endsOn`}
            name="endsOn"
            type="date"
            defaultValue={values?.endsOn ?? ""}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enrollRequired" defaultChecked={values?.enrollRequired} />{" "}
        Needs enrollment or activation
      </label>
    </>
  );
}
