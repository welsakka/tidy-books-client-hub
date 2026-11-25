import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Empty, ErrorBox, PageHeader, PageSkeleton } from "@/components/common";
import { DocumentsTable } from "@/components/DocumentsTable";
import { q } from "@/lib/data";
import { CATEGORIES } from "@/lib/constants";

export const Route = createFileRoute("/_staff/inbox")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Inbox · Kenna's Empire" },
      { name: "description", content: "Every client document waiting for review." },
      { property: "og:title", content: "Inbox · Kenna's Empire" },
      { property: "og:description", content: "Every client document waiting for review." },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const docs = useQuery(q.documents());
  const clients = useQuery(q.clients());
  const [client, setClient] = useState("all");
  const [cat, setCat] = useState("all");
  const [month, setMonth] = useState("");
  const names = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.name])), [clients.data]);
  if (docs.isLoading || clients.isLoading) return <PageSkeleton />;
  if (docs.error) return <ErrorBox error={docs.error} />;
  const inReview = (docs.data ?? []).filter((d) => d.status === "In review");
  const ids = new Set(inReview.filter((d) => (client === "all" || d.client_id === client) && (cat === "all" || d.category === cat) && (!month || d.period.startsWith(month))).flatMap((d) => [d.id, d.bundle_id]));
  const list = (docs.data ?? []).filter((d) => ids.has(d.id) || (d.bundle_id && ids.has(d.bundle_id)));
  return (
    <div>
      <PageHeader title="Inbox" subtitle={`${inReview.filter((d) => !d.bundle_id || d.bundle_index === 0).length} documents in review across all clients`} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Select value={client} onValueChange={setClient}>
          <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All clients</SelectItem>{(clients.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="month" aria-label="Period" className="h-8 w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      {list.length === 0 ? <Empty title="Nothing waiting for review">New client uploads land here. Adjust the filters if you expected something.</Empty> : <DocumentsTable docs={list} clientNames={names} />}
    </div>
  );
}
