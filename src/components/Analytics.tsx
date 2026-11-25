import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, ErrorBox, PageSkeleton, ScrollTable, Stat } from "@/components/common";
import { q } from "@/lib/data";
import { aging, coverageGrid, monthsBetween, summarize } from "@/lib/analytics";
import { CATEGORIES } from "@/lib/constants";
import { fmtMoney, fmtMoney0 } from "@/lib/format";
import { cn } from "@/lib/utils";

export function useDateRange() {
  const today = new Date().toISOString().slice(0, 7);
  const start = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return d.toISOString().slice(0, 7);
  })();
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(today);
  const lastDay = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
  return {
    from, to, setFrom, setTo,
    fromDate: `${from}-01`,
    toDate: `${to}-${String(lastDay(to)).padStart(2, "0")}`,
  };
}

export function RangePicker({ r }: { r: ReturnType<typeof useDateRange> }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1"><Label className="text-xs">From</Label><Input type="month" className="h-8 w-40" value={r.from} onChange={(e) => e.target.value && r.setFrom(e.target.value)} /></div>
      <div className="space-y-1"><Label className="text-xs">To</Label><Input type="month" className="h-8 w-40" value={r.to} onChange={(e) => e.target.value && r.setTo(e.target.value)} /></div>
    </div>
  );
}

export function Analytics({ clientId }: { clientId: string }) {
  const r = useDateRange();
  const txns = useQuery(q.transactions(clientId));
  const docs = useQuery(q.documents(clientId));
  const s = useMemo(() => summarize(txns.data ?? [], r.fromDate, r.toDate), [txns.data, r.fromDate, r.toDate]);
  const today = new Date().toISOString().slice(0, 10);
  const ar = useMemo(() => aging(txns.data ?? [], "invoice", today), [txns.data, today]);
  const ap = useMemo(() => aging(txns.data ?? [], "bill", today), [txns.data, today]);
  const months = monthsBetween(r.from, r.to);
  const grid = useMemo(() => coverageGrid(docs.data ?? [], CATEGORIES, months), [docs.data, months.join()]);

  if (txns.isLoading || docs.isLoading) return <PageSkeleton />;
  if (txns.error) return <ErrorBox error={txns.error} />;

  return (
    <div className="space-y-4">
      <RangePicker r={r} />
      {s.count === 0 ? (
        <Empty title="Nothing has been posted in this range yet">Analytics use posted transactions only. Post draft lines from Books or a document review to see figures here.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Revenue" value={fmtMoney0(s.revenue)} />
            <Stat label="Expenses" value={fmtMoney0(s.expenses)} />
            <Stat label="Net income" value={fmtMoney0(s.netIncome)} />
            <Stat label="Cash in" value={fmtMoney0(s.cashIn)} />
            <Stat label="Cash out" value={fmtMoney0(s.cashOut)} />
          </div>
          <div className="surface p-4">
            <h3 className="mb-2 text-sm font-semibold">Revenue vs expenses by month</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={s.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="var(--color-chart-1)" />
                  <Bar dataKey="expenses" name="Expenses" fill="var(--color-chart-2)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <BarList title="Expense mix by account" items={s.expenseMix.map((x) => ({ label: x.account, value: x.total }))} />
            <BarList title="Top payees" items={s.topPayees.map((x) => ({ label: x.payee, value: x.total }))} />
          </div>
        </>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <AgingTable title="Receivables aging (open invoices)" b={ar} />
        <AgingTable title="Payables aging (open bills)" b={ap} />
      </div>
      <div className="surface p-4">
        <h3 className="mb-2 text-sm font-semibold">Document coverage</h3>
        <div className="overflow-x-auto">
          <table className="num text-xs">
            <thead>
              <tr>
                <th className="pr-3 text-left font-medium">Category</th>
                {months.map((m) => <th key={m} className="px-1 font-medium text-muted-foreground">{m.slice(2)}</th>)}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => (
                <tr key={c}>
                  <td className="whitespace-nowrap pr-3 py-0.5">{c}</td>
                  {months.map((m) => {
                    const v = grid[c][m];
                    return (
                      <td key={m} className="px-0.5 py-0.5">
                        <div title={`${c} ${m}: ${v}`} className={cn("h-5 w-7 rounded-sm", v === "accepted" ? "bg-success" : v === "received" ? "bg-warning" : "bg-muted")} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-muted" /> Missing</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-warning" /> Received</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-success" /> Accepted</span>
        </div>
      </div>
    </div>
  );
}

function BarList({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="surface p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="space-y-1.5">
        {items.slice(0, 8).map((i) => (
          <div key={i.label} className="text-xs">
            <div className="flex justify-between"><span className="truncate">{i.label}</span><span className="num">{fmtMoney0(i.value)}</span></div>
            <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-chart-1" style={{ width: `${(i.value / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgingTable({ title, b }: { title: string; b: ReturnType<typeof aging> }) {
  const total = b.current + b.d30 + b.d60 + b.d90;
  return (
    <ScrollTable>
      <div className="px-4 pt-3 text-sm font-semibold">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">1–30</TableHead>
            <TableHead className="text-right">31–90</TableHead>
            <TableHead className="text-right">90+</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="num">
            <TableCell className="text-right">{fmtMoney0(b.current)}</TableCell>
            <TableCell className="text-right">{fmtMoney0(b.d30)}</TableCell>
            <TableCell className="text-right">{fmtMoney0(b.d60)}</TableCell>
            <TableCell className="text-right">{fmtMoney0(b.d90)}</TableCell>
            <TableCell className="text-right font-semibold">{fmtMoney0(total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </ScrollTable>
  );
}
