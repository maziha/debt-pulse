import { useEffect, useState } from "react";
import { ResponsiveFormShell } from "@/components/ResponsiveFormShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { saveCreditCard } from "@/lib/data";
import type { CreditCard } from "@/lib/mediums";

export function CreditCardFormDialog({
  open,
  onOpenChange,
  onSaved,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  initial?: CreditCard;
}) {
  const [form, setForm] = useState<Partial<CreditCard>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? { ...initial } : {
      bank_name: "",
      card_name: "",
      last4: null,
      credit_limit: 0,
      outstanding_balance: 0,
      statement_day: 1,
      due_day: 5,
      apr: null,
      status: "active",
      notes: null,
      tag: null,
    });
  }, [open, initial]);

  async function save() {
    if (!form.bank_name || !form.card_name || !form.due_day) {
      toast.error("Bank, card name, and due day are required");
      return;
    }
    setSaving(true);
    try {
      await saveCreditCard({
        id: form.id,
        bank_name: form.bank_name,
        card_name: form.card_name,
        last4: form.last4 || null,
        credit_limit: Number(form.credit_limit ?? 0),
        outstanding_balance: Number(form.outstanding_balance ?? 0),
        statement_day: form.statement_day ? Number(form.statement_day) : null,
        due_day: Number(form.due_day),
        apr: form.apr != null && form.apr !== ("" as any) ? Number(form.apr) : null,
        status: form.status ?? "active",
        notes: form.notes ?? null,
        tag: form.tag ?? null,
      });
      toast.success("Card saved");
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
      title={initial?.id ? "Edit credit card" : "Add credit card"}
      description="Track limit, outstanding, statement day, and bill due day."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </>
      }
    >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Bank</Label>
            <Input value={form.bank_name ?? ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="HDFC" />
          </div>
          <div>
            <Label>Card name</Label>
            <Input value={form.card_name ?? ""} onChange={(e) => setForm({ ...form, card_name: e.target.value })} placeholder="Regalia" />
          </div>
          <div>
            <Label>Last 4 digits</Label>
            <Input maxLength={4} value={form.last4 ?? ""} onChange={(e) => setForm({ ...form, last4: e.target.value || null })} />
          </div>
          <div>
            <Label>APR (%)</Label>
            <Input type="number" step="0.01" value={form.apr ?? ""} onChange={(e) => setForm({ ...form, apr: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <Label>Credit limit (₹)</Label>
            <Input type="number" value={form.credit_limit ?? ""} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Outstanding (₹)</Label>
            <Input type="number" value={form.outstanding_balance ?? ""} onChange={(e) => setForm({ ...form, outstanding_balance: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Statement day</Label>
            <Input type="number" min={1} max={31} value={form.statement_day ?? ""} onChange={(e) => setForm({ ...form, statement_day: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <Label>Bill due day</Label>
            <Input type="number" min={1} max={31} value={form.due_day ?? ""} onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Tag</Label>
            <Input value={form.tag ?? ""} onChange={(e) => setForm({ ...form, tag: e.target.value || null })} placeholder="me / together / …" />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} />
          </div>
        </div>
    </ResponsiveFormShell>
  );
}
