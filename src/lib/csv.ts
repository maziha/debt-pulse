/** Lightweight CSV parsing + DebtPulse / bank-statement import mapping. */

export type ImportBundle = { payments: Record<string, unknown>[]; income: Record<string, unknown>[] };

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row");

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
  return { headers, rows };
}

function num(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[,₹Rs.\s]/gi, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pick(row: Record<string, string>, ...keys: string[]) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
  }
  // fuzzy: find header containing key
  for (const k of keys) {
    const hit = Object.keys(row).find((h) => h.includes(k));
    if (hit && row[hit]) return row[hit];
  }
  return "";
}

const VALID_CATEGORIES = new Set([
  "debt_emi", "loan", "credit_card", "insurance", "chit_fund",
  "subscription", "recurring_expense", "one_time_expense",
]);

/** Detect DebtPulse structured CSV (has type/name/amount) vs bank-style. */
export function csvToImportBundle(text: string): ImportBundle {
  const { headers, rows } = parseCsv(text);
  const hasType = headers.includes("type") || headers.includes("kind");
  const hasName = headers.includes("name") || headers.includes("source");
  const looksStructured = hasType || (hasName && headers.includes("category"));

  if (looksStructured) {
    return structuredCsv(rows);
  }
  return bankStatementCsv(rows, headers);
}

function structuredCsv(rows: Record<string, string>[]): ImportBundle {
  const payments: Record<string, unknown>[] = [];
  const income: Record<string, unknown>[] = [];

  for (const row of rows) {
    const type = (pick(row, "type", "kind") || "payment").toLowerCase();
    const amount = num(pick(row, "amount"));
    if (amount == null || amount === 0) continue;

    if (type === "income") {
      income.push({
        source: pick(row, "source", "name") || "Income",
        amount,
        frequency: pick(row, "frequency", "income_frequency") || "one_time",
        date_received: pick(row, "date_received", "date", "start_date") || new Date().toISOString().slice(0, 10),
        notes: pick(row, "notes") || null,
        tag: pick(row, "tag") || null,
      });
      continue;
    }

    const categoryRaw = pick(row, "category") || "recurring_expense";
    const category = VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : "recurring_expense";
    const payment_type = (pick(row, "payment_type") || (pick(row, "frequency") ? "recurring" : "one_time")) as string;
    payments.push({
      name: pick(row, "name") || "Imported",
      amount,
      category,
      payment_type: payment_type === "one_time" ? "one_time" : "recurring",
      frequency: pick(row, "frequency") || (payment_type === "one_time" ? null : "monthly"),
      day_of_month: num(pick(row, "day_of_month", "day")) ?? null,
      start_date: pick(row, "start_date", "date") || null,
      end_date: pick(row, "end_date") || null,
      notes: pick(row, "notes") || null,
      tag: pick(row, "tag") || null,
      payment_method: pick(row, "payment_method") || null,
      interest_rate: num(pick(row, "interest_rate")) ?? null,
      principal_amount: num(pick(row, "principal_amount", "principal")) ?? null,
      outstanding_balance: num(pick(row, "outstanding_balance", "outstanding")) ?? null,
      created_from: "file_import",
    });
  }

  return { payments, income };
}

/** Bank-ish: Date + Description + Amount (or Debit/Credit). Debits → one_time expenses. */
function bankStatementCsv(rows: Record<string, string>[], headers: string[]): ImportBundle {
  const payments: Record<string, unknown>[] = [];
  const income: Record<string, unknown>[] = [];

  for (const row of rows) {
    const date = normalizeDate(pick(row, "date", "txn_date", "transaction_date", "value_date"));
    const desc = pick(row, "description", "narration", "particulars", "details", "name") || "Bank entry";
    const debit = num(pick(row, "debit", "withdrawal", "dr"));
    const credit = num(pick(row, "credit", "deposit", "cr"));
    let amount = num(pick(row, "amount"));

    if (debit != null && debit > 0) {
      amount = debit;
      payments.push({
        name: desc.slice(0, 120),
        amount,
        category: "one_time_expense",
        payment_type: "one_time",
        start_date: date,
        end_date: date,
        end_date_confirmed: true,
        notes: "Imported from bank CSV",
        created_from: "file_import",
      });
    } else if (credit != null && credit > 0) {
      income.push({
        source: desc.slice(0, 120),
        amount: credit,
        frequency: "one_time",
        date_received: date || new Date().toISOString().slice(0, 10),
        notes: "Imported from bank CSV",
      });
    } else if (amount != null && amount !== 0) {
      // Signed amount: negative = expense
      if (amount < 0 || headers.some((h) => h.includes("debit"))) {
        payments.push({
          name: desc.slice(0, 120),
          amount: Math.abs(amount),
          category: "one_time_expense",
          payment_type: "one_time",
          start_date: date,
          end_date: date,
          end_date_confirmed: true,
          notes: "Imported from bank CSV",
          created_from: "file_import",
        });
      } else {
        income.push({
          source: desc.slice(0, 120),
          amount: Math.abs(amount),
          frequency: "one_time",
          date_received: date || new Date().toISOString().slice(0, 10),
          notes: "Imported from bank CSV",
        });
      }
    }
  }

  if (!payments.length && !income.length) {
    throw new Error(
      "Couldn't map CSV columns. Use DebtPulse headers (type,name,amount,…) or bank columns (date,description,amount/debit/credit)."
    );
  }
  return { payments, income };
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // DD/MM/YYYY or DD-MM-YYYY
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export const CSV_TEMPLATE = `type,name,amount,category,payment_type,frequency,day_of_month,start_date,end_date,tag,payment_method
payment,Cred EMI,20000,debt_emi,recurring,monthly,7,,,me,auto_debit
payment,Netflix,649,subscription,recurring,monthly,12,,,me,upi
income,My salary,62000,,,monthly,,,2026-07-01,me,
income,Wife salary,57000,,,monthly,,,2026-07-01,wife,
`;
