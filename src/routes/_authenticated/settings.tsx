import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { staggerContainer, staggerItem } from "@/lib/motion";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — DebtPulse" },
      { name: "description", content: "Notification and reminder preferences for DebtPulse." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [leadDays, setLeadDays] = useState(2);
  const [digest, setDigest] = useState(true);
  const [quietStart, setQuietStart] = useState<string>("");
  const [quietEnd, setQuietEnd] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).single();
      if (data) {
        setDisplayName((data as any).display_name ?? "");
        setLeadDays((data as any).default_reminder_days ?? 2);
        setDigest((data as any).daily_digest_enabled ?? true);
        setQuietStart((data as any).quiet_hours_start ?? "");
        setQuietEnd((data as any).quiet_hours_end ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update({
        display_name: displayName || null,
        default_reminder_days: leadDays,
        daily_digest_enabled: digest,
        quiet_hours_start: quietStart || null,
        quiet_hours_end: quietEnd || null,
      } as any).eq("id", u.user.id);
      if (error) throw error;
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppLayout><div className="text-sm text-muted-foreground">Loading…</div></AppLayout>;

  return (
    <AppLayout>
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-xl space-y-6">
        <motion.div variants={staggerItem}>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Reminder preferences and profile.</p>
        </motion.div>

        <motion.div variants={staggerItem}>
        <Card>
          <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent>
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </CardContent>
        </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
        <Card>
          <CardHeader><CardTitle className="text-base">Reminders</CardTitle><CardDescription>In-app due-date reminders (visible on the dashboard).</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Remind me this many days before a due date</Label>
              <Input type="number" min={0} max={30} value={leadDays} onChange={(e) => setLeadDays(Number(e.target.value))} className="w-24" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Daily digest</Label>
                <p className="text-xs text-muted-foreground">Show "due in next 7 days" summary on the dashboard.</p>
              </div>
              <Switch checked={digest} onCheckedChange={setDigest} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Quiet hours start</Label><Input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} /></div>
              <div><Label>Quiet hours end</Label><Input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
