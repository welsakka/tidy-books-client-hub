import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocStatusBadge, ParseBadge, ScrollTable } from "@/components/common";
import { DocumentReviewDialog } from "@/components/DocumentReview";
import { downloadDocument } from "@/components/FileViewer";
import { supabase } from "@/integrations/supabase/client";
import { parseDocument } from "@/lib/parse.functions";
import { logActivity, sendMessage, type DocRow } from "@/lib/data";
import { useMe } from "@/lib/me-context";
import { CATEGORIES, canWorkBooks } from "@/lib/constants";
import { fmtBytes, fmtDate, fmtPeriod } from "@/lib/format";
import { MoreHorizontal } from "lucide-react";

export function DocumentsTable({
  docs,
  clientNames,
  onMessage,
}: {
  docs: DocRow[];
  clientNames?: Map<string, string>;
  onMessage?: (doc: DocRow) => void;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const parse = useServerFn(parseDocument);
  const staff = me.role !== "client";
  const canWork = canWorkBooks(me.role);
  const [review, setReview] = useState<DocRow | null>(null);
  const [reject, setReject] = useState<DocRow | null>(null);
  const [edit, setEdit] = useState<DocRow | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
    qc.invalidateQueries({ queryKey: ["messages"] });
    qc.invalidateQueries({ queryKey: ["threads"] });
  };

  async function accept(d: DocRow) {
    const { error } = await supabase.from("documents").update({ status: "Accepted", rejection_reason: null }).eq("id", d.id);
    if (error) return toast.error(`Not accepted: ${error.message}`);
    await logActivity(me, d.client_id, "accept", `Accepted ${d.original_filename}`);
    toast.success("Document accepted");
    refresh();
  }
  async function runParse(d: DocRow) {
    const t = toast.loading(`Parsing ${d.original_filename}…`);
    try {
      const r = await parse({ data: { documentId: d.id } });
      toast.dismiss(t);
      if (r.ok) toast.success(`${r.rows} draft lines created`);
      else toast.error(r.error);
    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "Parsing failed");
    }
    refresh();
  }

  // Bundled photos show as one row (first page).
  const rows = docs.filter((d) => !d.bundle_id || d.bundle_index === 0);
  const pageCount = (d: DocRow) => (d.bundle_id ? docs.filter((x) => x.bundle_id === d.bundle_id).length : 1);

  return (
    <>
      <ScrollTable>
        <Table>
          <TableHeader>
            <TableRow>
              {clientNames && <TableHead>Client</TableHead>}
              <TableHead>File</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Parsing</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                {clientNames && <TableCell className="whitespace-nowrap">{clientNames.get(d.client_id)}</TableCell>}
                <TableCell>
                  <button className="text-left font-medium hover:underline" onClick={() => (staff ? setReview(d) : downloadDocument(d).catch((e) => toast.error(e.message)))}>
                    {d.original_filename}
                  </button>
                  <div className="num text-xs text-muted-foreground">
                    {fmtBytes(d.size_bytes)}{pageCount(d) > 1 && ` · ${pageCount(d)} pages`}
                  </div>
                  {d.status === "Rejected" && d.rejection_reason && <div className="text-xs text-destructive">Rejected: {d.rejection_reason}</div>}
                  {d.parse_status === "failed" && d.parse_error && <div className="text-xs text-destructive">{d.parse_error}</div>}
                </TableCell>
                <TableCell className="whitespace-nowrap">{d.category}</TableCell>
                <TableCell className="num whitespace-nowrap">{fmtPeriod(d.period)}</TableCell>
                <TableCell className="num whitespace-nowrap text-xs">{fmtDate(d.created_at.slice(0, 10))}</TableCell>
                <TableCell><DocStatusBadge status={d.status} /></TableCell>
                <TableCell><ParseBadge status={d.parse_status} /></TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" aria-label={`Actions for ${d.original_filename}`}><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {staff && <DropdownMenuItem onClick={() => setReview(d)}>Review and lines</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => downloadDocument(d).catch((e) => toast.error(e.message))}>Download original</DropdownMenuItem>
                      {onMessage && <DropdownMenuItem onClick={() => onMessage(d)}>Message about this file</DropdownMenuItem>}
                      {canWork && (
                        <>
                          <DropdownMenuSeparator />
                          {d.status !== "Posted to books" && <DropdownMenuItem onClick={() => runParse(d)}>Parse</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => setEdit(d)}>Change category or period</DropdownMenuItem>
                          {d.status !== "Accepted" && d.status !== "Posted to books" && <DropdownMenuItem onClick={() => accept(d)}>Accept</DropdownMenuItem>}
                          {d.status !== "Rejected" && d.status !== "Posted to books" && (
                            <DropdownMenuItem className="text-destructive" onClick={() => setReject(d)}>Reject…</DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollTable>
      <DocumentReviewDialog doc={review} open={!!review} onOpenChange={(o) => !o && setReview(null)} />
      <RejectDialog doc={reject} onClose={() => setReject(null)} onDone={refresh} />
      <EditDialog doc={edit} onClose={() => setEdit(null)} onDone={refresh} />
    </>
  );
}

function RejectDialog({ doc, onClose, onDone }: { doc: DocRow | null; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!doc || !reason.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("documents").update({ status: "Rejected", rejection_reason: reason.trim() }).eq("id", doc.id);
    if (error) {
      setBusy(false);
      return toast.error(`Not rejected: ${error.message}`);
    }
    try {
      await sendMessage({ clientId: doc.client_id, authorId: me.id, body: `We couldn't use ${doc.original_filename}: ${reason.trim()}`, documentId: doc.id });
    } catch (e) {
      toast.error(`Rejected, but the message to the client failed: ${e instanceof Error ? e.message : ""}`);
    }
    await logActivity(me, doc.client_id, "reject", `Rejected ${doc.original_filename}: ${reason.trim()}`);
    setBusy(false);
    setReason("");
    toast.success("Rejected and the client was told why");
    onDone();
    onClose();
  }
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reject {doc?.original_filename}</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason the client will see (required)</Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Pages 2 and 3 are missing." />
          <p className="text-xs text-muted-foreground">The reason is also posted to the client's message thread.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!reason.trim() || busy} onClick={submit}>Reject document</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ doc, onClose, onDone }: { doc: DocRow | null; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const [category, setCategory] = useState("");
  const [month, setMonth] = useState("");
  const key = doc?.id;
  const [loadedFor, setLoadedFor] = useState<string | undefined>();
  if (doc && loadedFor !== key) {
    setLoadedFor(key);
    setCategory(doc.category);
    setMonth(doc.period.slice(0, 7));
  }
  async function save() {
    if (!doc || !category || !month) return;
    const { error } = await supabase.from("documents").update({ category, period: `${month}-01` }).eq("id", doc.id);
    if (error) return toast.error(error.message);
    await logActivity(me, doc.client_id, "categorize", `${doc.original_filename}: ${category}, ${month}`);
    toast.success("Document updated");
    onDone();
    onClose();
  }
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Category and period</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!category || !month} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
