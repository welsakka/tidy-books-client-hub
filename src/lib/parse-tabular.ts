// Code-only parsing for CSV, XLSX, OFX and QFX. No model involved.
export type ParsedRow = {
  date: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  confidence: number;
};
export type Malformed = { line: number; raw: string; reason: string };
export type TabularResult = { rows: ParsedRow[]; malformed: Malformed[] };

const DATE_KEYS = ["date", "posted date", "posting date", "transaction date", "trans date", "post date", "dtposted"];
const DESC_KEYS = ["description", "memo", "payee", "name", "details", "narrative", "transaction"];
const AMOUNT_KEYS = ["amount", "amt", "value", "trnamt"];
const DEBIT_KEYS = ["debit", "withdrawal", "withdrawals", "money out", "outflow"];
const CREDIT_KEYS = ["credit", "deposit", "deposits", "money in", "inflow"];

export function splitCsvLine(line: string, delimiter = ","): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delimiter) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parses "1,234.56", "-12", "(45.00)", "$9.10". Returns null when not a number. Negative = outflow. */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[$,\s]/g, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  if (s.endsWith("-")) { neg = !neg; s = s.slice(0, -1); }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

export function parseDate(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    // Excel serial date
    const d = new Date(Math.round((raw - 25569) * 86400000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/); // OFX 20260903120000
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

function findCol(headers: string[], keys: string[]) {
  const h = headers.map((x) => x.toLowerCase().trim());
  for (const k of keys) {
    const i = h.indexOf(k);
    if (i >= 0) return i;
  }
  for (const k of keys) {
    const i = h.findIndex((x) => x.includes(k));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseGrid(grid: (string | number | null)[][]): TabularResult {
  const rows: ParsedRow[] = [];
  const malformed: Malformed[] = [];
  const headerIdx = grid.findIndex((r) => r.some((c) => typeof c === "string" && DATE_KEYS.some((k) => c.toLowerCase().trim().includes(k))));
  if (headerIdx < 0) {
    return { rows, malformed: [{ line: 1, raw: (grid[0] ?? []).join(","), reason: "No header row with a date column was found." }] };
  }
  const headers = grid[headerIdx].map((c) => String(c ?? ""));
  const di = findCol(headers, DATE_KEYS);
  const si = findCol(headers, DESC_KEYS);
  const ai = findCol(headers, AMOUNT_KEYS);
  const dbi = findCol(headers, DEBIT_KEYS);
  const cri = findCol(headers, CREDIT_KEYS);
  if (ai < 0 && dbi < 0 && cri < 0) {
    return { rows, malformed: [{ line: headerIdx + 1, raw: headers.join(","), reason: "No amount, debit, or credit column was found." }] };
  }
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const raw = row.map((c) => (c == null ? "" : String(c))).join(",");
    const date = parseDate(row[di] as string);
    if (!date) { malformed.push({ line: r + 1, raw, reason: "Date is missing or unreadable." }); continue; }
    let amount: number | null = null;
    if (ai >= 0 && row[ai] != null && String(row[ai]).trim() !== "") amount = parseAmount(row[ai] as string);
    else {
      const debit = dbi >= 0 ? parseAmount(row[dbi] as string) : null;
      const credit = cri >= 0 ? parseAmount(row[cri] as string) : null;
      if (debit != null && debit !== 0) amount = -Math.abs(debit);
      else if (credit != null) amount = Math.abs(credit);
    }
    if (amount == null) { malformed.push({ line: r + 1, raw, reason: "Amount is missing or unreadable." }); continue; }
    rows.push({
      date,
      description: si >= 0 ? String(row[si] ?? "").trim() : "",
      amount: Math.abs(amount),
      direction: amount < 0 ? "out" : "in",
      confidence: 1,
    });
  }
  return { rows, malformed };
}

export function parseCsv(text: string): TabularResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = lines.find(l => /date/i.test(l)) ?? lines[0] ?? "";
  const delimiter = [",", ";", "\t", "|"].sort((a,b) => header.split(b).length - header.split(a).length)[0];
  return parseGrid(lines.map(l => splitCsvLine(l, delimiter)));
}

export function parseOfx(text: string): TabularResult {
  const rows: ParsedRow[] = [];
  const malformed: Malformed[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (b: string, t: string) => b.match(new RegExp(`<${t}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
  blocks.forEach((b, i) => {
    const date = parseDate(tag(b, "DTPOSTED"));
    const amount = parseAmount(tag(b, "TRNAMT"));
    const desc = [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).join(" - ");
    if (!date || amount == null) {
      malformed.push({ line: i + 1, raw: b.slice(0, 120).replace(/\s+/g, " "), reason: !date ? "Date is missing or unreadable." : "Amount is missing or unreadable." });
      return;
    }
    rows.push({ date, description: desc, amount: Math.abs(amount), direction: amount < 0 ? "out" : "in", confidence: 1 });
  });
  if (!blocks.length) malformed.push({ line: 1, raw: text.slice(0, 80), reason: "No transactions were found in this file." });
  return { rows, malformed };
}
