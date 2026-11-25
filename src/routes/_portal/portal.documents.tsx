import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Empty, ErrorBox, PageHeader, PageSkeleton } from "@/components/common";
import { DocumentFolders } from "@/components/bookkeeping/DocumentFolders";
import { q } from "@/lib/data";
import { useMe } from "@/lib/me-context";

export const Route = createFileRoute("/_portal/portal/documents")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Documents · Kenna's Empire client portal" },
      { name: "description", content: "Every file you've shared with Kenna's Empire and its review status." },
      { property: "og:title", content: "Documents · Kenna's Empire client portal" },
      { property: "og:description", content: "Your files and their review status." },
    ],
  }),
  component: Docs,
});

function Docs() {
  const me = useMe();
  const navigate = useNavigate();
  const docs = useQuery(q.documents(me.client_id!));
  if (docs.isLoading) return <PageSkeleton />;
  if (docs.error) return <ErrorBox error={docs.error} />;
  return (
    <div>
      <PageHeader title="Your documents" actions={<Button size="sm" asChild><Link to="/portal/upload">Upload</Link></Button>} />
      {(docs.data ?? []).length === 0 ? (
        <Empty title="No documents yet" action={<Button size="sm" asChild><Link to="/portal/upload">Upload your first file</Link></Button>} />
      ) : (
        <DocumentFolders clientId={me.client_id ?? ""} />
      )}
    </div>
  );
}
