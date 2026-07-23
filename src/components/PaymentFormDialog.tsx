import { useEffect, useState } from "react";
import { ResponsiveFormShell } from "@/components/ResponsiveFormShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { savePayment, listPaymentAudit, type PaymentAuditRow } from "@/lib/data";
import type { Payment } from "@/lib/date-utils";
import { PAYMENT_CATEGORIES, PAYMENT_METHODS } from "@/lib/mediums";
import { fmtDate } from "@/lib/date-utils";

const EMPTY_FORM: Partial<Payment> = {
  name: "",
  amount: 0,
  currency: "INR",
  category: "debt_emi",
  payment_type: "recurring",
  frequency: "monthly",
  day_of_month: 1,
  status: "active",
  end_date_confirmed: false,
  payment_method: null,
  credit_card_id: null,
};

function formFromInitial(initial?: Partial<Payment>): Partial<Payment> {
  if (!initial) return { ...EMPTY_FORM };
  return {
    ...EMPTY_FORM,
    ...initial,
    amount: initial.amount != null ? Number(initial.amount) : 0,
    day_of_month: initial.day_of_month != null ? Number(initial.day_of_month) : null,
    interest_rate: initial.interest_rate != null ? Number(initial.interest_rate) : null,
    principal_amount: initial.principal_amount != null ? Number(initial.principal_amount) : null,
    outstanding_balance: initial.outstanding_balance != null ? Number(initial.outstanding_balance) : null,
  };
}

