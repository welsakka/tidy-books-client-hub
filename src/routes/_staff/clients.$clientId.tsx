import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CloseBar, Empty, ErrorBox, PageSkeleton, Stat, DocStatusBadge } from "@/components/common";
import { DocumentsTable } from "@/components/DocumentsTable";
import { UploadForm } from "@/components/UploadForm";
import { Banking } from "@/components/bookkeeping/Banking";
import { FinancialReports } from "@/components/bookkeeping/FinancialReports";
import { DocumentFolders } from "@/components/bookkeeping/DocumentFolders";
import { Analytics } from "@/components/Analytics";
import { ProgressTracker } from "@/components/ProgressTracker";
import { MessageThread } from "@/components/MessageThread";
import { DocumentReviewDialog } from "@/components/DocumentReview";
import { supabase } from "@/integrations/supabase/client";
import { q, logActivity, type DocRow } from "@/lib/data";
import { summarize } from "@/lib/analytics";
import { useMe } from "@/lib/me-context";
import { CATEGORIES, canWorkBooks, isFirmAdmin } from "@/lib/constants";
import { inviteClientUser } from "@/lib/admin.functions";
import { fmtDate, fmtDateTime, fmtMoney0, fmtPeriod } from "@/lib/format";

const TABS = ["overview", "documents", "books", "analytics", "progress", "messages"] as const;

export const Route = createFileRoute("/_staff/clients/$clientId")({
  validateSearch: z.object({
    tab: z.enum(TABS).optional(),
    doc: z.string().optional(),
    req: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Client · Kenna's Empire" },
      { name: "description", content: "Client overview, documents, books, analytics, close progress and messages." },
      { property: "og:title", content: "Client · Kenna's Empire" },
      { property: "og:description", content: "Client workspace in Kenna's Empire." },
    ],
  }),
  component: ClientPage,
});

function ClientPage() {
  const { clientId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const me = useMe();
  const clients = useQuery(q.clients());
  const engs = useQuery(q.engagements());
  const people = useQuery(q.people());
  const tab = search.tab ?? "overview";
  const client = clients.data?.find((c) => c.id === clientId);
  const eng = engs.data?.find((e) => e.client_id === clientId);

  if (clients.isLoading || engs.isLoading) return <PageSkeleton />;
  if (clients.error) return <ErrorBox error={clients.error} />;
  if (!client) return <Empty title="Client not found">It may have been removed. Go back to Clients.</Empty>;
  const assignee = people.data?.find((p) => p.id === client.assignee_id)?.full_name ?? "Unassigned";
  const messageAbout = (o: { doc?: string; req?: string }) => navigate({ search: { tab: "messages", ...o } });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <h1 className="text-lg font-semibold">{client.name} {client.archived && <Badge variant="muted">Archived</Badge>}</h1>
          <p className="text-sm text-muted-foreground">{client.industry} · Preparer {assignee}</p>
        </div>
        {eng && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{fmtPeriod(eng.period)} close</span>
            <CloseBar percent={eng.percent} />
            <span className="num text-muted-foreground">due {fmtDate(eng.due_date)}</span>
          </div>
        )}
        {isFirmAdmin(me.role) && <InviteClientUser clientId={clientId} />}
      </div>
      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as (typeof TABS)[number] } })}>
        <div className="overflow-x-auto">
          <TabsList>
            {TABS.map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}
          </TabsList>
        </div>
        <TabsContent value="overview"><Overview clientId={clientId} assignee={assignee} onTab={(t) => navigate({ search: { tab: t } })} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab clientId={clientId} onMessage={messageAbout} /></TabsContent>
        <TabsContent value="books"><Banking clientId={clientId} /></TabsContent>
        <TabsContent value="analytics"><FinancialReports clientId={clientId} /></TabsContent>
        <TabsContent value="progress"><ProgressTracker clientId={clientId} /></TabsContent>
        <TabsContent value="messages"><StaffMessages clientId={clientId} doc={search.doc} req={search.req} /></TabsContent>
      </Tabs>
    </div>
  );
}

