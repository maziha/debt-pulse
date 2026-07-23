/** Shared category / payment-method labels used across forms and parsers. */

export const PAYMENT_CATEGORIES = [
  { v: "debt_emi", l: "Debt / EMI" },
  { v: "loan", l: "Loan" },
  { v: "credit_card", l: "Credit card" },
  { v: "insurance", l: "Insurance" },
  { v: "chit_fund", l: "Chit fund" },
  { v: "subscription", l: "Subscription" },
  { v: "recurring_expense", l: "Recurring expense" },
  { v: "one_time_expense", l: "One-time expense" },
] as const;

export const PAYMENT_METHODS = [
  { v: "upi", l: "UPI" },
  { v: "auto_debit", l: "Auto-debit / NACH" },
  { v: "bank_transfer", l: "Bank transfer" },
  { v: "card", l: "Card" },
  { v: "wallet", l: "Wallet" },
  { v: "cash", l: "Cash" },
  { v: "cheque", l: "Cheque" },
] as const;

export const INVESTMENT_TYPES = [
  { v: "sip", l: "SIP" },
  { v: "mutual_fund", l: "Mutual fund" },
  { v: "fd", l: "Fixed deposit" },
  { v: "rd", l: "Recurring deposit" },
  { v: "ppf", l: "PPF" },
  { v: "epf", l: "EPF" },
  { v: "nps", l: "NPS" },
  { v: "stocks", l: "Stocks" },
  { v: "other", l: "Other" },
] as const;

export const RECEIVABLE_KINDS = [
  { v: "peer_loan", l: "Money lent out" },
  { v: "chit_payout", l: "Chit fund payout" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["v"];
export type InvestmentType = (typeof INVESTMENT_TYPES)[number]["v"];
export type ReceivableKind = (typeof RECEIVABLE_KINDS)[number]["v"];

export type CreditCard = {
  id: string;
  bank_name: string;
  card_name: string;
  last4: string | null;
  credit_limit: number;
  outstanding_balance: number;
  statement_day: number | null;
  due_day: number;
  apr: number | null;
  status: "active" | "closed" | "paused";
  notes: string | null;
  tag: string | null;
  created_at: string;
};

export type Investment = {
  id: string;
  name: string;
  type: InvestmentType;
  current_value: number;
  contribution_amount: number | null;
  contribution_frequency: "monthly" | "weekly" | "yearly" | "one_time" | null;
  contribution_day: number | null;
  start_date: string | null;
  maturity_date: string | null;
  notes: string | null;
  tag: string | null;
  status: "active" | "matured" | "closed";
  created_at: string;
};

export type Receivable = {
  id: string;
  kind: ReceivableKind;
  name: string;
  person: string | null;
  amount: number;
  expected_date: string | null;
  status: "pending" | "partial" | "received" | "written_off";
  amount_received: number | null;
  received_date: string | null;
  linked_payment_id: string | null;
  notes: string | null;
  tag: string | null;
  created_at: string;
};

export function cardUtilization(card: CreditCard): number | null {
  const limit = Number(card.credit_limit);
  if (!limit || limit <= 0) return null;
  return Number(card.outstanding_balance) / limit;
}
