import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseNaturalLanguage } from "@/lib/groq.functions";
import { ConfirmPreviewCard, type ParsedEntry } from "./ConfirmPreviewCard";
import { useServerFn } from "@tanstack/react-start";

export function QuickAddBar({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedEntry[] | null>(null);
  const [rawFallback, setRawFallback] = useState<string | null>(null);
  const parse = useServerFn(parseNaturalLanguage);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setParsed(null);
    setRawFallback(null);
    try {
      const res = await parse({ data: { text: text.trim() } });
      if (!res.ok) {
        setRawFallback(text);
        toast.error("Couldn't parse that clearly — try the manual form.");
      } else if (res.entries.length === 0) {
        toast.info("Nothing recognised — try rephrasing or use the manual form.");
      } else {
        setParsed(res.entries as ParsedEntry[]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 md:p-4 border-accent/50">
        <form onSubmit={submit} className="flex flex-col md:flex-row gap-2 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Log in plain English
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='e.g. "Cred EMI 20000 every month on 7th for 30 months starting August 2026"'
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e as unknown as React.FormEvent);
              }}
            />
          </div>
          <Button type="submit" disabled={loading || !text.trim()} className="w-full md:w-auto">
            {loading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Understanding…</> : "Parse"}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground mt-2">
          Nothing is saved until you confirm. Ctrl/⌘+Enter to submit.
        </p>
      </Card>

      {parsed && (
        <ConfirmPreviewCard
          entries={parsed}
          rawInput={text}
          onDone={() => {
            setParsed(null);
            setText("");
            onSaved();
          }}
          onCancel={() => setParsed(null)}
        />
      )}
      {rawFallback && (
        <Card className="p-3 text-sm text-muted-foreground">
          The AI couldn't structure that. Use the "Add manually" button in the header.
        </Card>
      )}
    </div>
  );
}
