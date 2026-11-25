import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Empty, ErrorBox, PageHeader, PageSkeleton } from "@/components/common";
import { MessageThread } from "@/components/MessageThread";
import { DocumentReviewDialog } from "@/components/DocumentReview";
import { q, type DocRow } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_staff/messages")({
  validateSearch: z.object({ client: z.string().optional() }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Messages · Kenna's Empire" },
      { name: "description", content: "Every client thread, newest first." },
      { property: "og:title", content: "Messages · Kenna's Empire" },
      { property: "og:description", content: "Every client thread, newest first." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { client } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const threads = useQuery({ ...q.threads(), refetchInterval: 20000 });
  const [open, setOpen] = useState<DocRow | null>(null);
  if (threads.isLoading) return <PageSkeleton />;
  if (threads.error) return <ErrorBox error={threads.error} />;
  const list = threads.data ?? [];
  return (
    <div>
      <PageHeader title="Messages" subtitle="One shared thread per client" />
      {list.length === 0 ? <Empty title="No threads yet">Start a conversation from a client's Messages tab.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="surface divide-y">
            {list.map((t) => (
              <button key={t.thread_id} onClick={() => navigate({ search: { client: t.client_id } })} className={cn("block w-full p-3 text-left hover:bg-muted/50", client === t.client_id && "bg-accent/60")}>
                <div className="flex items-center gap-2">
                  <span className={cn("flex-1 truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{t.client_name}</span>
                  {t.unread > 0 && <Badge className="num">{t.unread}</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{t.last_body}</div>
                <div className="num text-[11px] text-muted-foreground">{fmtDateTime(t.last_message_at)}</div>
              </button>
            ))}
          </div>
          <div>
            {client ? <MessageThread key={client} clientId={client} onOpenDocument={setOpen} /> : <Empty title="Choose a thread">Select a client on the left to read and reply.</Empty>}
          </div>
        </div>
      )}
      <DocumentReviewDialog doc={open} open={!!open} onOpenChange={(o) => !o && setOpen(null)} />
    </div>
  );
}
