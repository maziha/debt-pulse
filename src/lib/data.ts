import { supabase } from "@/integrations/supabase/client";
import type { Payment, PaymentHistory, Income } from "./date-utils";
import type { CreditCard, Investment, Receivable } from "./mediums";

// Supabase generated types are very strict about column shapes; we use runtime shapes for JSON columns.
// Cast at the call boundary so app-side types stay clean.
const db = supabase as unknown as {
  from: (t: string) => {
    select: (s?: string) => any;
    insert: (r: any, o?: any) => any;
    update: (r: any) => any;
    delete: () => any;
  };
  auth: typeof supabase.auth;
};

export async function listPayments(): Promise<Payment[]> {
  const { data, error } = await db.from("payments").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Payment[];
}

export async function listIncome(): Promise<Income[]> {
  const { data, error } = await db.from("income").select("*").order("date_received", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Income[];
}

export async function listHistory(): Promise<PaymentHistory[]> {
  const { data, error } = await db.from("payment_history").select("*").order("due_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PaymentHistory[];
}

export async function listCreditCards(): Promise<CreditCard[]> {
  const { data, error } = await db.from("credit_cards").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CreditCard[];
}

export async function listInvestments(): Promise<Investment[]> {
  const { data, error } = await db.from("investments").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Investment[];
}

export async function listReceivables(): Promise<Receivable[]> {
  const { data, error } = await db.from("receivables").select("*").order("expected_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Receivable[];
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export async function savePayment(p: Partial<Payment> & { name: string; amount: number; category: string; payment_type: "recurring" | "one_time" }) {
  const user_id = await currentUserId();
  const row = { ...p, user_id };
  if (p.id) {
    const { data: before } = await db.from("payments").select("*").eq("id", p.id).single();
    const { error } = await db.from("payments").update(row).eq("id", p.id);
    if (error) throw error;
    if (before) await writePaymentAudit(p.id, user_id, before as Payment, { ...before, ...p } as Payment);
    return p.id;
  }
  const { data, error } = await db.from("payments").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

const AUDIT_FIELDS: (keyof Payment)[] = [
  "name", "amount", "category", "payment_type", "frequency", "day_of_month",
  "start_date", "end_date", "status", "interest_rate", "principal_amount",
  "outstanding_balance", "notes", "tag", "payment_method",
];

async function writePaymentAudit(paymentId: string, userId: string, before: Payment, after: Partial<Payment>) {
  const rows: { payment_id: string; user_id: string; field: string; old_value: string | null; new_value: string | null }[] = [];
  for (const field of AUDIT_FIELDS) {
    const oldV = before[field];
    const newV = after[field] !== undefined ? after[field] : before[field];
    const oldS = oldV == null || oldV === "" ? null : String(oldV);
    const newS = newV == null || newV === "" ? null : String(newV);
    if (oldS === newS) continue;
    rows.push({ payment_id: paymentId, user_id: userId, field, old_value: oldS, new_value: newS });
  }
  if (!rows.length) return;
  const { error } = await db.from("payment_audit").insert(rows);
  if (error) {
    // Don't fail the save if audit insert fails (e.g. migration not applied yet)
    console.warn("payment_audit insert failed", error);
  }
}

export type PaymentAuditRow = {
  id: string;
  payment_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export async function listPaymentAudit(paymentId: string): Promise<PaymentAuditRow[]> {
  const { data, error } = await db
    .from("payment_audit")
    .select("*")
    .eq("payment_id", paymentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as PaymentAuditRow[];
}

export async function deletePayment(id: string) {
  const { error } = await db.from("payments").delete().eq("id", id);
  if (error) throw error;
}

export async function saveIncome(i: Partial<Income> & { source: string; amount: number; date_received: string; frequency: Income["frequency"] }) {
  const user_id = await currentUserId();
  const row = { ...i, user_id };
  if (i.id) {
    const { error } = await db.from("income").update(row).eq("id", i.id);
    if (error) throw error;
    return i.id;
  }
  const { data, error } = await db.from("income").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteIncome(id: string) {
  const { error } = await db.from("income").delete().eq("id", id);
  if (error) throw error;
}

export async function saveCreditCard(c: Partial<CreditCard> & { bank_name: string; card_name: string; due_day: number }) {
  const user_id = await currentUserId();
  const row = { ...c, user_id };
  if (c.id) {
    const { error } = await db.from("credit_cards").update(row).eq("id", c.id);
    if (error) throw error;
    return c.id;
  }
  const { data, error } = await db.from("credit_cards").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteCreditCard(id: string) {
  const { error } = await db.from("credit_cards").delete().eq("id", id);
  if (error) throw error;
}

export async function saveInvestment(i: Partial<Investment> & { name: string; type: Investment["type"] }) {
  const user_id = await currentUserId();
  const row = { ...i, user_id };
  if (i.id) {
    const { error } = await db.from("investments").update(row).eq("id", i.id);
    if (error) throw error;
    return i.id;
  }
  const { data, error } = await db.from("investments").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteInvestment(id: string) {
  const { error } = await db.from("investments").delete().eq("id", id);
  if (error) throw error;
}

export async function saveReceivable(r: Partial<Receivable> & { kind: Receivable["kind"]; name: string; amount: number }) {
  const user_id = await currentUserId();
  const row = { ...r, user_id };
  if (r.id) {
    const { error } = await db.from("receivables").update(row).eq("id", r.id);
    if (error) throw error;
    return r.id;
  }
  const { data, error } = await db.from("receivables").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteReceivable(id: string) {
  const { error } = await db.from("receivables").delete().eq("id", id);
  if (error) throw error;
}

export async function markHistory(row: {
  id?: string;
  payment_id: string;
  due_date: string;
  amount_due: number;
  amount_paid?: number | null;
  status: PaymentHistory["status"];
  notes?: string | null;
  paid_date?: string | null;
}) {
  const user_id = await currentUserId();
  const payload = { ...row, user_id };
  if (row.id) {
    const { error } = await db.from("payment_history").update(payload).eq("id", row.id);
    if (error) throw error;
    return row.id;
  }
  const { data, error } = await db.from("payment_history").insert(payload).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateOutstanding(paymentId: string, newBalance: number) {
  const { error } = await db.from("payments").update({ outstanding_balance: newBalance }).eq("id", paymentId);
  if (error) throw error;
}

export async function completePayment(paymentId: string, endDate?: string) {
  const patch: Record<string, unknown> = { status: "completed", end_date_confirmed: true };
  if (endDate) patch.end_date = endDate;
  const { error } = await db.from("payments").update(patch).eq("id", paymentId);
  if (error) throw error;
}

export async function bulkImport(entries: { payments?: any[]; income?: any[] }) {
  const user_id = await currentUserId();
  let inserted = 0;
  if (entries.payments?.length) {
    const rows = entries.payments.map((r) => ({ ...r, user_id, created_from: r.created_from ?? "file_import" }));
    const { error } = await db.from("payments").insert(rows);
    if (error) throw error;
    inserted += rows.length;
  }
  if (entries.income?.length) {
    const rows = entries.income.map((r) => ({ ...r, user_id }));
    const { error } = await db.from("income").insert(rows);
    if (error) throw error;
    inserted += rows.length;
  }
  return inserted;
}
