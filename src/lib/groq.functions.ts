import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({ text: z.string().min(1).max(2000) });

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You extract structured personal-finance entries from Indian English sentences.

Output STRICT JSON only, no prose. Shape:
{
  "entries": [
    {
      "kind": "payment" | "income" | "payment_log",
      "name": string,
      "amount": number,
      "currency": "INR",
      "category": "debt_emi" | "recurring_expense" | "one_time_expense" | "chit_fund" | "loan" | "subscription" | "credit_card" | "insurance" | null,
      "payment_method": "upi" | "auto_debit" | "bank_transfer" | "cash" | "wallet" | "cheque" | "card" | null,
      "payment_type": "recurring" | "one_time" | null,
      "frequency": "monthly" | "weekly" | "yearly" | "custom" | null,
      "day_of_month": number | null,
      "custom_dates": string[] | null,
      "start_date": "YYYY-MM-DD" | null,
      "end_date": "YYYY-MM-DD" | null,
      "linked_entity": string | null,
      "interest_rate": number | null,
      "principal_amount": number | null,
      "notes": string | null,
      "income_source": string | null,
      "income_frequency": "monthly" | "one_time" | "weekly" | "yearly" | null,
      "date_received": "YYYY-MM-DD" | null,
      "clarification_needed": string[]
    }
  ]
}

Rules:
- Return an array. Multi-item sentences ("2000 on 10th and 40000 on 25th") = multiple entries.
- If end_date is not explicit, set null and add "end_date" to clarification_needed for recurring items.
- "Paid X" / "closed the loan" / "got bonus today" = income or payment_log (past action), not a new schedule.
- Currency default INR. Amounts as plain numbers (no commas).
- Never guess dates you weren't told. Use null.
- "today" = current date in Asia/Kolkata timezone (from user context).`;

export const parseNaturalLanguage = createServerFn({ method: "POST" })
  .validator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY missing");

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    async function callGroq(strict: boolean) {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT + (strict ? "\n\nCRITICAL: Return valid JSON matching schema exactly." : "") },
            { role: "user", content: `Today is ${today}. Input:\n${data.text}` },
          ],
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Groq ${res.status}: ${t.slice(0, 200)}`);
      }
      const j = await res.json();
      return j.choices?.[0]?.message?.content as string;
    }

    let content = await callGroq(false);
    try {
      const parsed = JSON.parse(content);
      return { ok: true as const, entries: parsed.entries ?? [] };
    } catch {
      content = await callGroq(true);
      try {
        const parsed = JSON.parse(content);
        return { ok: true as const, entries: parsed.entries ?? [] };
      } catch {
        return { ok: false as const, raw: content, entries: [] };
      }
    }
  });
