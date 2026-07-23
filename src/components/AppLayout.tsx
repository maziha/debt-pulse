import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, LayoutDashboard, Upload, Bell } from "lucide-react";
import { listNotifications, markAllNotificationsSeen, markNotificationSeen } from "@/lib/notifications";
import { fmtShortDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const MOBILE_TABS = [
  { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/import" as const, label: "Import", icon: Upload },
  { to: "/settings" as const, label: "Settings", icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const notifications = useQuery({ queryKey: ["notifications"], queryFn: listNotifications });
  const unseen = (notifications.data ?? []).filter((n) => !n.seen);

  async function signOut() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="font-display text-lg font-semibold tracking-tight">
            DebtPulse
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><LayoutDashboard className="h-4 w-4 mr-1.5" />Dashboard</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/import"><Upload className="h-4 w-4 mr-1.5" />Import</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/settings"><Settings className="h-4 w-4 mr-1.5" />Settings</Link></Button>
          </nav>
          <div className="flex items-center gap-2">
            {email && <span className="hidden sm:block text-xs text-muted-foreground">{email}</span>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Reminders">
                  <Bell className="h-4 w-4" />
                  {unseen.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none justify-center bg-deficit border-0">
                      {unseen.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Reminders</span>
                  {unseen.length > 0 && (
                    <button
                      className="text-xs font-normal text-muted-foreground hover:text-foreground"
                      onClick={async (e) => { e.preventDefault(); await markAllNotificationsSeen(); notifications.refetch(); }}
                    >
                      Mark all read
                    </button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(notifications.data ?? []).length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Nothing due soon.</div>
                ) : (
                  (notifications.data ?? []).map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className="flex flex-col items-start gap-0.5 whitespace-normal"
                      onSelect={async () => { if (!n.seen) { await markNotificationSeen(n.id); notifications.refetch(); } }}
                    >
                      <span className={n.seen ? "text-muted-foreground" : "font-medium"}>{n.message}</span>
                      {n.due_date && <span className="text-xs text-muted-foreground">{fmtShortDate(n.due_date)}</span>}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10">
        {children}
      </main>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="grid grid-cols-3 h-14">
          {MOBILE_TABS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-primary")} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
