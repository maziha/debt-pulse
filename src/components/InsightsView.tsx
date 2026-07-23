import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatINR, formatSigned } from "@/lib/currency";
import { fmtShortDate, type Income, type Payment, type PaymentHistory } from "@/lib/date-utils";
import type { CreditCard } from "@/lib/mediums";
import {
  spendingByCategory,
  householdSplit,
  creditUtilizationRows,
  debtPayoffPlan,
  lifetimeInterestPaid,
  cashCalendar30,
  cashCalendarActiveDays,
} from "@/lib/insights";
import { format, isSameDay } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(210 40% 50%)",
  "hsl(150 35% 40%)",
  "hsl(30 70% 50%)",
];

export function InsightsView({
  payments,
  incomes,
  history,
  cards,
}: {
  payments: Payment[];
  incomes: Income[];
  history: PaymentHistory[];
  cards: CreditCard[];
}) {
  const isMobile = useIsMobile();
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");

  const byCategory = useMemo(() => spendingByCategory(payments), [payments]);
  const household = useMemo(() => householdSplit(payments, incomes), [payments, incomes]);
  const utilization = useMemo(() => creditUtilizationRows(cards), [cards]);
  const payoff = useMemo(() => debtPayoffPlan(payments, strategy), [payments, strategy]);
  const interest = useMemo(() => lifetimeInterestPaid(payments, history), [payments, history]);
  const calendar = useMemo(() => cashCalendar30(payments, incomes, cards), [payments, incomes, cards]);
  const activeDays = useMemo(() => cashCalendarActiveDays(calendar), [calendar]);
  const now = calendar[0]?.date ?? new Date();

  const categoryTotal = byCategory.reduce((s, r) => s + r.amount, 0);
  const pieData = byCategory.map((r) => ({ name: r.label, value: r.amount }));
  const pieInner = isMobile ? 40 : 55;
  const pieOuter = isMobile ? 70 : 90;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">Insights</h2>
        <p className="text-sm text-muted-foreground mt-1">
          How money is moving — by category, person, cards, and the next 30 days.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending by category</CardTitle>
            <CardDescription>This month's committed outgo · {formatINR(categoryTotal)}</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outgo this month yet.</p>
            ) : (
              <>
                <div className="h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={pieInner} outerRadius={pieOuter} paddingAngle={2}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatINR(v)} />
                      {!isMobile && <Legend />}
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {isMobile && (
                  <ul className="mt-2 divide-y divide-border text-sm">
                    {byCategory.map((r, i) => (
                      <li key={r.label} className="py-1.5 flex justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{r.label}</span>
                        </span>
                        <span className="tabular shrink-0">{formatINR(r.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Household split</CardTitle>
            <CardDescription>Income vs outgo by tag (set tags on entries to split you / spouse).</CardDescription>
          </CardHeader>
          <CardContent>
            {household.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tagged income or outgo yet.</p>
            ) : (
              <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={household}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="tag" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={isMobile ? 36 : 50} />
                    <Tooltip
                      formatter={(v: number) => formatINR(v)}
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }}
                    />
                    {!isMobile && <Legend />}
                    <Bar dataKey="income" name="Income" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outgo" name="Outgo" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {household.some((h) => h.tag !== "Untagged") && (
              <ul className="mt-3 divide-y divide-border text-sm">
                {household.map((h) => (
                  <li key={h.tag} className="py-2 flex justify-between gap-2">
                    <span>{h.tag}</span>
                    <span className={h.net >= 0 ? "text-surplus" : "text-deficit"}>{formatSigned(h.net)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credit utilization</CardTitle>
          <CardDescription>Balance ÷ limit · flagged at 30% (watch) and 50% (high).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {utilization.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a credit card to see utilization.</p>
          ) : (
            utilization.map(({ card, pct, flag }) => (
              <div key={card.id} className="space-y-1.5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm">
                  <span className="font-medium truncate">
                    {card.bank_name} {card.card_name}
                    {card.last4 ? ` ····${card.last4}` : ""}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="tabular text-muted-foreground text-xs sm:text-sm">
                      {formatINR(Number(card.outstanding_balance))} / {formatINR(Number(card.credit_limit))}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        flag === "high"
                          ? "border-deficit text-deficit"
                          : flag === "watch"
                            ? "border-warning text-warning"
                            : "border-surplus text-surplus"
                      }
                    >
                      {pct}% · {flag === "high" ? "High" : flag === "watch" ? "Watch" : "OK"}
                    </Badge>
                  </div>
                </div>
                <Progress value={Math.min(100, pct)} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Debt payoff order</CardTitle>
              <CardDescription>
                {strategy === "avalanche"
                  ? "Highest interest rate first — usually saves more interest."
                  : "Smallest balance first — usually clears debts faster psychologically."}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={strategy === "avalanche" ? "default" : "outline"} onClick={() => setStrategy("avalanche")}>
                Avalanche
              </Button>
              <Button size="sm" variant={strategy === "snowball" ? "default" : "outline"} onClick={() => setStrategy("snowball")}>
                Snowball
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {payoff.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Set outstanding balances on EMIs/loans to build a payoff plan.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {payoff.map((row) => (
                <li key={row.payment.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between text-sm">
                  <div className="min-w-0 flex gap-3">
                    <span className="font-display text-lg text-muted-foreground w-6 tabular">{row.order}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{row.payment.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatINR(row.outstanding)} outstanding
                        {row.rate > 0 && ` · ${row.rate}%`}
                        {" · "}EMI {formatINR(Number(row.payment.amount))}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground pl-9 sm:pl-0 sm:text-right shrink-0">
                    {row.months != null ? (
                      <>
                        <div className="text-foreground font-medium">~{row.months} mo</div>
                        {row.payoffDate && <div>{format(row.payoffDate, "MMM yyyy")}</div>}
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lifetime interest paid</CardTitle>
          <CardDescription>
            Estimated from payment history vs principal reduction where possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="font-display text-3xl tabular mb-3">{formatINR(interest.total)}</div>
          {interest.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Mark EMIs paid and keep principal / outstanding updated to track interest.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {interest.rows.map((r) => (
                <li key={r.name} className="py-2 flex justify-between gap-2">
                  <span className="truncate">
                    {r.name}
                    <Badge variant="secondary" className="ml-2 text-[10px]">{r.method}</Badge>
                  </span>
                  <span className="tabular shrink-0">{formatINR(r.interest)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">30-day cash calendar</CardTitle>
          <CardDescription>
            Upcoming dues and expected income · {format(now, "d MMM")} – {format(calendar[29]?.date ?? now, "d MMM")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled in the next 30 days.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activeDays.map((day) => {
                const isToday = isSameDay(day.date, now);
                const net = day.incomeTotal - day.outgoTotal;
                return (
                  <li key={day.iso} className="py-3 flex gap-3">
                    <div className="text-xs text-center min-w-[3rem]">
                      <div className={`font-display text-lg leading-none ${isToday ? "text-primary" : ""}`}>
                        {day.date.getDate()}
                      </div>
                      <div className="text-muted-foreground uppercase">{format(day.date, "MMM")}</div>
                      {isToday && <div className="text-[10px] text-primary mt-0.5">Today</div>}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {day.income.map((i, idx) => (
                        <div key={`in-${idx}`} className="text-sm flex justify-between gap-2">
                          <span className="truncate text-surplus">+ {i.name}</span>
                          <span className="tabular text-surplus shrink-0">{formatINR(i.amount)}</span>
                        </div>
                      ))}
                      {day.outgo.map((o, idx) => (
                        <div key={`out-${idx}`} className="text-sm flex justify-between gap-2">
                          <span className="truncate">
                            − {o.name}
                            {o.kind === "card" && (
                              <Badge variant="outline" className="ml-1.5 text-[10px]">card</Badge>
                            )}
                          </span>
                          <span className="tabular text-deficit shrink-0">{formatINR(o.amount)}</span>
                        </div>
                      ))}
                      <div className={`text-xs tabular ${net >= 0 ? "text-surplus" : "text-deficit"}`}>
                        Net {formatSigned(net)} · {fmtShortDate(day.date)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
