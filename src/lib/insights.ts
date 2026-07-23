import { addDays, addMonths, differenceInDays, endOfMonth, format, isSameMonth, startOfDay, startOfMonth } from "date-fns";
import { computeDueDates, estimateDebtFreeMonths, type Income, type Payment, type PaymentHistory } from "./date-utils";
import { cardUtilization, type CreditCard } from "./mediums";

export function monthlyIncomeAt(incomes: Income[], month: Date): number {
  return incomes.reduce((sum, i) => {
    if (i.frequency === "monthly") return sum + Number(i.amount);
    if (i.frequency === "yearly") return sum + Number(i.amount) / 12;
    if (i.frequency === "weekly") return sum + Number(i.amount) * 4.33;
    const d = new Date(i.date_received);
    return isSameMonth(d, month) ? sum + Number(i.amount) : sum;
  }, 0);
}

export function monthlyObligationsAt(payments: Payment[], month: Date): number {
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  return payments
    .filter((p) => p.status === "active" || p.status === "overdue")
    .reduce((sum, p) => sum + computeDueDates(p, from, to).length * Number(p.amount), 0);
}

/** Sum of amounts paid toward dues whose due_date falls in this month (not paid_date). */
export function paidThisMonth(history: PaymentHistory[], month: Date): number {
  return history
    .filter((h) => {
      if (h.status !== "paid" && h.status !== "partial") return false;
      // Prefer due_date so catch-up payments for other months don't inflate this month's progress.
      const due = h.due_date.includes("T") ? new Date(h.due_date) : new Date(`${h.due_date}T12:00:00`);
      return isSameMonth(due, month);
    })
    .reduce((s, h) => s + Number(h.amount_paid ?? 0), 0);
}

export function tightnessLabel(surplusRatio: number): { label: string; tone: "surplus" | "warning" | "deficit" } {
  if (surplusRatio >= 0.25) return { label: "Comfortable", tone: "surplus" };
  if (surplusRatio >= 0.05) return { label: "Tight", tone: "warning" };
  return { label: "Critical", tone: "deficit" };
}

export function projectMonths(payments: Payment[], incomes: Income[], months: number) {
  const now = new Date();
  const out: { month: Date; income: number; obligations: number; net: number; notable?: string }[] = [];
  for (let i = 0; i < months; i++) {
    const m = addMonths(now, i);
    const income = monthlyIncomeAt(incomes, m);
    const obligations = monthlyObligationsAt(payments, m);
    let notable: string | undefined;
    const closing = payments.find((p) => p.end_date && isSameMonth(new Date(p.end_date), m));
    if (closing) notable = `${closing.name} ends`;
    out.push({ month: m, income, obligations, net: income - obligations, notable });
  }
  return out;
}

export function highestInterestDebt(payments: Payment[]) {
  const debts = payments.filter((p) => p.interest_rate != null && (p.category === "debt_emi" || p.category === "loan" || p.category === "credit_card"));
  if (!debts.length) return null;
  return debts.slice().sort((a, b) => (b.interest_rate ?? 0) - (a.interest_rate ?? 0))[0];
}

export function lowestInterestDebt(payments: Payment[]) {
  const debts = payments.filter((p) => p.interest_rate != null && (p.category === "debt_emi" || p.category === "loan" || p.category === "credit_card"));
  if (!debts.length) return null;
  return debts.slice().sort((a, b) => (a.interest_rate ?? 0) - (b.interest_rate ?? 0))[0];
}

export function needsEndDate(payments: Payment[]) {
  return payments.filter((p) => p.payment_type === "recurring" && !p.end_date_confirmed);
}

