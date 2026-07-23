import { addDays, addMonths, endOfMonth, format, isAfter, isBefore, startOfMonth } from "date-fns";

export type Payment = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category: string;
  payment_type: "recurring" | "one_time";
  frequency: string | null;
  day_of_month: number | null;
  custom_dates: unknown;
  start_date: string | null;
  end_date: string | null;
  end_date_confirmed: boolean;
  status: "active" | "completed" | "paused" | "overdue";
  linked_entity: string | null;
  interest_rate: number | null;
  principal_amount: number | null;
  outstanding_balance: number | null;
  notes: string | null;
  created_from: string;
  raw_input: string | null;
  tag: string | null;
  payment_method: string | null;
  credit_card_id: string | null;
  created_at: string;
};

export type PaymentHistory = {
  id: string;
  payment_id: string;
  due_date: string;
  amount_due: number;
  amount_paid: number | null;
  paid_date: string | null;
  status: "paid" | "missed" | "partial" | "pending";
  notes: string | null;
};

export type Income = {
  id: string;
  source: string;
  amount: number;
  frequency: "monthly" | "one_time" | "weekly" | "yearly";
  date_received: string;
  notes: string | null;
  tag: string | null;
};

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC off-by-one). */
function parseLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

/** Compute due dates for a payment within [from, to]. */
export function computeDueDates(p: Payment, from: Date, to: Date): Date[] {
  if (p.status === "completed" || p.status === "paused") return [];
  // Explicit start_date wins. Otherwise use created_at, but floor to month start so
  // mid-month imports still include earlier dues in the creation month.
  const start = p.start_date
    ? parseLocalDate(p.start_date)
    : startOfMonth(new Date(p.created_at));
  const end = p.end_date ? parseLocalDate(p.end_date) : null;
  const effFrom = isBefore(from, start) ? start : from;
  const effTo = end && isBefore(end, to) ? end : to;
  if (isAfter(effFrom, effTo)) return [];

  const out: Date[] = [];
  if (p.payment_type === "one_time") {
    if (p.start_date) {
      const d = parseLocalDate(p.start_date);
      if (!isBefore(d, effFrom) && !isAfter(d, effTo)) out.push(d);
    }
    return out;
  }
  if (p.frequency === "monthly" && p.day_of_month) {
    let cursor = startOfMonth(effFrom);
    while (!isAfter(cursor, effTo)) {
      const day = Math.min(p.day_of_month, endOfMonth(cursor).getDate());
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      if (!isBefore(d, effFrom) && !isAfter(d, effTo)) out.push(d);
      cursor = addMonths(cursor, 1);
    }
  } else if (p.frequency === "weekly") {
    // Anchored to start_date's weekday. Without a start date there's no anchor to cadence from.
    if (!p.start_date) return out;
    const anchor = parseLocalDate(p.start_date);
    let cursor = new Date(anchor);
    if (isBefore(cursor, effFrom)) {
      const weeksBehind = Math.ceil((effFrom.getTime() - cursor.getTime()) / (7 * 24 * 60 * 60 * 1000));
      cursor = addDays(cursor, weeksBehind * 7);
    }
    while (!isAfter(cursor, effTo)) {
      if (!isBefore(cursor, effFrom)) out.push(new Date(cursor));
      cursor = addDays(cursor, 7);
    }
  } else if (p.frequency === "yearly") {
    // Anchored to start_date's month + day, repeating once a year.
    if (!p.start_date) return out;
    const anchor = parseLocalDate(p.start_date);
    let cursor = new Date(effFrom.getFullYear(), anchor.getMonth(), anchor.getDate());
    if (isBefore(cursor, effFrom)) cursor = new Date(cursor.getFullYear() + 1, anchor.getMonth(), anchor.getDate());
    while (!isAfter(cursor, effTo)) {
      if (!isBefore(cursor, effFrom)) out.push(new Date(cursor));
      cursor = new Date(cursor.getFullYear() + 1, cursor.getMonth(), cursor.getDate());
    }
  } else if (p.frequency === "custom" && Array.isArray(p.custom_dates)) {
    for (const iso of p.custom_dates as string[]) {
      const d = parseLocalDate(iso);
      if (!isBefore(d, effFrom) && !isAfter(d, effTo)) out.push(d);
    }
  }
  return out;
}

export function fmtDate(d: Date | string) {
  return format(new Date(d), "d MMM yyyy");
}
export function fmtShortDate(d: Date | string) {
  return format(new Date(d), "d MMM");
}

/** Estimate months remaining on a debt from outstanding + EMI (no compounding, factual). */
export function estimateDebtFreeMonths(outstanding: number | null, emi: number) {
  if (!outstanding || outstanding <= 0 || emi <= 0) return null;
  return Math.ceil(outstanding / emi);
}
