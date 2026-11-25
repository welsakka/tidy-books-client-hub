import { createFileRoute } from "@tanstack/react-router";
import { Empty, ErrorBox, PageHeader, PageSkeleton, Stat } from "@/components/common";
import { ClientTable } from "@/components/ClientTable";
import { DashboardWidgets } from "@/components/DashboardWidgets";
import { useFirmOverview } from "@/lib/overview";
import { useMe } from "@/lib/me-context";

export const Route = createFileRoute("/_staff/home")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Home · Kenna's Empire" },
      { name: "description", content: "The firm's work queue: open closes, documents to review and unread client messages." },
      { property: "og:title", content: "Home · Kenna's Empire" },
      { property: "og:description", content: "The firm's work queue for Kenna's Empire." },
    ],
  }),
  component: Home,
});

function Home() {
  const me = useMe();
  const { isLoading, error, rows, docs } = useFirmOverview();
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorBox error={error} />;
  const active = rows.filter((r) => !r.client.archived);
  const openCloses = active.filter((r) => r.engagement && r.engagement.status === "open").length;
  const waiting = active.reduce((s, r) => s + r.waiting, 0);
  const unread = active.reduce((s, r) => s + r.unread, 0);
  const withEng = active.filter((r) => r.engagement);
  const avg = withEng.length ? Math.round(withEng.reduce((s, r) => s + r.percent, 0) / withEng.length) : 0;
  return (
    <div className="animate-fade-up">
      <PageHeader title={`Good to see you, ${me.full_name.split(" ")[0]}`} subtitle="Work queue for every active client" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open closes" value={openCloses} />
        <Stat label="Documents waiting on the firm" value={waiting} hint="In review" />
        <Stat label="Unread client messages" value={unread} />
        <Stat label="Average close" value={`${avg}%`} />
      </div>
      {active.length > 0 && <DashboardWidgets rows={active} docs={docs} />}
      {active.length === 0 ? <Empty title="No active clients">Add a client from Admin to start a monthly close.</Empty> : <ClientTable rows={active} />}
    </div>
  );
}
