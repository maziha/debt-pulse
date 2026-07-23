import { useState } from "react";
import { ResponsiveFormShell } from "@/components/ResponsiveFormShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { saveIncome } from "@/lib/data";
import type { Income } from "@/lib/date-utils";

export function IncomeFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Income>>({
    source: "Salary",
    amount: 0,
    frequency: "monthly",
    date_received: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!f.source || !f.amount || !f.date_received) {
      toast.error("Source, amount, and date are required");
      return;
    }
    setSaving(true);
    try {
      await saveIncome({
        source: f.source,
        amount: Number(f.amount),
        frequency: f.frequency ?? "one_time",
        date_received: f.date_received,
        notes: f.notes ?? null,
        tag: f.tag ?? null,
      });
      toast.success("Income saved");
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
      title="Log income"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Source</Label>
          <Input value={f.source ?? ""} onChange={(e) => setF({ ...f, source: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" value={f.amount ?? ""} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Frequency</Label>
            <Select value={f.frequency ?? "one_time"} onValueChange={(v) => setF({ ...f, frequency: v as Income["frequency"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="one_time">One-time</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Date received</Label>
          <Input type="date" value={f.date_received ?? ""} onChange={(e) => setF({ ...f, date_received: e.target.value })} />
        </div>
        <div>
          <Label>Tag (person)</Label>
          <Input value={f.tag ?? ""} onChange={(e) => setF({ ...f, tag: e.target.value || null })} placeholder="me / together / …" />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value || null })} />
        </div>
      </div>
    </ResponsiveFormShell>
  );
}
