import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CloseBar, Empty, ErrorBox, PageHeader, PageSkeleton, ScrollTable, Stat } from "@/components/common";
import { RangePicker, useDateRange } from "@/components/Analytics";
import { q } from "@/lib/data";
import { aging, summarize } from "@/lib/analytics";
import { useFirmOverview } from "@/lib/overview";
import { supabase } from "@/integrations/supabase/client";
import { financialReport, requireData } from "@/lib/bookkeeping";
import { fmtMoney0 } from "@/lib/format";

export const Route = createFileRoute("/_staff/reports")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Reports · Kenna's Empire" },
      { name: "description", content: "Revenue, expenses, net income and close progress across every client." },
      { property: "og:title", content: "Reports · Kenna's Empire" },
      { property: "og:description", content: "Firm-wide reporting across every client." },
    ],
  }),
  component: Reports,
});

function Reports() {
  const r = useDateRange();
  const txns = useQuery(q.transactions());
  const ov = useFirmOverview();
  const accounts = useQuery({queryKey:["accounts","all"],queryFn:async()=>requireData(await supabase.from("accounts").select("*"))});
  const journals = useQuery({queryKey:["journals","all"],queryFn:async()=>requireData(await supabase.from("journal_entries").select("*, journal_lines(*)"))});
  const today = new Date().toISOString().slice(0, 10);
  const rows = useMemo(
    () =>
      ov.rows.filter((x) => !x.client.archived).map((x) => {
        const t = (txns.data ?? []).filter((y) => y.client_id === x.client.id);
        const legacy = summarize(t, r.fromDate, r.toDate);
        const report = financialReport((accounts.data??[]).filter(a=>a.client_id===x.client.id),(journals.data??[]).filter(e=>e.client_id===x.client.id),r.fromDate,r.toDate,false);
        const s = {...legacy, count:(journals.data??[]).filter(e=>e.client_id===x.client.id&&!e.voided&&e.entry_date>=r.fromDate&&e.entry_date<=r.toDate).length,revenue:report.revenue/100,expenses:(report.cogs+report.expenses)/100,netIncome:report.netIncome/100};
        const ar = aging(t, "invoice", today);
        const ap = aging(t, "bill", today);
        return { ...x, s, ar: ar.current + ar.d30 + ar.d60 + ar.d90, ap: ap.current + ap.d30 + ap.d60 + ap.d90 };
      }),
    [ov.rows, txns.data, accounts.data, journals.data, r.fromDate, r.toDate, today],
  );
  if (txns.isLoading || ov.isLoading || accounts.isLoading || journals.isLoading) return <PageSkeleton />;
  if (txns.error || ov.error || accounts.error || journals.error) return <ErrorBox error={txns.error ?? ov.error ?? accounts.error ?? journals.error} />;
  const tot = rows.reduce((a, x) => ({ rev: a.rev + x.s.revenue, exp: a.exp + x.s.expenses, cin: a.cin + x.s.cashIn, cout: a.cout + x.s.cashOut }), { rev: 0, exp: 0, cin: 0, cout: 0 });
  const any = rows.some((x) => x.s.count > 0);
  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle="Posted journals across every active client" actions={<RangePicker r={r} />} />
      {!any ? <Empty title="Nothing has been posted in this range yet">Choose a different range, or post draft lines from a client's Books.</Empty> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Revenue" value={fmtMoney0(tot.rev)} />
            <Stat label="Expenses" value={fmtMoney0(tot.exp)} />
            <Stat label="Net income" value={fmtMoney0(tot.rev - tot.exp)} />
            <Stat label="Cash in" value={fmtMoney0(tot.cin)} />
            <Stat label="Cash out" value={fmtMoney0(tot.cout)} />
          </div>
          <ScrollTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net income</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Open receivables</TableHead>
                  <TableHead className="text-right">Open payables</TableHead>
                  <TableHead>Top expense</TableHead>
                  <TableHead>Close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((x) => (
                  <TableRow key={x.client.id} className="num">
                    <TableCell className="whitespace-nowrap font-medium">{x.client.name}</TableCell>
                    <TableCell className="text-right">{fmtMoney0(x.s.revenue)}</TableCell>
                    <TableCell className="text-right">{fmtMoney0(x.s.expenses)}</TableCell>
                    <TableCell className="text-right">{fmtMoney0(x.s.netIncome)}</TableCell>
                    <TableCell className="text-right">{x.s.revenue ? `${Math.round((x.s.netIncome / x.s.revenue) * 100)}%` : "—"}</TableCell>
                    <TableCell className="text-right">{fmtMoney0(x.ar)}</TableCell>
                    <TableCell className="text-right">{fmtMoney0(x.ap)}</TableCell>
                    <TableCell className="whitespace-nowrap">{x.s.expenseMix[0]?.account ?? "—"}</TableCell>
                    <TableCell><CloseBar percent={x.percent} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        </>
      )}
    </div>
  );
}
