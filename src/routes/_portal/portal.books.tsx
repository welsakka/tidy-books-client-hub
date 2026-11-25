import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Empty, ErrorBox, PageHeader, PageSkeleton, Stat } from "@/components/common";
import { LedgerTable } from "@/components/LedgerTable";
import { q } from "@/lib/data";
import { summarize } from "@/lib/analytics";
import { useMe } from "@/lib/me-context";
import { fmtMoney0, fmtPeriod } from "@/lib/format";

export const Route = createFileRoute("/_portal/portal/books")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Books snapshot · Kenna's Empire client portal" },
      { name: "description", content: "A read-only snapshot of your posted books." },
      { property: "og:title", content: "Books snapshot · Kenna's Empire client portal" },
      { property: "og:description", content: "A read-only snapshot of your posted books." },
    ],
  }),
  component: Books,
});

function Books() {
  const me = useMe();
  const txns = useQuery(q.transactions(me.client_id!));
  const last = useMemo(() => (txns.data ?? []).filter((t) => t.kind === "regular").map((t) => t.txn_date.slice(0, 7)).sort().at(-1), [txns.data]);
  if (txns.isLoading) return <PageSkeleton />;
  if (txns.error) return <ErrorBox error={txns.error} />;
  if (!last) return <Empty title="Nothing has been posted yet">Your books appear here once the firm posts them.</Empty>;
  const m = summarize(txns.data ?? [], `${last}-01`, `${last}-31`);
  const y = summarize(txns.data ?? [], `${last.slice(0, 4)}-01-01`, `${last}-31`);
  return (
    <div className="space-y-4">
      <PageHeader title="Books snapshot" subtitle="Posted figures only. Drafts the firm is still working on are not shown." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Revenue · ${fmtPeriod(`${last}-01`)}`} value={fmtMoney0(m.revenue)} />
        <Stat label={`Expenses · ${fmtPeriod(`${last}-01`)}`} value={fmtMoney0(m.expenses)} />
        <Stat label={`Net income · ${fmtPeriod(`${last}-01`)}`} value={fmtMoney0(m.netIncome)} />
        <Stat label={`Net income · ${last.slice(0, 4)} to date`} value={fmtMoney0(y.netIncome)} />
      </div>
      <LedgerTable clientId={me.client_id!} readOnly />
    </div>
  );
}