export function longRunningTemporary(payments: Payment[]) {
  const cutoff = differenceInDays;
  return payments.filter((p) => {
    if (!p.notes) return false;
    const temp = /temporary|short.?term|redraw|bridge/i.test(p.notes);
    if (!temp) return false;
    return cutoff(new Date(), new Date(p.created_at)) > 90;
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  debt_emi: "Debt / EMI",
  loan: "Loan",
  credit_card: "Credit card",
  insurance: "Insurance",
  chit_fund: "Chit fund",
  subscription: "Subscription",
  recurring_expense: "Recurring",
  one_time_expense: "One-time",
};

/** This month's outgo broken down by payment category (for the donut). */
export function spendingByCategory(payments: Payment[], month: Date = new Date()) {
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const map = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== "active" && p.status !== "overdue") continue;
    const dues = computeDueDates(p, from, to).length;
    if (!dues) continue;
    const key = p.category || "other";
    map.set(key, (map.get(key) ?? 0) + dues * Number(p.amount));
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category.replace(/_/g, " "),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function tagKey(tag: string | null | undefined) {
  const t = (tag ?? "").trim().toLowerCase();
  return t || "untagged";
}

function tagLabel(key: string) {
  if (key === "untagged") return "Untagged";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Income and outgo this month, grouped by the `tag` field (household split). */
export function householdSplit(payments: Payment[], incomes: Income[], month: Date = new Date()) {
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const buckets = new Map<string, { tag: string; income: number; outgo: number }>();

  function bucket(key: string) {
    if (!buckets.has(key)) buckets.set(key, { tag: tagLabel(key), income: 0, outgo: 0 });
    return buckets.get(key)!;
  }

  for (const i of incomes) {
    const key = tagKey(i.tag);
    const b = bucket(key);
    if (i.frequency === "monthly") b.income += Number(i.amount);
    else if (i.frequency === "yearly") b.income += Number(i.amount) / 12;
    else if (i.frequency === "weekly") b.income += Number(i.amount) * 4.33;
    else if (isSameMonth(new Date(i.date_received), month)) b.income += Number(i.amount);
  }

  for (const p of payments) {
    if (p.status !== "active" && p.status !== "overdue") continue;
    const dues = computeDueDates(p, from, to).length;
    if (!dues) continue;
    bucket(tagKey(p.tag)).outgo += dues * Number(p.amount);
  }

  return Array.from(buckets.values())
    .map((b) => ({ ...b, net: b.income - b.outgo }))
    .sort((a, b) => b.income + b.outgo - (a.income + a.outgo));
}

export type UtilizationRow = {
  card: CreditCard;
  utilization: number;
  pct: number;
  flag: "ok" | "watch" | "high";
};

/** Credit utilization with 30% / 50% flags. */
export function creditUtilizationRows(cards: CreditCard[]): UtilizationRow[] {
  return cards
    .filter((c) => c.status === "active")
    .map((card) => {
      const utilization = cardUtilization(card) ?? 0;
      const pct = Math.round(utilization * 100);
      const flag: UtilizationRow["flag"] = pct >= 50 ? "high" : pct >= 30 ? "watch" : "ok";
      return { card, utilization, pct, flag };
    })
    .sort((a, b) => b.pct - a.pct);
}

export type PayoffPlanItem = {
  payment: Payment;
  outstanding: number;
  rate: number;
  months: number | null;
  payoffDate: Date | null;
  order: number;
};

/** Rank debts for avalanche (highest rate first) or snowball (smallest balance first). */
export function debtPayoffPlan(payments: Payment[], strategy: "avalanche" | "snowball"): PayoffPlanItem[] {
  const debts = payments.filter((p) => {
    if (p.status !== "active" && p.status !== "overdue") return false;
    const outstanding = Number(p.outstanding_balance ?? 0);
    return outstanding > 0 && (p.category === "debt_emi" || p.category === "loan" || p.category === "credit_card");
  });

  const sorted = debts.slice().sort((a, b) => {
    if (strategy === "avalanche") {
      const rateDiff = Number(b.interest_rate ?? 0) - Number(a.interest_rate ?? 0);
      if (rateDiff !== 0) return rateDiff;
      return Number(a.outstanding_balance) - Number(b.outstanding_balance);
    }
    const balDiff = Number(a.outstanding_balance) - Number(b.outstanding_balance);
    if (balDiff !== 0) return balDiff;
    return Number(b.interest_rate ?? 0) - Number(a.interest_rate ?? 0);
  });

  const now = new Date();
  return sorted.map((payment, idx) => {
    const outstanding = Number(payment.outstanding_balance);
    const months = estimateDebtFreeMonths(outstanding, Number(payment.amount));
    const payoffDate = months != null ? addMonths(now, months) : null;
    return {
      payment,
      outstanding,
      rate: Number(payment.interest_rate ?? 0),
      months,
      payoffDate,
      order: idx + 1,
    };
  });
}

/**
 * Estimated lifetime interest paid so far.
 * Prefer history: total paid − principal reduced. Fall back to a simple rate × reduced principal heuristic when history is empty.
 */
export function lifetimeInterestPaid(payments: Payment[], history: PaymentHistory[]) {
  let total = 0;
  const rows: { name: string; interest: number; method: "history" | "estimate" }[] = [];

  for (const p of payments) {
    if (p.category !== "debt_emi" && p.category !== "loan" && p.category !== "credit_card") continue;
    const principal = p.principal_amount != null ? Number(p.principal_amount) : null;
    const outstanding = p.outstanding_balance != null ? Number(p.outstanding_balance) : null;
    const paid = history
      .filter((h) => h.payment_id === p.id && (h.status === "paid" || h.status === "partial"))
      .reduce((s, h) => s + Number(h.amount_paid ?? 0), 0);

    let interest = 0;
    let method: "history" | "estimate" = "estimate";

    if (principal != null && outstanding != null && principal > outstanding) {
      const principalReduced = principal - outstanding;
      if (paid > 0) {
        interest = Math.max(0, paid - principalReduced);
        method = "history";
      } else if (p.interest_rate != null) {
        interest = principalReduced * (Number(p.interest_rate) / 100);
        method = "estimate";
      }
    } else if (paid > 0 && p.interest_rate != null) {
      interest = paid * Math.min(0.5, Number(p.interest_rate) / 100);
      method = "estimate";
    }

    if (interest > 0) {
      total += interest;
      rows.push({ name: p.name, interest, method });
    }
  }

  rows.sort((a, b) => b.interest - a.interest);
  return { total, rows };
}

export type CalendarDay = {
  date: Date;
  iso: string;
  outgo: { name: string; amount: number; kind: "payment" | "card" }[];
  income: { name: string; amount: number }[];
  outgoTotal: number;
  incomeTotal: number;
};

/** Next 30 days of cash movement — dues + expected income. */
export function cashCalendar30(
  payments: Payment[],
  incomes: Income[],
  cards: CreditCard[],
  from: Date = new Date(),
): CalendarDay[] {
  const start = startOfDay(from);
  const end = addDays(start, 29);
  const days: CalendarDay[] = [];

  for (let i = 0; i < 30; i++) {
    const date = addDays(start, i);
    days.push({
      date,
      iso: format(date, "yyyy-MM-dd"),
      outgo: [],
      income: [],
      outgoTotal: 0,
      incomeTotal: 0,
    });
  }

  const byIso = new Map(days.map((d) => [d.iso, d]));

  for (const p of payments) {
    if (p.status !== "active" && p.status !== "overdue") continue;
    for (const d of computeDueDates(p, start, end)) {
      const iso = format(d, "yyyy-MM-dd");
      const day = byIso.get(iso);
      if (!day) continue;
      day.outgo.push({ name: p.name, amount: Number(p.amount), kind: "payment" });
      day.outgoTotal += Number(p.amount);
    }
  }

  for (const c of cards) {
    if (c.status !== "active") continue;
    for (let i = 0; i < 30; i++) {
      const date = addDays(start, i);
      if (date.getDate() === Math.min(c.due_day, endOfMonth(date).getDate())) {
        const day = byIso.get(format(date, "yyyy-MM-dd"));
        if (!day) continue;
        const amt = Number(c.outstanding_balance);
        if (amt <= 0) continue;
        day.outgo.push({ name: `${c.bank_name} ${c.card_name} bill`, amount: amt, kind: "card" });
        day.outgoTotal += amt;
      }
    }
  }

  for (const inc of incomes) {
    if (inc.frequency === "one_time") {
      const d = new Date(inc.date_received.includes("T") ? inc.date_received : `${inc.date_received}T12:00:00`);
      if (d >= start && d <= end) {
        const day = byIso.get(format(d, "yyyy-MM-dd"));
        if (day) {
          day.income.push({ name: inc.source, amount: Number(inc.amount) });
          day.incomeTotal += Number(inc.amount);
        }
      }
      continue;
    }
    if (inc.frequency === "monthly") {
      const anchor = new Date(inc.date_received.includes("T") ? inc.date_received : `${inc.date_received}T12:00:00`);
      const dayOfMonth = anchor.getDate();
      for (let i = 0; i < 30; i++) {
        const date = addDays(start, i);
        if (date.getDate() === Math.min(dayOfMonth, endOfMonth(date).getDate())) {
          const day = byIso.get(format(date, "yyyy-MM-dd"));
          if (!day) continue;
          day.income.push({ name: inc.source, amount: Number(inc.amount) });
          day.incomeTotal += Number(inc.amount);
        }
      }
    }
  }

  return days;
}

/** Days in the 30-day window that have any cash movement. */
export function cashCalendarActiveDays(days: CalendarDay[]) {
  return days.filter((d) => d.outgoTotal > 0 || d.incomeTotal > 0);
}
