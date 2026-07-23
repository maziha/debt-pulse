import { useEffect, useState } from "react";
import { ResponsiveFormShell } from "@/components/ResponsiveFormShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { saveInvestment } from "@/lib/data";
import { INVESTMENT_TYPES, type Investment } from "@/lib/mediums";

export function InvestmentFormDialog({
  open,
  onOpenChange,
  onSaved,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  initial?: Investment;
}) {
  const [form, setForm] = useState<Partial<Investment>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? { ...initial } : {
      name: "",
      type: "sip",
      current_value: 0,
      contribution_amount: null,
      contribution_frequency: "monthly",
      contribution_day: 1,
      start_date: null,
      maturity_date: null,
      notes: null,
      tag: null,
      status: "active",
    });
  }, [open, initial]);

  async function save() {
    if (!form.name || !form.type) {
      toast.error("Name and type are required");
      return;
    }
    setSaving(true);
    try {
      await saveInvestment({
        id: form.id,
        name: form.name,
        type: form.type,
        current_value: Number(form.current_value ?? 0),
        contribution_amount: form.contribution_amount != null ? Number(form.contribution_amount) : null,
        contribution_frequency: form.contribution_frequency ?? null,
        contribution_day: form.contribution_day != null ? Number(form.contribution_day) : null,
        start_date: form.start_date || null,
        maturity_date: form.maturity_date || null,
        notes: form.notes ?? null,
        tag: form.tag ?? null,
        status: form.status ?? "active",
      });
      toast.success("Investment saved");
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
      title={initial?.id ? "Edit investment" : "Add investment"}
      description="SIPs, FDs, RDs, PPF, EPF and other savings."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </>
      }
    >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Name</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Parag Parikh Flexi Cap SIP" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.type ?? "sip"} onValueChange={(v) => setForm({ ...form, type: v as Investment["type"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INVESTMENT_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Current value (₹)</Label>
            <Input type="number" value={form.current_value ?? ""} onChange={(e) => setForm({ ...form, current_value: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Contribution (₹)</Label>
            <Input type="number" value={form.contribution_amount ?? ""} onChange={(e) => setForm({ ...form, contribution_amount: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <Label>Contribution frequency</Label>
            <Select value={form.contribution_frequency ?? "monthly"} onValueChange={(v) => setForm({ ...form, contribution_frequency: v as Investment["contribution_frequency"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="one_time">One-time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contribution day</Label>
            <Input type="number" min={1} max={31} value={form.contribution_day ?? ""} onChange={(e) => setForm({ ...form, contribution_day: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <Label>Start date</Label>
            <Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value || null })} />
          </div>
          <div>
            <Label>Maturity date</Label>
            <Input type="date" value={form.maturity_date ?? ""} onChange={(e) => setForm({ ...form, maturity_date: e.target.value || null })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Tag</Label>
            <Input value={form.tag ?? ""} onChange={(e) => setForm({ ...form, tag: e.target.value || null })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} />
          </div>
        </div>
    </ResponsiveFormShell>
  );
}
