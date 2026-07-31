import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { QuickAddBar } from "@/components/QuickAddBar";
import { PaymentFormDialog } from "@/components/PaymentFormDialog";
import { IncomeFormDialog } from "@/components/IncomeFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatePresence, animate, motion } from "framer-motion";
import { easeOut, fadeSlideUp, staggerContainer, staggerItem } from "@/lib/motion";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatSigned } from "@/lib/currency";
import { listPayments, listIncome, listHistory, listCreditCards, listInvestments, listReceivables, deletePayment, markHistory, completePayment, deleteIncome, updateOutstanding, deleteCreditCard, deleteInvestment, deleteReceivable, saveReceivable } from "@/lib/data";
import { syncReminders, clearReminder } from "@/lib/notifications";
import { computeDueDates, fmtDate, fmtShortDate, estimateDebtFreeMonths, type Payment } from "@/lib/date-utils";
import {
  monthlyIncomeAt, monthlyObligationsAt, paidThisMonth,
  tightnessLabel, projectMonths, highestInterestDebt, lowestInterestDebt, needsEndDate, longRunningTemporary,
} from "@/lib/insights";
import { cardUtilization, type CreditCard, type Investment, type Receivable, PAYMENT_CATEGORIES } from "@/lib/mediums";
import { CreditCardFormDialog } from "@/components/CreditCardFormDialog";
import { InvestmentFormDialog } from "@/components/InvestmentFormDialog";
import { ReceivableFormDialog } from "@/components/ReceivableFormDialog";
import { InsightsView } from "@/components/InsightsView";
import { startOfMonth, endOfMonth, isBefore, isSameMonth, subMonths, addMonths, format } from "date-fns";
import { AlertTriangle, Plus, Pencil, Trash2, CheckCircle2, CreditCard as CreditCardIcon, ChevronDown, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — DebtPulse" },
      { name: "description", content: "Your financial pulse: this month's obligations, past trends, and future projections." },
      { property: "og:title", content: "DebtPulse Dashboard" },
      { property: "og:description", content: "Track EMIs, debts, chit funds and income." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | undefined>(undefined);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | undefined>(undefined);
  const [investOpen, setInvestOpen] = useState(false);
  const [editingInvest, setEditingInvest] = useState<Investment | undefined>(undefined);
  const [recvOpen, setRecvOpen] = useState(false);
  const [editingRecv, setEditingRecv] = useState<Receivable | undefined>(undefined);
  const [tab, setTab] = useState<"overview" | "trends" | "details">("overview");
  const [viewMonth, setViewMonth] = useState(() => new Date());

  const payments = useQuery({ queryKey: ["payments"], queryFn: listPayments });
  const income = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const history = useQuery({ queryKey: ["history"], queryFn: listHistory });
  const cards = useQuery({ queryKey: ["credit_cards"], queryFn: listCreditCards });
  const investments = useQuery({ queryKey: ["investments"], queryFn: listInvestments });
  const receivables = useQuery({ queryKey: ["receivables"], queryFn: listReceivables });

  const refetch = useCallback(() => {
    payments.refetch(); income.refetch(); history.refetch();
    cards.refetch(); investments.refetch(); receivables.refetch();
  }, [payments, income, history, cards, investments, receivables]);

  const loading = payments.isLoading || income.isLoading || history.isLoading;

  const hasAnyData =
    (payments.data?.length ?? 0) > 0 ||
    (income.data?.length ?? 0) > 0 ||
    (cards.data?.length ?? 0) > 0 ||
    (investments.data?.length ?? 0) > 0 ||
    (receivables.data?.length ?? 0) > 0;

  // Generate in-app due-date reminders once payments/history are loaded, respecting the
  // reminder lead-time and daily-digest toggle from Settings. Safe to re-run on every visit —
  // syncReminders upserts and skips anything already generated.
  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", u.user.id).single();
        const p = profile as any;
        if (p && p.daily_digest_enabled === false) return;
        await syncReminders(payments.data ?? [], history.data ?? [], p?.default_reminder_days ?? 2);
      } catch {
        // Reminder generation is best-effort — never block the dashboard on it.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Your pulse</h1>
            <p className="text-sm text-muted-foreground mt-1">Log entries in plain English or use the manual form.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button className="flex-1 sm:flex-none" onClick={() => { setEditing(undefined); setAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />Add entry
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shrink-0">
                  More <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => { setEditingCard(undefined); setCardOpen(true); }}>
                  <CreditCardIcon className="h-4 w-4 mr-2" />Credit card
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { setEditingInvest(undefined); setInvestOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Investment
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { setEditingRecv(undefined); setRecvOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Receivable
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIncomeOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />Income
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <QuickAddBar onSaved={refetch} />

        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
              <TabsList className="inline-flex w-max min-w-full sm:min-w-0 sm:w-auto h-11">
                <TabsTrigger value="overview" className="snap-start">Overview</TabsTrigger>
                <TabsTrigger value="trends" className="snap-start">Trends</TabsTrigger>
                <TabsTrigger value="details" className="snap-start">Details</TabsTrigger>
              </TabsList>
            </div>
            <AnimatePresence mode="wait">
              {tab === "overview" && (
                <motion.div key="overview" variants={fadeSlideUp} initial="hidden" animate="show" exit="exit" className="mt-6">
                  <OverviewView
                    payments={payments.data ?? []}
                    incomes={income.data ?? []}
                    history={history.data ?? []}
                    cards={cards.data ?? []}
                    receivables={receivables.data ?? []}
                    hasAnyData={hasAnyData}
                    viewMonth={viewMonth}
                    onViewMonthChange={setViewMonth}
                    onRefresh={refetch}
                    onEdit={(p) => { setEditing(p); setAddOpen(true); }}
                    onAddManually={() => { setEditing(undefined); setAddOpen(true); }}
                  />
                </motion.div>
              )}
              {tab === "trends" && (
                <motion.div key="trends" variants={fadeSlideUp} initial="hidden" animate="show" exit="exit" className="mt-6">
                  <TrendsView payments={payments.data ?? []} incomes={income.data ?? []} history={history.data ?? []} />
                </motion.div>
              )}
              {tab === "details" && (
                <motion.div key="details" variants={fadeSlideUp} initial="hidden" animate="show" exit="exit" className="mt-6">
                  <DetailsView
                    payments={payments.data ?? []}
                    incomes={income.data ?? []}
                    history={history.data ?? []}
                    cards={cards.data ?? []}
                    investments={investments.data ?? []}
                    receivables={receivables.data ?? []}
                    onEdit={(p) => { setEditing(p); setAddOpen(true); }}
                    onEditCard={(c) => { setEditingCard(c); setCardOpen(true); }}
                    onEditInvest={(i) => { setEditingInvest(i); setInvestOpen(true); }}
                    onEditRecv={(r) => { setEditingRecv(r); setRecvOpen(true); }}
                    onRefresh={refetch}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs>
        )}
      </div>

      <PaymentFormDialog
        open={addOpen}
        onOpenChange={(v) => { setAddOpen(v); if (!v) setEditing(undefined); }}
        initial={editing}
        onSaved={refetch}
      />
      <IncomeFormDialog open={incomeOpen} onOpenChange={setIncomeOpen} onSaved={refetch} />
      <CreditCardFormDialog
        open={cardOpen}
        onOpenChange={(v) => { setCardOpen(v); if (!v) setEditingCard(undefined); }}
        initial={editingCard}
        onSaved={refetch}
      />
      <InvestmentFormDialog
        open={investOpen}
        onOpenChange={(v) => { setInvestOpen(v); if (!v) setEditingInvest(undefined); }}
        initial={editingInvest}
        onSaved={refetch}
      />
      <ReceivableFormDialog
        open={recvOpen}
        onOpenChange={(v) => { setRecvOpen(v); if (!v) setEditingRecv(undefined); }}
        initial={editingRecv}
        chitPayments={(payments.data ?? []).filter((p) => p.category === "chit_fund" && p.status === "active")}
        onSaved={refetch}
      />
    </AppLayout>
  );
}

function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(() => format(value));
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) return;
    const controls = animate(from, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(format(v)),
    });
    return () => controls.stop();
  }, [value, format]);

  return <>{display}</>;
}

