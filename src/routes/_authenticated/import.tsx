import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { bulkImport, listPayments, listIncome, listCreditCards } from "@/lib/data";
import { csvToImportBundle, CSV_TEMPLATE } from "@/lib/csv";
import { buildDueDatesIcs, downloadTextFile } from "@/lib/ics";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "Import & export — DebtPulse" },
      { name: "description", content: "Bulk import or export DebtPulse entries as JSON, CSV, or calendar ICS." },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<{ payments?: any[]; income?: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"json" | "csv">("json");

  function parseJson() {
    setError(null);
    setPreview(null);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPreview({ payments: parsed });
      } else if (parsed && (parsed.payments || parsed.income)) {
        setPreview({ payments: parsed.payments ?? [], income: parsed.income ?? [] });
      } else {
        setError("Expected an array of entries, or an object with 'payments' and/or 'income' arrays.");
      }
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function parseCsv() {
    setError(null);
    setPreview(null);
    try {
      const bundle = csvToImportBundle(raw);
      setPreview(bundle);
      setMode("csv");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function doImport() {
    if (!preview) return;
    setBusy(true);
    try {
      const n = await bulkImport(preview);
      toast.success(`Imported ${n} ${n === 1 ? "entry" : "entries"}`);
      setRaw("");
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function doExportJson() {
    try {
      const [payments, income] = await Promise.all([listPayments(), listIncome()]);
      downloadTextFile(
        `debtpulse-export-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify({ payments, income }, null, 2),
        "application/json",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function doExportIcs() {
    try {
      const [payments, cards] = await Promise.all([listPayments(), listCreditCards()]);
      const ics = buildDueDatesIcs(payments, cards, 3);
      downloadTextFile(
        `debtpulse-dues-${new Date().toISOString().slice(0, 10)}.ics`,
        ics,
        "text/calendar",
      );
      toast.success("ICS downloaded — import into Google Calendar or Apple Calendar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Calendar export failed");
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setRaw(text);
    setPreview(null);
    setError(null);
    const name = f.name.toLowerCase();
    if (name.endsWith(".csv") || f.type.includes("csv")) {
      setMode("csv");
    } else {
      setMode("json");
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Import & export</h1>
          <p className="text-sm text-muted-foreground mt-1">JSON, CSV, or calendar ICS for Google / Apple Calendar.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
            <CardDescription>JSON backup, or ICS due dates (next 3 months) for calendar apps.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={doExportJson}>Download JSON</Button>
            <Button variant="outline" onClick={doExportIcs}>Download ICS calendar</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import from JSON or CSV</CardTitle>
            <CardDescription>
              Structured DebtPulse CSV, or a bank statement with date / description / amount (or debit &amp; credit).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="file"
              accept=".json,.csv,application/json,text/csv"
              onChange={handleFile}
              className="text-sm"
            />
            <Textarea
              rows={8}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={mode === "csv" ? CSV_TEMPLATE : '[ { "name": "Cred EMI", "amount": 20000, "category": "debt_emi", "payment_type": "recurring", "frequency": "monthly", "day_of_month": 7 } ]'}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRaw(CSV_TEMPLATE); setMode("csv"); setPreview(null); }}>
                Load CSV template
              </Button>
            </div>
            {error && <div className="text-sm text-deficit">{error}</div>}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={parseJson} disabled={!raw.trim()}>Preview JSON</Button>
              <Button variant="outline" onClick={parseCsv} disabled={!raw.trim()}>Preview CSV</Button>
              {preview && (
                <Button onClick={doImport} disabled={busy}>
                  {busy ? "Importing…" : `Import ${(preview.payments?.length ?? 0) + (preview.income?.length ?? 0)} entries`}
                </Button>
              )}
            </div>
            {preview && (
              <div className="text-sm text-muted-foreground rounded border border-border p-3 bg-muted/30">
                Ready to import: {preview.payments?.length ?? 0} payments, {preview.income?.length ?? 0} income entries.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
