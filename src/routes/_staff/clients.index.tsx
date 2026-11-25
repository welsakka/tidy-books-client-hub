import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Empty, ErrorBox, PageHeader, PageSkeleton } from "@/components/common";
import { ClientTable } from "@/components/ClientTable";
import { Button } from "@/components/ui/button";
import { useFirmOverview } from "@/lib/overview";
import { useMe } from "@/lib/me-context";
import { isFirmAdmin } from "@/lib/constants";

export const Route = createFileRoute("/_staff/clients/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Clients · Kenna's Empire" },
      { name: "description", content: "Every business Kenna's Empire keeps books for." },
      { property: "og:title", content: "Clients · Kenna's Empire" },
      { property: "og:description", content: "Every business Kenna's Empire keeps books for." },
    ],
  }),
  component: Clients,
});

function Clients() {
  const me = useMe();
  const { isLoading, error, rows } = useFirmOverview();
  const [showArchived, setShowArchived] = useState(false);
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorBox error={error} />;
  const list = rows.filter((r) => showArchived || !r.client.archived);
  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${rows.filter((r) => !r.client.archived).length} active`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setShowArchived(!showArchived)}>{showArchived ? "Hide archived" : "Show archived"}</Button>
            {isFirmAdmin(me.role) && <Button size="sm" asChild><Link to="/admin">Add client</Link></Button>}
          </>
        }
      />
      {list.length === 0 ? <Empty title="No clients yet">The Owner or an Admin can add a client from Admin.</Empty> : <ClientTable rows={list} />}
    </div>
  );
}