export function PaymentFormDialog({
  open,
  onOpenChange,
  onSaved,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  initial?: Partial<Payment>;
}) {
  const [tab, setTab] = useState<"recurring" | "one_time">("recurring");
  const [form, setForm] = useState<Partial<Payment>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState<PaymentAuditRow[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = formFromInitial(initial);
    setForm(next);
    setTab(next.payment_type === "one_time" ? "one_time" : "recurring");
    setAudit([]);
    setAuditOpen(false);
    if (initial?.id) {
      listPaymentAudit(initial.id)
        .then(setAudit)
        .catch(() => setAudit([]));
    }
  }, [open, initial]);

  function upd<K extends keyof Payment>(k: K, v: Payment[K] | null) {
    setForm((f) => ({ ...f, [k]: v as unknown as Payment[K] }));
  }

  const customDates: string[] = Array.isArray(form.custom_dates) ? (form.custom_dates as string[]) : [];
  function addCustomDate() {
    upd("custom_dates", [...customDates, ""] as unknown as Payment["custom_dates"]);
  }
  function updateCustomDate(i: number, v: string) {
    const next = customDates.slice();
    next[i] = v;
    upd("custom_dates", next as unknown as Payment["custom_dates"]);
  }
  function removeCustomDate(i: number) {
    upd("custom_dates", customDates.filter((_, idx) => idx !== i) as unknown as Payment["custom_dates"]);
  }

  async function save() {
    if (!form.name || !form.amount || !form.category) {
      toast.error("Name, amount and category are required");
      return;
    }
    if (tab === "recurring" && form.frequency === "custom" && customDates.filter(Boolean).length === 0) {
      toast.error("Add at least one custom due date");
      return;
    }
    setSaving(true);
    try {
      await savePayment({
        ...form,
        payment_type: tab,
        end_date_confirmed: !!form.end_date,
        custom_dates: tab === "recurring" && form.frequency === "custom" ? customDates.filter(Boolean) : [],
      } as any);
      toast.success("Saved");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveFormShell
      open={open}
      onOpenChange={onOpenChange}
      title={initial?.id ? "Edit entry" : "Add entry"}
      description="All fields except name, amount and category are optional."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </>
      }
    >
        <Tabs value={tab} onValueChange={(v) => setTab(v as "recurring" | "one_time")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="recurring">Recurring</TabsTrigger>
            <TabsTrigger value="one_time">One-time</TabsTrigger>
          </TabsList>
          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Name</Label>
                <Input value={form.name ?? ""} onChange={(e) => upd("name", e.target.value)} placeholder="e.g. Cred EMI" />
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" value={form.amount ?? ""} onChange={(e) => upd("amount", Number(e.target.value) as unknown as Payment["amount"])} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category ?? "debt_emi"} onValueChange={(v) => upd("category", v as Payment["category"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Payment method</Label>
                <Select
                  value={form.payment_method ?? "none"}
                  onValueChange={(v) => upd("payment_method", (v === "none" ? null : v) as Payment["payment_method"])}
                >
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <TabsContent value="recurring" className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 m-0">
                <div>
                  <Label>Frequency</Label>
                  <Select value={form.frequency ?? "monthly"} onValueChange={(v) => upd("frequency", v as Payment["frequency"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">Custom dates</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.frequency === "monthly" && (
                  <div>
                    <Label>Day of month</Label>
                    <Input type="number" min={1} max={31} value={form.day_of_month ?? ""} onChange={(e) => upd("day_of_month", e.target.value ? Number(e.target.value) : null)} />
                  </div>
                )}
                <div>
                  <Label>Start date{(form.frequency === "weekly" || form.frequency === "yearly") && " (anchors the cadence)"}</Label>
                  <Input type="date" value={form.start_date ?? ""} onChange={(e) => upd("start_date", e.target.value || null)} />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input type="date" value={form.end_date ?? ""} onChange={(e) => upd("end_date", e.target.value || null)} />
                </div>
                {form.frequency === "custom" && (
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Custom due dates</Label>
                    <div className="space-y-2">
                      {customDates.map((d, i) => (
                        <div key={i} className="flex gap-2">
                          <Input type="date" value={d} onChange={(e) => updateCustomDate(i, e.target.value)} />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomDate(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addCustomDate}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Add date
                    </Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="one_time" className="sm:col-span-2 m-0">
                <Label>Due date</Label>
                <Input type="date" value={form.start_date ?? ""} onChange={(e) => { upd("start_date", e.target.value || null); upd("end_date", e.target.value || null); }} />
              </TabsContent>
              <div>
                <Label>Linked entity</Label>
                <Input value={form.linked_entity ?? ""} onChange={(e) => upd("linked_entity", e.target.value || null)} placeholder="Optional" />
              </div>
              <div>
                <Label>Tag (person)</Label>
                <Input value={form.tag ?? ""} onChange={(e) => upd("tag", e.target.value || null)} placeholder="me / together / …" />
              </div>
              <div>
                <Label>Interest rate (%)</Label>
                <Input type="number" step="0.01" value={form.interest_rate ?? ""} onChange={(e) => upd("interest_rate", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <Label>Principal (₹)</Label>
                <Input type="number" value={form.principal_amount ?? ""} onChange={(e) => upd("principal_amount", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Outstanding balance (₹)</Label>
                <Input type="number" value={form.outstanding_balance ?? ""} onChange={(e) => upd("outstanding_balance", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes ?? ""} onChange={(e) => upd("notes", e.target.value || null)} rows={2} />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <Switch checked={!!form.end_date_confirmed} onCheckedChange={(v) => upd("end_date_confirmed", v as unknown as Payment["end_date_confirmed"])} id="edc" />
                <Label htmlFor="edc" className="text-xs">End date is confirmed / intentional</Label>
              </div>
              {initial?.id && (
                <div className="sm:col-span-2 rounded border border-border p-3 space-y-2">
                  <button
                    type="button"
                    className="text-sm font-medium w-full text-left flex justify-between"
                    onClick={() => setAuditOpen((v) => !v)}
                  >
                    Change history
                    <span className="text-xs text-muted-foreground">{audit.length} {audit.length === 1 ? "change" : "changes"}</span>
                  </button>
                  {auditOpen && (
                    audit.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No edits recorded yet. Changes you save will appear here.</p>
                    ) : (
                      <ul className="max-h-40 overflow-y-auto divide-y divide-border text-xs">
                        {audit.map((a) => (
                          <li key={a.id} className="py-1.5">
                            <span className="text-muted-foreground">{fmtDate(a.created_at)}</span>
                            {" · "}
                            <span className="font-medium">{a.field.replace(/_/g, " ")}</span>
                            {": "}
                            <span className="line-through text-muted-foreground">{a.old_value ?? "—"}</span>
                            {" → "}
                            <span>{a.new_value ?? "—"}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </Tabs>
    </ResponsiveFormShell>
  );
}
