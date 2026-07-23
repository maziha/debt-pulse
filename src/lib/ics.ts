import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { computeDueDates, type Payment } from "./date-utils";
import type { CreditCard } from "./mediums";

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDate(d: Date) {
  return format(d, "yyyyMMdd");
}

function icsStamp(d: Date = new Date()) {
  return format(d, "yyyyMMdd'T'HHmmss'Z'");
}

/**
 * Build an ICS calendar of upcoming dues (default next 3 months) for Google Calendar / Apple Calendar import.
 */
export function buildDueDatesIcs(
  payments: Payment[],
  cards: CreditCard[] = [],
  monthsAhead = 3,
): string {
  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(addMonths(now, monthsAhead - 1));
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DebtPulse//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:DebtPulse dues",
  ];

  for (const p of payments) {
    if (p.status !== "active" && p.status !== "overdue") continue;
    for (const d of computeDueDates(p, from, to)) {
      const day = icsDate(d);
      const uid = `${p.id}-${day}@debtpulse`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${icsStamp()}`,
        `DTSTART;VALUE=DATE:${day}`,
        `SUMMARY:${icsEscape(`${p.name} — ₹${Number(p.amount).toLocaleString("en-IN")}`)}`,
        `DESCRIPTION:${icsEscape(`DebtPulse due · ${p.category.replace(/_/g, " ")}`)}`,
        "END:VEVENT",
      );
    }
  }

  for (const c of cards) {
    if (c.status !== "active") continue;
    let cursor = startOfMonth(from);
    while (cursor <= to) {
      const dayNum = Math.min(c.due_day, endOfMonth(cursor).getDate());
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), dayNum);
      if (d >= from && d <= to) {
        const day = icsDate(d);
        const uid = `card-${c.id}-${day}@debtpulse`;
        lines.push(
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${icsStamp()}`,
          `DTSTART;VALUE=DATE:${day}`,
          `SUMMARY:${icsEscape(`${c.bank_name} ${c.card_name} bill`)}`,
          `DESCRIPTION:${icsEscape(`Credit card due · outstanding ₹${Number(c.outstanding_balance).toLocaleString("en-IN")}`)}`,
          "END:VEVENT",
        );
      }
      cursor = addMonths(cursor, 1);
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
