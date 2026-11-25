import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorBox, PageHeader, PageSkeleton, ScrollTable } from "@/components/common";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, logActivity, q } from "@/lib/data";
import { useMe } from "@/lib/me-context";
import { ROLE_LABEL, isFirmAdmin, type AppRole } from "@/lib/constants";
import { changeRole, inviteClientUser, inviteStaff, setPersonStatus } from "@/lib/admin.functions";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_staff/admin")({
  beforeLoad: async () => {
    const me = await loadMe();
    if (!isFirmAdmin(me?.role)) throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Admin · Kenna's Empire" },
      { name: "description", content: "Staff, clients, client users and the firm activity log." },
      { property: "og:title", content: "Admin · Kenna's Empire" },
      { property: "og:description", content: "Firm administration for Kenna's Empire." },
    ],
  }),
  component: Admin,
});

function useRefresh() {
  const qc = useQueryClient();
  return () => ["people", "clients", "activity", "engagements", "threads"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

function Admin() {
  return (
    <div>
      <PageHeader title="Admin" subtitle="Invite staff without limits, manage clients and review activity" />
      <Tabs defaultValue="staff">
        <TabsList><TabsTrigger value="staff">Staff</TabsTrigger><TabsTrigger value="clients">Clients</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="clients"><ClientsTab /></TabsContent>
        <TabsContent value="activity"><ActivityTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CredentialNote({ r }: { r: { email: string; password: string } }) {
  return (
    <div className="space-y-2 text-sm">
      <p>The login works now. Share these details:</p>
      <div className="num rounded border bg-muted/40 p-3">Email: {r.email}<br />Temporary password: {r.password}</div>
    </div>
  );
}

function StaffTab() {
  const me = useMe();
  const people = useQuery(q.people());
  const clients = useQuery(q.clients());
  const refresh = useRefresh();
  const invite = useServerFn(inviteStaff);
  const role = useServerFn(changeRole);
  const status = useServerFn(setPersonStatus);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", role: "preparer" as "admin" | "preparer" | "reviewer" });
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (people.isLoading) return <PageSkeleton />;
  if (people.error) return <ErrorBox error={people.error} />;
  const staff = (people.data ?? []).filter((p) => p.role !== "client");
  const count = (id: string) => (clients.data ?? []).filter((c) => c.assignee_id === id && !c.archived).length;

  async function submit() {
    setError(null);
    try {
      setResult(await invite({ data: f }));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    }
  }
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => { setOpen(true); setResult(null); setF({ name: "", email: "", role: "preparer" }); }}>Invite staff member</Button>
      <ScrollTable>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Clients</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {staff.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="whitespace-nowrap font-medium">{p.full_name}</TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>
                  {p.role === "owner" || p.id === me.id ? ROLE_LABEL[p.role] : (
                    <Select value={p.role} onValueChange={(v) => act(() => role({ data: { userId: p.id, role: v as "admin" } }), "Role changed")}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{(["admin", "preparer", "reviewer"] as AppRole[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell><Badge variant={p.status === "active" ? "success" : "muted"}>{p.status}</Badge></TableCell>
                <TableCell className="num text-right">{count(p.id)}</TableCell>
                <TableCell className="text-right">
                  {p.role !== "owner" && p.id !== me.id && (
                    <Button size="sm" variant="ghost" onClick={() => act(() => status({ data: { userId: p.id, active: p.status !== "active" } }), p.status === "active" ? "Deactivated" : "Reactivated")}>
                      {p.status === "active" ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollTable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite a staff member</DialogTitle></DialogHeader>
          {result ? <CredentialNote r={result} /> : (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Role</Label>
                <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as typeof f.role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="preparer">Preparer</SelectItem><SelectItem value="reviewer">Reviewer</SelectItem></SelectContent>
                </Select>
              </div>
              {error && <ErrorBox error={error} />}
            </div>
          )}
          <DialogFooter>{result ? <Button onClick={() => setOpen(false)}>Done</Button> : <Button disabled={!f.name || !f.email} onClick={submit}>Create login</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientsTab() {
  const me = useMe();
  const clients = useQuery(q.clients());
  const people = useQuery(q.people());
  const refresh = useRefresh();
  const status = useServerFn(setPersonStatus);
  const inviteUser = useServerFn(inviteClientUser);
  const [addOpen, setAddOpen] = useState(false);
  const [nc, setNc] = useState({ name: "", industry: "", contact_name: "", contact_email: "" });
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [iv, setIv] = useState({ name: "", email: "" });
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  if (clients.isLoading || people.isLoading) return <PageSkeleton />;
  if (clients.error) return <ErrorBox error={clients.error} />;
  const preparers = (people.data ?? []).filter((p) => ["preparer", "admin", "owner"].includes(p.role) && p.status === "active");
  const users = (id: string) => (people.data ?? []).filter((p) => p.role === "client" && p.client_id === id);

  async function addClient() {
    const { data, error } = await supabase.from("clients").insert(nc).select("id").single();
    if (error) return toast.error(error.message);
    const today = new Date();
    const period = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
    const due = new Date(today.getFullYear(), today.getMonth(), 25).toISOString().slice(0, 10);
    const { data: eng } = await supabase.from("engagements").insert({ client_id: data.id, period, due_date: due }).select("id").single();
    if (eng) {
      const names = ["Intake", "Document collection", "Categorization", "Bank reconciliation", "Adjusting entries", "Review", "Client questions", "Delivery"];
      const w = [5, 15, 20, 20, 15, 10, 5, 10];
      await supabase.from("engagement_stages").insert(names.map((name, i) => ({ engagement_id: eng.id, name, position: i + 1, weight: w[i] })));
    }
    await supabase.from("message_threads").insert({ client_id: data.id });
    await logActivity(me, data.id, "client", `Added client ${nc.name}`);
    toast.success("Client added with a monthly close");
    setAddOpen(false);
    setNc({ name: "", industry: "", contact_name: "", contact_email: "" });
    refresh();
  }
  async function update(id: string, patch: { assignee_id?: string | null; archived?: boolean }, detail: string) {
    const { error } = await supabase.from("clients").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity(me, id, "client", detail);
    toast.success("Saved");
    refresh();
  }
  async function sendInvite() {
    try {
      setResult(await inviteUser({ data: { ...iv, clientId: inviteFor! } }));
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    }
  }

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => setAddOpen(true)}>Add client</Button>
      <ScrollTable>
        <Table>
          <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Industry</TableHead><TableHead>Preparer</TableHead><TableHead>Client users</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {(clients.data ?? []).map((c) => (
              <TableRow key={c.id} className={c.archived ? "opacity-60" : ""}>
                <TableCell className="whitespace-nowrap font-medium">{c.name} {c.archived && <Badge variant="muted">Archived</Badge>}<div className="text-xs font-normal text-muted-foreground">{c.contact_name} · {c.contact_email}</div></TableCell>
                <TableCell className="text-muted-foreground">{c.industry}</TableCell>
                <TableCell>
                  <Select value={c.assignee_id ?? "none"} onValueChange={(v) => update(c.id, { assignee_id: v === "none" ? null : v }, `Assigned ${c.name} to ${preparers.find((p) => p.id === v)?.full_name ?? "nobody"}`)}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Unassigned</SelectItem>{preparers.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="space-y-1">
                  {users(c.id).map((u) => (
                    <div key={u.id} className="flex items-center gap-2 text-xs">
                      <span>{u.full_name}</span>
                      <Badge variant={u.status === "active" ? "success" : "muted"}>{u.status}</Badge>
                      <button className="underline" onClick={async () => { try { await status({ data: { userId: u.id, active: u.status !== "active" } }); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } }}>
                        {u.status === "active" ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setInviteFor(c.id); setIv({ name: "", email: "" }); setResult(null); }}>Invite user</Button>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => update(c.id, { archived: !c.archived }, `${c.archived ? "Restored" : "Archived"} ${c.name}`)}>{c.archived ? "Restore" : "Archive"}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollTable>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a client</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Business name</Label><Input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Industry</Label><Input value={nc.industry} onChange={(e) => setNc({ ...nc, industry: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Contact name</Label><Input value={nc.contact_name} onChange={(e) => setNc({ ...nc, contact_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Contact email</Label><Input type="email" value={nc.contact_email} onChange={(e) => setNc({ ...nc, contact_email: e.target.value })} /></div>
          </div>
          <DialogFooter><Button disabled={!nc.name.trim()} onClick={addClient}>Add client</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!inviteFor} onOpenChange={(o) => !o && setInviteFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite a client user</DialogTitle></DialogHeader>
          {result ? <CredentialNote r={result} /> : (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={iv.name} onChange={(e) => setIv({ ...iv, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={iv.email} onChange={(e) => setIv({ ...iv, email: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>{result ? <Button onClick={() => setInviteFor(null)}>Done</Button> : <Button disabled={!iv.name || !iv.email} onClick={sendInvite}>Create login</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityTab() {
  const act = useQuery(q.activity());
  const clients = useQuery(q.clients());
  if (act.isLoading) return <PageSkeleton />;
  if (act.error) return <ErrorBox error={act.error} />;
  const name = (id: string | null) => (clients.data ?? []).find((c) => c.id === id)?.name ?? "Firm";
  return (
    <ScrollTable>
      <Table>
        <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Client</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
        <TableBody>
          {(act.data ?? []).map((a) => (
            <TableRow key={a.id}>
              <TableCell className="num whitespace-nowrap text-xs">{fmtDateTime(a.created_at)}</TableCell>
              <TableCell className="whitespace-nowrap">{a.actor_name}</TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{a.action}</Badge></TableCell>
              <TableCell className="whitespace-nowrap">{name(a.client_id)}</TableCell>
              <TableCell className="min-w-64 text-xs">{a.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollTable>
  );
}