function StaffMessages({ clientId, doc, req }: { clientId: string; doc?: string; req?: string }) {
  const [open, setOpen] = useState<DocRow | null>(null);
  return (
    <>
      <MessageThread clientId={clientId} initialDocumentId={doc} initialRequestId={req} onOpenDocument={setOpen} />
      <DocumentReviewDialog doc={open} open={!!open} onOpenChange={(o) => !o && setOpen(null)} />
    </>
  );
}

function Overview({ clientId, assignee, onTab }: { clientId: string; assignee: string; onTab: (t: (typeof TABS)[number]) => void }) {
  const engs = useQuery(q.engagements());
  const docs = useQuery(q.documents(clientId));
  const reqs = useQuery(q.requests(clientId));
  const txns = useQuery(q.transactions(clientId));
  const msgs = useQuery(q.messages(clientId));
  const threads = useQuery(q.threads());
  const people = useQuery(q.people());
  const eng = engs.data?.find((e) => e.client_id === clientId);
  const latestMonth = useMemo(() => (txns.data ?? []).filter((t) => t.status === "posted" && t.kind === "regular").map((t) => t.txn_date.slice(0, 7)).sort().at(-1), [txns.data]);
  if (docs.isLoading || txns.isLoading || reqs.isLoading) return <PageSkeleton />;
  const pl = latestMonth ? summarize(txns.data ?? [], `${latestMonth}-01`, `${latestMonth}-31`) : null;
  const open = (reqs.data ?? []).filter((r) => r.status === "open");
  const recent = (docs.data ?? []).slice(0, 5);
  const unreadCount = threads.data?.find((t) => t.client_id === clientId)?.unread_from_client ?? 0;
  const lastClientMsg = [...(msgs.data?.messages ?? [])].reverse().find((m) => !m.author_is_staff);
  const author = people.data?.find((p) => p.id === lastClientMsg?.author_id)?.full_name;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-4">
        <Stat label="Assigned preparer" value={<span className="text-base">{assignee}</span>} />
        <Stat label="Close" value={`${eng?.percent ?? 0}%`} hint={eng ? fmtPeriod(eng.period) : "No close open"} />
        <Stat label="Missing documents" value={open.length} />
        <Stat label="Unread from client" value={unreadCount} />
      </div>
      <Section title="Blockers">
        {eng?.stages.filter((s) => s.status === "blocked").length ? (
          eng.stages.filter((s) => s.status === "blocked").map((s) => (
            <div key={s.id} className="text-sm"><span className="font-medium">{s.name}:</span> {s.blocker_note ?? "Blocked"}</div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No blocked stages.</p>
        )}
      </Section>
      <Section title="Missing documents" action={<Button size="sm" variant="ghost" onClick={() => onTab("documents")}>Manage</Button>}>
        {open.length ? open.map((r) => <div key={r.id} className="text-sm">{r.category}, {fmtPeriod(r.period)} <span className="text-muted-foreground">{r.note}</span></div>) : <p className="text-sm text-muted-foreground">Nothing outstanding.</p>}
      </Section>
      <Section title={pl ? `Profit and loss · ${fmtPeriod(`${latestMonth}-01`)}` : "Profit and loss"}>
        {pl ? (
          <div className="num space-y-1 text-sm">
            <div className="flex justify-between"><span>Revenue</span><span>{fmtMoney0(pl.revenue)}</span></div>
            <div className="flex justify-between"><span>Expenses</span><span>{fmtMoney0(pl.expenses)}</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold"><span>Net income</span><span>{fmtMoney0(pl.netIncome)}</span></div>
          </div>
        ) : <p className="text-sm text-muted-foreground">Nothing has been posted yet.</p>}
      </Section>
      <Section title="Recent uploads" className="lg:col-span-2" action={<Button size="sm" variant="ghost" onClick={() => onTab("documents")}>All documents</Button>}>
        {recent.length ? recent.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{d.original_filename}</span>
            <span className="text-xs text-muted-foreground">{d.category}</span>
            <DocStatusBadge status={d.status} />
          </div>
        )) : <p className="text-sm text-muted-foreground">No uploads yet.</p>}
      </Section>
      <Section title="Latest client message" action={<Button size="sm" variant="ghost" onClick={() => onTab("messages")}>Open thread</Button>}>
        {lastClientMsg ? (
          <div className="text-sm">
            <div className="text-xs text-muted-foreground">{author} · {fmtDateTime(lastClientMsg.created_at)} {unreadCount > 0 && <Badge className="ml-1">Unread</Badge>}</div>
            <p className="mt-1">{lastClientMsg.body}</p>
          </div>
        ) : <p className="text-sm text-muted-foreground">No messages from the client yet.</p>}
      </Section>
    </div>
  );
}

