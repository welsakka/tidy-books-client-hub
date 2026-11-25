export type Txn = {
  txn_date: string;
  amount: number | string;
  direction: "in" | "out" | string;
  account: string;
  payee: string;
  status: string;
  kind: string;
  due_date?: string | null;
  paid?: boolean;
};

export type DocLite = { category: string; period: string; status: string };

const isPL = (t: Txn) => t.status === "posted" && (t.kind === "regular" || t.kind === "adjusting");

export function inRange(t: { txn_date: string }, from: string, to: string) {
  return t.txn_date >= from && t.txn_date <= to;
}

export function summarize(txns: Txn[], from: string, to: string) {
  const rows = txns.filter((t) => isPL(t) && inRange(t, from, to));
  let revenue = 0, expenses = 0;
  const byMonth = new Map<string, { month: string; revenue: number; expenses: number }>();
  const byAccount = new Map<string, number>();
  const byPayee = new Map<string, number>();
  for (const t of rows) {
    const a = Number(t.amount);
    const month = t.txn_date.slice(0, 7);
    const m = byMonth.get(month) ?? { month, revenue: 0, expenses: 0 };
    if (t.direction === "in") {
      revenue += a; m.revenue += a;
    } else {
      expenses += a; m.expenses += a;
      byAccount.set(t.account, (byAccount.get(t.account) ?? 0) + a);
      byPayee.set(t.payee || "Unknown", (byPayee.get(t.payee || "Unknown") ?? 0) + a);
    }
    byMonth.set(month, m);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    count: rows.length,
    revenue: r2(revenue),
    expenses: r2(expenses),
    netIncome: r2(revenue - expenses),
    // Cash measures use the same posted bank activity (invoices/bills are accruals, not cash).
    cashIn: r2(revenue),
    cashOut: r2(expenses),
    monthly: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ ...m, revenue: r2(m.revenue), expenses: r2(m.expenses) })),
    expenseMix: [...byAccount.entries()].map(([account, total]) => ({ account, total: r2(total) })).sort((a, b) => b.total - a.total),
    topPayees: [...byPayee.entries()].map(([payee, total]) => ({ payee, total: r2(total) })).sort((a, b) => b.total - a.total).slice(0, 8),
  };
}

export type AgingBuckets = { current: number; d30: number; d60: number; d90: number };

/** Buckets: current (not yet due), 1–30, 31–90, 90+ days past due. Aging of open (unpaid, posted) invoices or bills by days past due as of `asOf`. */
export function aging(txns: Txn[], kind: "invoice" | "bill", asOf: string): AgingBuckets {
  const b: AgingBuckets = { current: 0, d30: 0, d60: 0, d90: 0 };
  const now = new Date(asOf + "T00:00:00Z").getTime();
  for (const t of txns) {
    if (t.kind !== kind || t.paid || t.status !== "posted") continue;
    const due = new Date((t.due_date ?? t.txn_date) + "T00:00:00Z").getTime();
    const days = Math.floor((now - due) / 86400000);
    const a = Number(t.amount);
    if (days <= 0) b.current += a;
    else if (days <= 30) b.d30 += a;
    else if (days <= 90) b.d60 += a;
    else b.d90 += a;
  }
  return b;
}

export type Coverage = "missing" | "received" | "accepted";

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4)), em = Number(to.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function coverageGrid(docs: DocLite[], categories: readonly string[], months: string[]) {
  const grid: Record<string, Record<string, Coverage>> = {};
  for (const c of categories) {
    grid[c] = {};
    for (const m of months) grid[c][m] = "missing";
  }
  for (const d of docs) {
    const m = d.period.slice(0, 7);
    if (!grid[d.category] || !(m in grid[d.category]) || d.status === "Rejected") continue;
    const accepted = d.status === "Accepted" || d.status === "Posted to books";
    if (accepted) grid[d.category][m] = "accepted";
    else if (grid[d.category][m] === "missing") grid[d.category][m] = "received";
  }
  return grid;
}

/** Opening + deposits - withdrawals = ending (within one cent). null when any figure is missing. */
export function ties(s: { opening_balance: number | null; total_deposits: number | null; total_withdrawals: number | null; ending_balance: number | null } | null | undefined): boolean | null {
  if (!s) return null;
  const { opening_balance: o, total_deposits: d, total_withdrawals: w, ending_balance: e } = s;
  if (o == null || d == null || w == null || e == null) return null;
  return Math.abs(o + d - w - e) < 0.01;
}
