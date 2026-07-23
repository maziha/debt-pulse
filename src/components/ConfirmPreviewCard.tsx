import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { savePayment, saveIncome, markHistory } from "@/lib/data";
import { formatINR } from "@/lib/currency";
import { PAYMENT_CATEGORIES } from "@/lib/mediums";

export type ParsedEntry = {
  kind: "payment" | "income" | "payment_log";
  name?: string;
  amount?: number;
  currency?: string;
  category?: string | null;
  payment_type?: "recurring" | "one_time" | null;
  frequency?: string | null;
  day_of_month?: number | null;
  custom_dates?: string[] | null;
  start_date?: string | null;
  end_date?: string | null;
  linked_entity?: string | null;
  interest_rate?: number | null;
  principal_amount?: number | null;
  notes?: string | null;
  income_source?: string | null;
  income_frequency?: "monthly" | "one_time" | "weekly" | "yearly" | null;
  date_received?: string | null;
  clarification_needed?: string[];
};

export function ConfirmPreviewCard({
  entries,
  rawInput,
  onDone,
  onCancel,
}: {
  entries: ParsedEntry[];
  rawInput: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<ParsedEntry[]>(entries);
  const [saving, setSaving] = useState(false);

  function update(i: number, patch: Partial<ParsedEntry>) {
    setItems((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  async function saveAll() {
    setSaving(true);
    try {
      for (const e of items) {
        if (e.kind === "income") {
          await saveIncome({
            source: e.income_source ?? e.name ?? "Income",
            amount: Number(e.amount ?? 0),
            frequency: e.income_frequency ?? "one_time",
            date_received: e.date_received ?? new Date().toISOString().slice(0, 10),
            notes: e.notes ?? null,
          });
        } else if (e.kind === "payment_log") {
          // Best-effort: create a one-time expense entry marked as paid.
          const paymentId = await savePayment({
            name: e.name ?? "Payment",
            amount: Number(e.amount ?? 0),
            currency: e.currency ?? "INR",
            category: e.category ?? "one_time_expense",
            payment_type: "one_time",
            start_date: e.start_date ?? new Date().toISOString().slice(0, 10),
            end_date: e.start_date ?? new Date().toISOString().slice(0, 10),
            end_date_confirmed: true,
            status: "completed",
            linked_entity: e.linked_entity ?? null,
            notes: e.notes ?? null,
            created_from: "natural_language",
            raw_input: rawInput,
          } as any);
          await markHistory({
            payment_id: paymentId,
            due_date: e.start_date ?? new Date().toISOString().slice(0, 10),
            amount_due: Number(e.amount ?? 0),
            amount_paid: Number(e.amount ?? 0),
            paid_date: new Date().toISOString().slice(0, 10),
            status: "paid",
          });
        } else {
          await savePayment({
            name: e.name ?? "Untitled",
            amount: Number(e.amount ?? 0),
            currency: e.currency ?? "INR",
            category: e.category ?? "recurring_expense",
            payment_type: e.payment_type ?? (e.frequency ? "recurring" : "one_time"),
            frequency: e.frequency ?? null,
            day_of_month: e.day_of_month ?? null,
            custom_dates: (e.custom_dates ?? []) as any,
            start_date: e.start_date ?? null,
            end_date: e.end_date ?? null,
            end_date_confirmed: !!e.end_date,
            status: "active",
            linked_entity: e.linked_entity ?? null,
            interest_rate: e.interest_rate ?? null,
            principal_amount: e.principal_amount ?? null,
            outstanding_balance: e.principal_amount ?? null,
            notes: e.notes ?? null,
            created_from: "natural_language",
            raw_input: rawInput,
          } as any);
        }
      }
      toast.success(`Saved ${items.length} ${items.length === 1 ? "entry" : "entries"}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 border-primary/30">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-display text-base font-medium">Here's what I understood</div>
          <p className="text-xs text-muted-foreground mt-0.5">Confirm or edit before saving.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel"><X className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-4">
        {items.map((e, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-3 bg-background/50">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="uppercase text-[10px]">{e.kind}</Badge>
              {e.clarification_needed?.includes("end_date") && (
                <Badge variant="outline" className="border-warning text-warning">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Needs end date
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={e.name ?? ""} onChange={(ev) => update(i, { name: ev.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Amount (₹)</Label>
                <Input type="number" value={e.amount ?? ""} onChange={(ev) => update(i, { amount: Number(ev.target.value) })} />
              </div>
              {e.kind === "payment" && (
                <>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={e.category ?? "recurring_expense"} onValueChange={(v) => update(i, { category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Day of month</Label>
                    <Input type="number" min={1} max={31} value={e.day_of_month ?? ""} onChange={(ev) => update(i, { day_of_month: ev.target.value ? Number(ev.target.value) : null })} />
                  </div>
                  <div>
                    <Label className="text-xs">Start date</Label>
                    <Input type="date" value={e.start_date ?? ""} onChange={(ev) => update(i, { start_date: ev.target.value || null })} />
                  </div>
                  <div>
                    <Label className="text-xs">End date {!e.end_date && <span className="text-warning">(missing)</span>}</Label>
                    <Input type="date" value={e.end_date ?? ""} onChange={(ev) => update(i, { end_date: ev.target.value || null })} />
                  </div>
                </>
              )}
              {e.kind === "income" && (
                <div className="sm:col-span-2">
                  <Label className="text-xs">Date received</Label>
                  <Input type="date" value={e.date_received ?? ""} onChange={(ev) => update(i, { date_received: ev.target.value })} />
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Preview: {e.name ?? "—"} · {formatINR(Number(e.amount ?? 0))}
              {e.day_of_month ? ` · every ${e.day_of_month}th` : ""}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Discard</Button>
        <Button onClick={saveAll} disabled={saving}>
          <Check className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : `Save ${items.length}`}
        </Button>
      </div>
    </Card>
  );
}