function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`surface space-y-2 p-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3>{action}</div>
      {children}
    </div>
  );
}

function DocumentsTab({ clientId, onMessage }: { clientId: string; onMessage: (o: { doc?: string; req?: string }) => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const docs = useQuery(q.documents(clientId));
  const reqs = useQuery(q.requests(clientId));
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [cat, setCat] = useState("");
  const [month, setMonth] = useState("");
  const [note, setNote] = useState("");
  const canWork = canWorkBooks(me.role);

  async function createRequest() {
    if (!cat || !month) return;
    const { error } = await supabase.from("document_requests").insert({ client_id: clientId, category: cat, period: `${month}-01`, note: note || null, created_by: me.id });
    if (error) return toast.error(error.message);
    await logActivity(me, clientId, "request", `Requested ${cat} for ${month}`);
    toast.success("Request sent to the client");
    setReqOpen(false);
    setCat(""); setMonth(""); setNote("");
    qc.invalidateQueries({ queryKey: ["requests"] });
  }

  if (docs.isLoading) return <PageSkeleton />;
  if (docs.error) return <ErrorBox error={docs.error} />;
  const open = (reqs.data ?? []).filter((r) => r.status === "open");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canWork && <Button size="sm" onClick={() => setUploadOpen(true)}>Upload document</Button>}
        {canWork && <Button size="sm" variant="outline" onClick={() => setReqOpen(true)}>Request a document</Button>}
      </div>
      <div className="surface p-4">
        <h3 className="mb-2 text-sm font-semibold">Open requests</h3>
        {open.length === 0 ? <p className="text-sm text-muted-foreground">No open requests. Request a document when something is missing.</p> : (
          <div className="space-y-1">
            {open.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="warning">Missing</Badge>
                <span className="font-medium">{r.category}, {fmtPeriod(r.period)}</span>
                <span className="text-muted-foreground">{r.note}</span>
                <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => onMessage({ req: r.id })}>Message about this</Button>
              </div>
            ))}
          </div>
        )}
      </div>
      {(docs.data ?? []).length === 0 ? <Empty title="No documents yet">Upload a file or send the client a request.</Empty> : <DocumentFolders clientId={clientId} />}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
          <UploadForm clientId={clientId} onDone={() => setUploadOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request a document</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={cat} onValueChange={setCat}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Month</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Note for the client</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <DialogFooter><Button disabled={!cat || !month} onClick={createRequest}>Send request</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteClientUser({ clientId }: { clientId: string }) {
  const invite = useServerFn(inviteClientUser);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setError(null);
    try {
      const r = await invite({ data: { name, email, clientId } });
      setResult(r);
      qc.invalidateQueries({ queryKey: ["people"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    }
  }
  return (
    <>
      <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setOpen(true); setResult(null); setName(""); setEmail(""); }}>Invite client user</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite a client user</DialogTitle></DialogHeader>
          {result ? (
            <div className="space-y-2 text-sm">
              <p>The login is ready. Share these details with the client:</p>
              <div className="num rounded border bg-muted/40 p-3">Email: {result.email}<br />Temporary password: {result.password}</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              {error && <ErrorBox error={error} />}
            </div>
          )}
          <DialogFooter>{result ? <Button onClick={() => setOpen(false)}>Done</Button> : <Button disabled={!name || !email} onClick={submit}>Create login</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
