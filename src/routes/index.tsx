import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, Sparkles, ShieldCheck, LineChart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DebtPulse — a calm ledger for EMIs, debts and income" },
      { name: "description", content: "Track EMIs, loans, chit funds, subscriptions and income in plain English. Get a clear picture of your surplus, obligations, and debt-free date." },
      { property: "og:title", content: "DebtPulse — your financial pulse, in plain English" },
      { property: "og:description", content: "Type 'Cred EMI 20000 on 7th until Dec 2027' and DebtPulse handles the rest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-semibold tracking-tight">DebtPulse</span>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6">
        <section className="pt-20 pb-16 md:pt-28 md:pb-24">
          <h1 className="font-display text-3xl sm:text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            A calm ledger for<br />the money you owe.
          </h1>
          <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl">
            Track EMIs, loans, chit funds, subscriptions and income in plain English.
            See your surplus, obligations, and debt-free date at a glance.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/auth">I have an account</Link></Button>
          </div>
          <div className="mt-6 flex items-start gap-2 text-sm text-muted-foreground rounded-lg border border-border px-3 py-2 max-w-xl">
            <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <span className="min-w-0">Try: "Cred EMI 20000 on 7th of every month until Dec 2027"</span>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4 pb-24">
          {[
            { icon: Sparkles, title: "Plain-English logging", body: "Type what you owe. AI extracts the amount, category, and schedule for you to confirm." },
            { icon: LineChart, title: "Past · Present · Future", body: "See last 6 months, this month's pulse, and a 6-month projection — with debt-free estimates." },
            { icon: ShieldCheck, title: "Private by default", body: "Your data is scoped to your account with row-level security. Export it as JSON anytime." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border bg-card p-5">
              <Icon className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-display font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 text-xs text-muted-foreground">
          DebtPulse · a personal-finance ledger for INR households.
        </div>
      </footer>
    </div>
  );
}
