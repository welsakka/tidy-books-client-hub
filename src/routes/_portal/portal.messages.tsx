import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/common";
import { MessageThread } from "@/components/MessageThread";
import { downloadDocument } from "@/components/FileViewer";
import { useMe } from "@/lib/me-context";

export const Route = createFileRoute("/_portal/portal/messages")({
  validateSearch: z.object({ doc: z.string().optional(), req: z.string().optional() }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Messages · Kenna's Empire client portal" },
      { name: "description", content: "Your conversation with Kenna's Empire." },
      { property: "og:title", content: "Messages · Kenna's Empire client portal" },
      { property: "og:description", content: "Your conversation with Kenna's Empire." },
    ],
  }),
  component: () => {
    const me = useMe();
    const { doc, req } = Route.useSearch();
    return (
      <div>
        <PageHeader title="Messages with Kenna's Empire" />
        <MessageThread clientId={me.client_id!} initialDocumentId={doc} initialRequestId={req} onOpenDocument={(d) => downloadDocument(d).catch((e) => toast.error(e.message))} />
      </div>
    );
  },
});
