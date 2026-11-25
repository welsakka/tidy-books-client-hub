import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common";
import { UploadForm } from "@/components/UploadForm";
import { useMe } from "@/lib/me-context";

export const Route = createFileRoute("/_portal/portal/upload")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Upload · Kenna's Empire client portal" },
      { name: "description", content: "Send statements, receipts, invoices and other source documents to Kenna's Empire." },
      { property: "og:title", content: "Upload · Kenna's Empire client portal" },
      { property: "og:description", content: "Send source documents to Kenna's Empire." },
    ],
  }),
  component: () => {
    const me = useMe();
    return (
      <div className="max-w-2xl">
        <PageHeader title="Upload documents" subtitle="Phone photos are fine. Choose a category and the month the document belongs to." />
        <div className="surface p-5"><UploadForm clientId={me.client_id!} /></div>
      </div>
    );
  },
});
