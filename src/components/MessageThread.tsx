import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Empty, ErrorBox, TableSkeleton } from "@/components/common";
import { q, sendMessage, markThreadRead, type DocRow } from "@/lib/data";
import { useMe } from "@/lib/me-context";
import { ROLE_LABEL, FIRM_NAME } from "@/lib/constants";
import { fmtDateTime, fmtPeriod } from "@/lib/format";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

export function MessageThread({
  clientId,
  initialDocumentId,
  initialRequestId,
  onOpenDocument,
}: {
  clientId: string;
  initialDocumentId?: string | null;
  initialRequestId?: string | null;
  onOpenDocument?: (doc: DocRow) => void;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const msgs = useQuery({ ...q.messages(clientId), refetchInterval: 15000 });
  const people = useQuery(q.people());
  const docs = useQuery(q.documents(clientId));
  const reqs = useQuery(q.requests(clientId));
  const [body, setBody] = useState("");
  const [docId, setDocId] = useState<string>(initialDocumentId ?? "none");
  const [reqId, setReqId] = useState<string>(initialRequestId ?? "none");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDocId(initialDocumentId ?? "none"), [initialDocumentId]);
  useEffect(() => setReqId(initialRequestId ?? "none"), [initialRequestId]);

  const threadId = msgs.data?.threadId;
  const lastAt = msgs.data?.messages.at(-1)?.created_at;
  useEffect(() => {
    if (!threadId) return;
    markThreadRead(threadId, me.id).then(() => qc.invalidateQueries({ queryKey: ["threads"] }));
    endRef.current?.scrollIntoView({ block: "end" });
  }, [threadId, lastAt, me.id, qc]);

  const peopleMap = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p])), [people.data]);
  const docMap = useMemo(() => new Map((docs.data ?? []).map((d) => [d.id, d])), [docs.data]);
  const reqMap = useMemo(() => new Map((reqs.data ?? []).map((r) => [r.id, r])), [reqs.data]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendMessage({ clientId, authorId: me.id, body: body.trim(), documentId: docId === "none" ? null : docId, requestId: reqId === "none" ? null : reqId });
      setBody("");
      setDocId("none");
      setReqId("none");
      await qc.invalidateQueries({ queryKey: ["messages", clientId] });
      qc.invalidateQueries({ queryKey: ["threads"] });
      toast.success("Message sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  if (msgs.isLoading) return <TableSkeleton rows={4} />;
  if (msgs.error) return <ErrorBox error={msgs.error} />;

  return (
    <div className="surface flex flex-col">
      <div className="max-h-[60vh] min-h-48 space-y-3 overflow-y-auto p-4">
        {msgs.data!.messages.length === 0 && (
          <Empty title="No messages yet">Start the conversation below. Messages stay inside this workspace.</Empty>
        )}
        {msgs.data!.messages.map((m) => {
          const author = peopleMap.get(m.author_id);
          const mine = m.author_id === me.id;
          const doc = m.document_id ? docMap.get(m.document_id) : null;
          const req = m.request_id ? reqMap.get(m.request_id) : null;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-lg border px-3 py-2", m.author_is_staff ? "bg-card" : "bg-accent/60")}>
                <div className="mb-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{author?.full_name ?? "Unknown"}</span>
                  <span>{author ? (author.role === "client" ? "Client" : `${ROLE_LABEL[author.role]}, ${FIRM_NAME}`) : ""}</span>
                  <span className="num">{fmtDateTime(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                {doc && (
                  <button
                    type="button"
                    onClick={() => onOpenDocument?.(doc)}
                    className="mt-1.5 inline-flex items-center gap-1 rounded border bg-muted/50 px-2 py-0.5 text-xs hover:border-primary"
                  >
                    <Paperclip className="h-3 w-3" /> {doc.original_filename} · {doc.category}
                  </button>
                )}
                {req && (
                  <Badge variant="outline" className="ml-1 mt-1.5 text-xs">
                    Request: {req.category}, {fmtPeriod(req.period)}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="space-y-2 border-t p-3">
        <Textarea rows={2} maxLength={5000} placeholder="Write a message" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={docId} onValueChange={setDocId}>
            <SelectTrigger className="h-8 w-56" aria-label="Link a document"><SelectValue placeholder="Link a document" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No linked document</SelectItem>
              {(docs.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.original_filename}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reqId} onValueChange={setReqId}>
            <SelectTrigger className="h-8 w-56" aria-label="Link a request"><SelectValue placeholder="Link a request" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No linked request</SelectItem>
              {(reqs.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.category}, {fmtPeriod(r.period)}{r.status === "fulfilled" ? " (received)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" className="ml-auto" disabled={busy || !body.trim()}>{busy ? "Sending…" : "Send"}</Button>
        </div>
        {error && <ErrorBox error={error} />}
      </form>
    </div>
  );
}