function StatCard({ label, value, tone, sub, numericValue, format }: {
  label: string;
  value: string;
  tone?: "surplus" | "deficit" | "warning";
  sub?: string;
  numericValue?: number;
  format?: (n: number) => string;
}) {
  const color = tone === "surplus" ? "text-surplus" : tone === "deficit" ? "text-deficit" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`text-2xl font-display font-semibold tabular mt-1 ${color}`}>
          {numericValue != null && format ? <AnimatedNumber value={numericValue} format={format} /> : value}
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function EmptyOverviewState({ onAddManually }: { onAddManually: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 px-4 text-center space-y-4">
        <Sparkles className="h-6 w-6 text-primary mx-auto" />
        <div className="space-y-1.5 max-w-sm mx-auto">
          <p className="font-medium">Nothing logged yet</p>
          <p className="text-sm text-muted-foreground">
            Type something like <span className="text-foreground font-medium">"Cred EMI 20000 every month on 7th"</span> into
            the box above, or add your first entry manually.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAddManually}>
          <Plus className="h-4 w-4 mr-1.5" />Add manually
        </Button>
      </CardContent>
    </Card>
  );
}

function OverviewView({ payments, incomes, history, cards, receivables, hasAnyData, viewMonth, onViewMonthChange, onRefresh, onEdit, onAddManually }: {
  payments: Payment[];
  incomes: any[];
  history: any[];
  cards: CreditCard[];
  receivables: Receivable[];
  hasAnyData: boolean;
  viewMonth: Date;
  onViewMonthChange: (d: Date) => void;
  onRefresh: () => void;
  onEdit: (p: Payment) => void;
  onAddManually: () => void;
}) {
  const today = new Date();
  const isCurrentMonth = isSameMonth(viewMonth, today);
  const from = startOfMonth(viewMonth);
  const to = endOfMonth(viewMonth);
  const income = monthlyIncomeAt(incomes, viewMonth);
  const obligations = monthlyObligationsAt(payments, viewMonth);
  const paid = paidThisMonth(history, viewMonth);
  const surplus = income - obligations;
  const tight = tightnessLabel(income > 0 ? surplus / income : 0);

  if (!hasAnyData) {
    return <EmptyOverviewState onAddManually={onAddManually} />;
  }

  const dueThisMonth = payments.flatMap((p) =>
    computeDueDates(p, from, to).map((d) => ({ p, d }))
  ).sort((a, b) => a.d.getTime() - b.d.getTime());

  const monthLabel = isCurrentMonth ? "this month" : format(viewMonth, "MMMM");
  const paidPct = obligations > 0 ? Math.min(100, (paid / obligations) * 100) : 0;
  const progressNote =
    obligations === 0
      ? `No dues ${monthLabel}`
      : paid >= obligations
        ? `All ${formatINR(obligations)} due ${monthLabel} is marked paid`
        : `Paid ${formatINR(paid)} of ${formatINR(obligations)} due ${monthLabel}`;
  const activeCards = cards.filter((c) => c.status === "active");
  const pendingRecv = receivables.filter((r) => r.status === "pending" || r.status === "partial");
  const cardDues = activeCards.map((c) => {
    const day = Math.min(c.due_day, to.getDate());
    return { c, d: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day) };
  }).sort((a, b) => a.d.getTime() - b.d.getTime());

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem} className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => onViewMonthChange(subMonths(viewMonth, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-display text-lg font-semibold tracking-tight min-w-[9rem] text-center">
            {format(viewMonth, "MMMM yyyy")}
          </span>
          <Button size="icon" variant="ghost" onClick={() => onViewMonthChange(addMonths(viewMonth, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!isCurrentMonth && (
          <Button size="sm" variant="outline" onClick={() => onViewMonthChange(today)}>Today</Button>
        )}
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Income" value={formatINR(income)} numericValue={income} format={formatINR} />
        <StatCard label="Committed outgo" value={formatINR(obligations)} numericValue={obligations} format={formatINR} />
        <StatCard label={surplus >= 0 ? "Surplus" : "Deficit"} value={formatSigned(surplus)} tone={surplus >= 0 ? "surplus" : "deficit"} numericValue={surplus} format={formatSigned} />
        <StatCard label="Budget stretch" value={tight.label} tone={tight.tone} sub={income > 0 ? `${Math.round((surplus / income) * 100)}% of income left over` : undefined} />
      </motion.div>

      <motion.div variants={staggerItem}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">This month's progress</CardTitle>
          <CardDescription>{progressNote}</CardDescription>
        </CardHeader>
        <CardContent><Progress value={paidPct} /></CardContent>
      </Card>
      </motion.div>

      <motion.div variants={staggerItem}>
      <Card>
        <CardHeader><CardTitle className="text-base">Due dates</CardTitle></CardHeader>
        <CardContent>
          {dueThisMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due {monthLabel}.</p>
          ) : (
            <ul className="divide-y divide-border">
              {dueThisMonth.map(({ p, d }, i) => {
                const isOverdue = isBefore(d, today);
                const dueKey = format(d, "yyyy-MM-dd");
                const record = history.find((h) => h.payment_id === p.id && h.due_date === dueKey);
                return (
                  <li key={i} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xs text-center min-w-[3rem]">
                        <div className="font-display text-lg leading-none">{d.getDate()}</div>
                        <div className="text-muted-foreground uppercase">{format(d, "MMM")}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                          <span>{formatINR(p.amount)}</span>
                          {!p.end_date_confirmed && p.payment_type === "recurring" && (
                            <Badge variant="outline" className="border-warning text-warning h-5 text-[10px]">
                              <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Needs end date
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pl-[calc(3rem+0.75rem)] sm:pl-0">
                      {record?.status === "paid" ? (
                        <Badge className="bg-surplus/15 text-surplus border-0">Paid</Badge>
                      ) : record?.status === "partial" ? (
                        <Badge className="bg-warning/15 text-warning border-0">Partial</Badge>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={async () => {
                            try {
                              await markHistory({ payment_id: p.id, due_date: dueKey, amount_due: Number(p.amount), amount_paid: Number(p.amount), paid_date: format(today, "yyyy-MM-dd"), status: "paid" });
                              if (p.outstanding_balance != null) {
                                const next = Math.max(0, Number(p.outstanding_balance) - Number(p.amount));
                                await updateOutstanding(p.id, next);
                              }
                              await clearReminder(p.id, dueKey).catch(() => {});
                              toast.success("Marked paid");
                              onRefresh();
                            } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                          }}><CheckCircle2 className="h-4 w-4 mr-1" />Paid</Button>
                          {isOverdue && <Badge variant="outline" className="border-deficit text-deficit">Overdue</Badge>}
                        </>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => onEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      </motion.div>

      {activeCards.length > 0 && (
        <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credit cards — this month</CardTitle>
            <CardDescription>Bill due days and utilization (balance ÷ limit).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {cardDues.map(({ c, d }) => {
                const util = cardUtilization(c);
                const utilPct = util != null ? Math.round(util * 100) : null;
                const tone = utilPct == null ? undefined : utilPct >= 50 ? "deficit" : utilPct >= 30 ? "warning" : "surplus";
                return (
                  <li key={c.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xs text-center min-w-[3rem]">
                        <div className="font-display text-lg leading-none">{d.getDate()}</div>
                        <div className="text-muted-foreground uppercase">{format(d, "MMM")}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.bank_name} {c.card_name}{c.last4 ? ` ····${c.last4}` : ""}</div>
                        <div className="text-xs text-muted-foreground">
                          Outstanding {formatINR(Number(c.outstanding_balance))}
                          {c.credit_limit > 0 && ` of ${formatINR(Number(c.credit_limit))}`}
                          {c.apr != null && ` · ${c.apr}% APR`}
                        </div>
                      </div>
                    </div>
                    {utilPct != null && (
                      <div className="pl-[calc(3rem+0.75rem)] sm:pl-0">
                        <Badge variant="outline" className={
                          tone === "deficit" ? "border-deficit text-deficit" :
                          tone === "warning" ? "border-warning text-warning" :
                          "border-surplus text-surplus"
                        }>
                          {utilPct}% used
                        </Badge>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
        </motion.div>
      )}

      {pendingRecv.length > 0 && (
        <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expected in — receivables</CardTitle>
            <CardDescription>Money owed to you (peer loans & chit payouts).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {pendingRecv.map((r) => (
                <li key={r.id} className="py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.kind === "chit_payout" ? "Chit payout" : "Peer loan"}
                      {r.person && ` · ${r.person}`}
                      {r.expected_date && ` · expected ${fmtShortDate(r.expected_date)}`}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="tabular font-medium">{formatINR(Number(r.amount))}</span>
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        await saveReceivable({
                          ...r,
                          status: "received",
                          amount_received: Number(r.amount),
                          received_date: format(today, "yyyy-MM-dd"),
                        });
                        toast.success("Marked received");
                        onRefresh();
                      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                    }}>Received</Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

function TrendsView({ payments, incomes, history }: { payments: Payment[]; incomes: any[]; history: any[] }) {
  const isMobile = useIsMobile();
  const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
  const trend = months.map((m) => ({
    month: format(m, "MMM"),
    surplus: monthlyIncomeAt(incomes, m) - monthlyObligationsAt(payments, m),
    income: monthlyIncomeAt(incomes, m),
    outgo: monthlyObligationsAt(payments, m),
  }));

  const totalHist = history.length;
  const paidOnTime = history.filter((h) => h.status === "paid" && h.paid_date && h.due_date && h.paid_date <= h.due_date).length;
  const paidLate = history.filter((h) => h.status === "paid" && h.paid_date && h.due_date && h.paid_date > h.due_date).length;
  const missed = history.filter((h) => h.status === "missed").length;

  const interestPaid = payments
    .filter((p) => p.interest_rate && p.principal_amount && p.outstanding_balance != null)
    .reduce((sum, p) => sum + ((Number(p.principal_amount) - Number(p.outstanding_balance)) * (Number(p.interest_rate) / 100)), 0);

  const projection = projectMonths(payments, incomes, 6).map((m) => ({
    label: format(m.month, "MMM"),
    income: m.income,
    outgo: m.obligations,
    net: m.net,
    notable: m.notable,
  }));

  const debts = payments.filter((p) => (p.category === "debt_emi" || p.category === "loan") && p.outstanding_balance && Number(p.outstanding_balance) > 0);

  if (payments.length === 0 && incomes.length === 0 && totalHist === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Log a few entries to see trends and projections here.</p>;
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-8">
      <motion.div variants={staggerItem} className="space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">Last 6 months</h2>
        <Card>
          <CardHeader><CardTitle className="text-base">Surplus / deficit trend</CardTitle></CardHeader>
          <CardContent className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={isMobile ? 36 : 50} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Line type="monotone" dataKey="surplus" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Income vs. outgo</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={isMobile ? 36 : 50} />
                  <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                  {!isMobile && <Legend />}
                  <Bar dataKey="income" fill="var(--chart-1)" name="Income" />
                  <Bar dataKey="outgo" fill="var(--chart-2)" name="Outgo" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {isMobile && (
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground justify-center">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[var(--chart-1)]" />Income</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[var(--chart-2)]" />Outgo</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Payment reliability</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span>Paid on time</span><span className="tabular">{paidOnTime} / {totalHist}</span></div>
              <div className="flex justify-between"><span>Paid late</span><span className="tabular">{paidLate}</span></div>
              <div className="flex justify-between"><span>Missed</span><span className="tabular">{missed}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Estimated interest carried</CardTitle></CardHeader>
            <CardContent>
              <div className="font-display text-2xl tabular">{formatINR(interestPaid)}</div>
              <p className="text-xs text-muted-foreground mt-1">Rough estimate from interest rates and paid-down principal.</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">Next 6 months</h2>
        <Card>
          <CardHeader><CardTitle className="text-base">Projected surplus</CardTitle><CardDescription>Based on active recurring items and known end dates</CardDescription></CardHeader>
          <CardContent>
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projection}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
                  <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                  <Line type="monotone" dataKey="net" stroke="var(--chart-1)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 text-sm space-y-1">
              {projection.filter((p) => p.notable || p.net < 0).map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>{p.label}</span>
                  <span className={`tabular ${p.net < 0 ? "text-deficit" : ""}`}>
                    {formatSigned(p.net)} {p.notable ? `· ${p.notable}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Debt-free estimates</CardTitle></CardHeader>
          <CardContent>
            {debts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No debts with outstanding balance recorded.</p>
            ) : (
              <ul className="divide-y divide-border">
                {debts.map((d) => {
                  const months = estimateDebtFreeMonths(Number(d.outstanding_balance), Number(d.amount));
                  return (
                    <li key={d.id} className="py-2 flex justify-between text-sm">
                      <span>{d.name}</span>
                      <span className="tabular text-muted-foreground">
                        {formatINR(Number(d.outstanding_balance))} · ~{months ? `${months} months` : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function ImproveExtras({ payments, onEdit }: { payments: Payment[]; onEdit: (p: Payment) => void }) {
  const highest = highestInterestDebt(payments);
  const lowest = lowestInterestDebt(payments);
  const missingEnd = needsEndDate(payments);
  const longTemp = longRunningTemporary(payments);

  return (
    <div className="space-y-4">
      {highest && lowest && highest.id !== lowest.id && (
        <Card>
          <CardHeader><CardTitle className="text-base">Interest comparison</CardTitle><CardDescription>A factual look, not a directive.</CardDescription></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Highest rate: <strong>{highest.name}</strong> at {highest.interest_rate}%</div>
            <div>Lowest rate: <strong>{lowest.name}</strong> at {lowest.interest_rate}%</div>
            <p className="text-xs text-muted-foreground mt-2">Debts at higher rates cost more per rupee outstanding — worth being aware of.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recurring items with no end date</CardTitle></CardHeader>
        <CardContent>
          {missingEnd.length === 0 ? (
            <p className="text-sm text-muted-foreground">All recurring items have a confirmed end date. Nice.</p>
          ) : (
            <ul className="divide-y divide-border">
              {missingEnd.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <span>{p.name} · {formatINR(p.amount)}</span>
                  <Button size="sm" variant="outline" onClick={() => onEdit(p)}>Set end date</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {longTemp.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Temporary items still running</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {longTemp.map((p) => (
                <li key={p.id} className="py-2 text-sm">
                  {p.name} · noted as temporary, still active after {Math.round((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdvancedInsights({ payments, incomes, history, cards, onEdit }: {
  payments: Payment[];
  incomes: any[];
  history: any[];
  cards: CreditCard[];
  onEdit: (p: Payment) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasEnoughData = payments.length > 0 || cards.length > 0;
  if (!hasEnoughData) return null;

  return (
    <Card className="mt-8 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-sm font-medium cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Advanced insights</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={easeOut}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-6">
              <InsightsView payments={payments} incomes={incomes} history={history} cards={cards} />
              <ImproveExtras payments={payments} onEdit={onEdit} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function DetailsView({
  payments,
  incomes,
  history,
  cards,
  investments,
  receivables,
  onEdit,
  onEditCard,
  onEditInvest,
  onEditRecv,
  onRefresh,
}: {
  payments: Payment[];
  incomes: any[];
  history: any[];
  cards: CreditCard[];
  investments: Investment[];
  receivables: Receivable[];
  onEdit: (p: Payment) => void;
  onEditCard: (c: CreditCard) => void;
  onEditInvest: (i: Investment) => void;
  onEditRecv: (r: Receivable) => void;
  onRefresh: () => void;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");

  const tags = useMemo(() => {
    const s = new Set<string>();
    for (const p of payments) if (p.tag?.trim()) s.add(p.tag.trim().toLowerCase());
    for (const i of incomes) if (i.tag?.trim()) s.add(String(i.tag).trim().toLowerCase());
    return Array.from(s).sort();
  }, [payments, incomes]);

  const filteredPayments = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return payments.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (status !== "all" && p.status !== status) return false;
      if (tag !== "all" && (p.tag ?? "").trim().toLowerCase() !== tag) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.notes ?? "").toLowerCase().includes(needle) ||
        (p.tag ?? "").toLowerCase().includes(needle) ||
        p.category.replace(/_/g, " ").includes(needle)
      );
    });
  }, [payments, q, category, status, tag]);

  const filteredIncome = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return incomes.filter((i: any) => {
      if (tag !== "all" && (i.tag ?? "").trim().toLowerCase() !== tag) return false;
      if (!needle) return true;
      return String(i.source ?? "").toLowerCase().includes(needle) || String(i.notes ?? "").toLowerCase().includes(needle);
    });
  }, [incomes, q, tag]);

  return (
    <div>
      <motion.div variants={fadeSlideUp} initial="hidden" animate="show" className="space-y-6">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Input
              placeholder="Search name, notes, tag…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {PAYMENT_CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger><SelectValue placeholder="Tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {tags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(q || category !== "all" || status !== "all" || tag !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(""); setCategory("all"); setStatus("all"); setTag("all"); }}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>

        <div>
          <h3 className="font-display text-lg font-semibold mb-3">
            Payments & debts ({filteredPayments.length}{filteredPayments.length !== payments.length ? ` of ${payments.length}` : ""})
          </h3>
          {filteredPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {payments.length === 0
                ? 'No entries yet. Use the plain-English bar above or "Add entry".'
                : "No payments match these filters."}
            </p>
          ) : (
            <div className="grid gap-2">
              {filteredPayments.map((p) => (
                <Card key={p.id}>
                  <CardContent className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{p.name}</span>
                        <Badge variant="outline" className="text-[10px]">{p.category.replace(/_/g, " ")}</Badge>
                        {p.payment_method && <Badge variant="secondary" className="text-[10px]">{p.payment_method.replace(/_/g, " ")}</Badge>}
                        {p.status === "completed" && <Badge className="bg-surplus/15 text-surplus border-0">Completed</Badge>}
                        {p.status === "paused" && <Badge variant="secondary">Paused</Badge>}
                        {p.payment_type === "recurring" && !p.end_date_confirmed && (
                          <Badge variant="outline" className="border-warning text-warning text-[10px]">
                            <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Needs end date
                          </Badge>
                        )}
                        {p.tag && <Badge variant="secondary" className="text-[10px]">{p.tag}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatINR(p.amount)}
                        {p.payment_type === "recurring" && p.day_of_month && ` · every ${p.day_of_month}${suffix(p.day_of_month)}`}
                        {p.end_date && ` · until ${fmtShortDate(p.end_date)}`}
                        {p.outstanding_balance != null && ` · owe ${formatINR(Number(p.outstanding_balance))}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                      {p.status === "active" && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          try { await completePayment(p.id, format(new Date(), "yyyy-MM-dd")); toast.success("Marked completed"); onRefresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                        }}>Close</Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => onEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        if (!confirm(`Delete ${p.name}?`)) return;
                        try { await deletePayment(p.id); toast.success("Deleted"); onRefresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                      }}><Trash2 className="h-4 w-4 text-deficit" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold mb-3">Credit cards ({cards.length})</h3>
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cards yet. Use the More menu above.</p>
          ) : (
            <div className="grid gap-2">
              {cards.map((c) => {
                const util = cardUtilization(c);
                const utilPct = util != null ? Math.round(util * 100) : null;
                return (
                  <Card key={c.id}>
                    <CardContent className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{c.bank_name} {c.card_name}</span>
                          {c.last4 && <Badge variant="outline" className="text-[10px]">····{c.last4}</Badge>}
                          {utilPct != null && (
                            <Badge variant="outline" className={`text-[10px] ${utilPct >= 50 ? "border-deficit text-deficit" : utilPct >= 30 ? "border-warning text-warning" : ""}`}>
                              {utilPct}% used
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Due day {c.due_day}{suffix(c.due_day)}
                          {c.statement_day && ` · statement ${c.statement_day}${suffix(c.statement_day)}`}
                          {" · "}owe {formatINR(Number(c.outstanding_balance))}
                          {Number(c.credit_limit) > 0 && ` / ${formatINR(Number(c.credit_limit))} limit`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => onEditCard(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={async () => {
                          if (!confirm(`Delete ${c.card_name}?`)) return;
                          try { await deleteCreditCard(c.id); toast.success("Deleted"); onRefresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                        }}><Trash2 className="h-4 w-4 text-deficit" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold mb-3">Investments ({investments.length})</h3>
          {investments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No investments yet. Use the More menu above.</p>
          ) : (
            <div className="grid gap-2">
              {investments.map((i) => (
                <Card key={i.id}>
                  <CardContent className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{i.name}</span>
                        <Badge variant="outline" className="text-[10px]">{i.type.replace(/_/g, " ")}</Badge>
                        {i.status !== "active" && <Badge variant="secondary" className="text-[10px]">{i.status}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Value {formatINR(Number(i.current_value))}
                        {i.contribution_amount != null && ` · contributes ${formatINR(Number(i.contribution_amount))}`}
                        {i.contribution_frequency && ` ${i.contribution_frequency}`}
                        {i.contribution_day && ` on ${i.contribution_day}${suffix(i.contribution_day)}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => onEditInvest(i)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        if (!confirm(`Delete ${i.name}?`)) return;
                        try { await deleteInvestment(i.id); toast.success("Deleted"); onRefresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                      }}><Trash2 className="h-4 w-4 text-deficit" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold mb-3">Receivables ({receivables.length})</h3>
          {receivables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No receivables yet — peer loans or chit payouts you expect.</p>
          ) : (
            <div className="grid gap-2">
              {receivables.map((r) => (
                <Card key={r.id}>
                  <CardContent className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{r.name}</span>
                        <Badge variant="outline" className="text-[10px]">{r.kind === "chit_payout" ? "chit payout" : "peer loan"}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{r.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatINR(Number(r.amount))}
                        {r.person && ` · ${r.person}`}
                        {r.expected_date && ` · expected ${fmtDate(r.expected_date)}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => onEditRecv(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        if (!confirm(`Delete ${r.name}?`)) return;
                        try { await deleteReceivable(r.id); toast.success("Deleted"); onRefresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                      }}><Trash2 className="h-4 w-4 text-deficit" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold mb-3">
            Income ({filteredIncome.length}{filteredIncome.length !== incomes.length ? ` of ${incomes.length}` : ""})
          </h3>
          {filteredIncome.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {incomes.length === 0 ? "No income logged yet." : "No income matches these filters."}
            </p>
          ) : (
            <div className="grid gap-2">
              {filteredIncome.map((i: any) => (
                <Card key={i.id}>
                  <CardContent className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">{i.source}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatINR(i.amount)} · {i.frequency} · {fmtDate(i.date_received)}
                        {i.tag && ` · ${i.tag}`}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="self-end sm:self-auto" onClick={async () => {
                      if (!confirm(`Delete ${i.source}?`)) return;
                      try { await deleteIncome(i.id); toast.success("Deleted"); onRefresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                    }}><Trash2 className="h-4 w-4 text-deficit" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <AdvancedInsights payments={payments} incomes={incomes} history={history} cards={cards} onEdit={onEdit} />
    </div>
  );
}

function suffix(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
