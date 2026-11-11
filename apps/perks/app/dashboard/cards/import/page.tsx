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
        <h1 className="mt-1 text-2xl font-bold">Import from spreadsheet</h1>
      </div>
      <Card>
        <CardTitle>Paste your Credit Cards tab</CardTitle>
        <CardDescription className="mt-1">
          In Google Sheets, open the Credit Cards tab, select everything (Ctrl/Cmd + A), copy, and
          paste below. The header row has to be included. The columns read are Card Name, Approval
          Date, Closed/PC Date, Annual Fee, Bank, Card Type and Closed. Importing again later only
          adds cards that are new.
        </CardDescription>
        <div className="mt-4">
          <SheetImport action={importSheetAction} />
        </div>
      </Card>
    </div>
  );
}
