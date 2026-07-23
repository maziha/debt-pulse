import { addDays, format, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { computeDueDates, fmtShortDate, type Payment, type PaymentHistory } from "./date-utils";
import { formatINR } from "./currency";

export type NotificationRow = {
  id: string;
  user_id: string;
  payment_id: string | null;
  message: string;
  due_date: string | null;
  seen: boolean;
  created_at: string;
};

const db = supabase as unknown as {
  from: (t: string) => {
    select: (s?: string) => any;
    insert: (r: any, o?: any) => any;
    upsert: (r: any, o?: any) => any;
    update: (r: any) => any;
    delete: () => any;
  };
  auth: typeof supabase.auth;
};

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export async function listNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .order("due_date", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationSeen(id: string) {
  const { error } = await db.from("notifications").update({ seen: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsSeen() {
  const user_id = await currentUserId();
  const { error } = await db.from("notifications").update({ seen: true }).eq("user_id", user_id).eq("seen", false);
  if (error) throw error;
}

/** Remove the reminder for a specific due date once it's been paid (or the payment is gone). */
export async function clearReminder(paymentId: string, dueDate: string) {
  const { error } = await db.from("notifications").delete().eq("payment_id", paymentId).eq("due_date", dueDate);
  if (error) throw error;
}

/**
 * Generates in-app reminders for anything due within `leadDays` that hasn't been paid yet.
 * Safe to call on every dashboard load — upserts on (user_id, payment_id, due_date) and skips
 * rows that already exist, so it never duplicates a notification or resets its `seen` state.
 */
export async function syncReminders(payments: Payment[], history: PaymentHistory[], leadDays: number) {
  const user_id = await currentUserId();
  const today = startOfDay(new Date());
  const horizon = addDays(today, Math.max(0, leadDays));

  const rows: { user_id: string; payment_id: string; due_date: string; message: string; seen: boolean }[] = [];
  for (const p of payments) {
    if (p.status !== "active" && p.status !== "overdue") continue;
    const dues = computeDueDates(p, today, horizon);
    for (const d of dues) {
      const dueKey = format(d, "yyyy-MM-dd");
      const alreadyHandled = history.some(
        (h) => h.payment_id === p.id && h.due_date === dueKey && (h.status === "paid" || h.status === "partial")
      );
      if (alreadyHandled) continue;
      rows.push({
        user_id,
        payment_id: p.id,
        due_date: dueKey,
        message: `${p.name} — ${formatINR(p.amount)} due ${fmtShortDate(d)}`,
        seen: false,
      });
    }
  }
  if (!rows.length) return;

  const { error } = await db
    .from("notifications")
    .upsert(rows, { onConflict: "user_id,payment_id,due_date", ignoreDuplicates: true });
  if (error) throw error;
}
