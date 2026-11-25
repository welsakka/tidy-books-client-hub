import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common";
import { ProgressTracker } from "@/components/ProgressTracker";
import { useMe } from "@/lib/me-context";

export const Route = createFileRoute("/_portal/portal/progress")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Firm progress · Kenna's Empire client portal" },
      { name: "description", content: "How far Kenna's Empire is with your monthly close." },
      { property: "og:title", content: "Firm progress · Kenna's Empire client portal" },
      { property: "og:description", content: "How far Kenna's Empire is with your monthly close." },
    ],
  }),
  component: () => {
    const me = useMe();
    return (
      <div>
        <PageHeader title="Firm progress" subtitle="Kenna's Empire updates each stage as your close moves forward." />
        <ProgressTracker clientId={me.client_id!} readOnly />
      </div>
    );
  },
});
