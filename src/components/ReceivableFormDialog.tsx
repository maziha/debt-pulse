import { useEffect, useState } from "react";
import { ResponsiveFormShell } from "@/components/ResponsiveFormShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { saveReceivable } from "@/lib/data";
import { RECEIVABLE_KINDS, type Receivable } from "@/lib/mediums";
import type { Payment } from "@/lib/date-utils";

export function ReceivableFormDialog({
  open,
  onOpenChange,
  onSaved,
  initial,
  chitPayments = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  initial?: Receivable;
  /** Active chit_fund payments — used to link a payout to its contribution. */
  chitPayments?: Payment[];
}) {
  const [form, setForm] = useState<Partial<Receivable>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? { ...initial } : {
      kind: "peer_loan",
      name: "",
      person: null,
      amount: 0,
      expected_date: null,
      status: "pending",
      amount_received: null,
      received_date: null,
      linked_payment_id: null,
      notes: null,
      tag: null,
    });
  }, [open, initial]);

  async function save() {
    if (!form.kind || !form.name || !form.amount) {
      toast.error("Kind, name and amount are required");
      return;
    }
    setSaving(true);
    try {
      await saveReceivable({
        id: form.id,
        kind: form.kind,
        name: form.name,
        person: form.person ?? null,
        amount: Number(form.amount),
        expected_date: form.expected_date || null,
        status: form.status ?? "pending",
        amount_received: form.amount_received != null ? Number(form.amount_received) : null,
        received_date: form.received_date || null,
        linked_payment_id: form.linked_payment_id || null,
        notes: form.notes ?? null,
        tag: form.tag ?? null,
      });
      toast.success("Receivable saved");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveFormShell
      open={open}
      onOpenChange={onOpenChange}
      title={initial?.id ? "Edit receivable" : "Add receivable"}
      description="Money owed to you — peer loans or your chit fund payout month."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </>
      }
    >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Kind</Label>
            <Select value={form.kind ?? "peer_loan"} onValueChange={(v) => setForm({ ...form, kind: v as Receivable["kind"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RECEIVABLE_KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Name</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.kind === "chit_payout" ? "July chit payout" : "Loan to Ravi"} />
          </div>
          <div>
            <Label>{form.kind === "chit_payout" ? "Organiser / fund" : "Person"}</Label>
            <Input value={form.person ?? ""} onChange={(e) => setForm({ ...form, person: e.target.value || null })} />
          </div>
          <div>
            <Label>Expected date</Label>
            <Input type="date" value={form.expected_date ?? ""} onChange={(e) => setForm({ ...form, expected_date: e.target.value || null })} />
          </div>
          {form.kind === "chit_payout" && chitPayments.length > 0 && (
            <div className="sm:col-span-2">
              <Label>Linked chit contribution</Label>
              <Select
                value={form.linked_payment_id ?? "none"}
                onValueChange={(v) => setForm({ ...form, linked_payment_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {chitPayments.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} · ₹{Number(p.amount).toLocaleString("en-IN")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Status</Label>
            <Select value={form.status ?? "pending"} onValueChange={(v) => setForm({ ...form, status: v as Receivable["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="written_off">Written off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount received (₹)</Label>
            <Input type="number" value={form.amount_received ?? ""} onChange={(e) => setForm({ ...form, amount_received: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} />
          </div>
        </div>
    </ResponsiveFormShell>
  );
}
