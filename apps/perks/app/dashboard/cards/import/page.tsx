import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@kch/ui";
import { SheetImport } from "@/components/sheet-import";
import { importSheetAction } from "../../actions";

export const metadata: Metadata = { title: "Import cards" };

export default function ImportPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/cards"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Cards
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Import cards</h1>
      </div>
      <Card>
        <CardTitle>Paste your cards</CardTitle>
        <CardDescription className="mt-1">
          Either paste a plain list, one card per line, like &ldquo;Chase Sapphire Preferred&rdquo;
          or &ldquo;Amex Gold, 2/2024&rdquo; with the month you opened it. Or, if you track cards in
          a spreadsheet, copy the whole sheet with its header row; the columns read are Card Name,
          Approval Date, Closed/PC Date, Annual Fee, Bank, Card Type and Closed. Opened dates make
          cardmember-year credits, fee reminders and bonus eligibility accurate, and can be added
          later on each card&rsquo;s page. Importing again only adds cards that are new.
        </CardDescription>
        <div className="mt-4">
          <SheetImport action={importSheetAction} />
        </div>
      </Card>
    </div>
  );
}
