import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocStatusBadge, ErrorBox, ParseBadge } from "@/components/common";
import { FileViewer, downloadDocument } from "@/components/FileViewer";
import { supabase } from "@/integrations/supabase/client";
import { parseDocument } from "@/lib/parse.functions";
import { q, logActivity, type DocRow, type TxnRow } from "@/lib/data";
import { useMe } from "@/lib/me-context";
import { canWorkBooks } from "@/lib/constants";
import { fmtMoney, fmtPeriod } from "@/lib/format";
import { bq, moneyCents, recordTransaction } from "@/lib/bookkeeping";
import { AccountPicker } from "@/components/bookkeeping/shared";
import { Download, Plus, Trash2, Wand2 } from "lucide-react";

export function DocumentReviewDialog({ doc, open, onOpenChange }: { doc: DocRow | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-[min(1200px,96vw)] overflow-y-auto">
        {doc && <ReviewBody docId={doc.id} clientId={doc.client_id} />}
      </DialogContent>
    </Dialog>
  );
}

function ReviewBody({ docId, clientId }: { docId: string; clientId: string }) {
  const me = useMe();
  const qc = useQueryClient();
  const docs = useQuery(q.documents(clientId));
  const txns = useQuery(q.transactions(clientId));
  const accounts = useQuery(bq.accounts(clientId));
  const [bank, setBank] = useState("");
  const [category, setCategory] = useState("");
  const parse = useServerFn(parseDocument);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const doc = docs.data?.find((d) => d.id === docId);
  const bundle = useMemo(
    () => (doc?.bundle_id ? (docs.data ?? []).filter((d) => d.bundle_id === doc.bundle_id).sort((a, b) => a.bundle_index - b.bundle_index) : doc ? [doc] : []),
    [doc, docs.data],
  );
  const [page, setPage] = useState(0);
  const primaryId = bundle[0]?.id;
  const lines = (txns.data ?? []).filter((t) => t.document_id && bundle.some((b) => b.id === t.document_id)).sort((a, b) => a.txn_date.localeCompare(b.txn_date));
  const drafts = lines.filter((l) => l.status === "draft");
  const canWork = canWorkBooks(me.role);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
    qc.invalidateQueries({ queryKey: ["journals", clientId] });
  };

  if (!doc) return <div className="h-40" />;
  const summary = doc.parse_summary;

  async function runParse() {
    setBusy("parse");
    setActionError(null);
    try {
      const r = await parse({ data: { documentId: docId } });
      if (!r.ok) setActionError(r.error);
      else toast.success(`${r.rows} draft lines created${r.malformed ? `, ${r.malformed} malformed rows skipped` : ""}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Parsing failed.");
    }
    setBusy(null);
    refresh();
  }

  async function postDocument() {
    setBusy("post");
    setActionError(null);
    const ids = bundle.map((b) => b.id);
    try {
      for (const line of drafts) await recordTransaction(line.id, line.category_account_id ?? category, line.bank_account_id ?? bank);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Posting failed");
      refresh();
      setBusy(null);
      return;
    }
    await supabase.from("documents").update({ status: "Posted to books" }).in("id", ids);
    await logActivity(me, clientId, "post", `Posted ${drafts.length} lines from ${(doc?.original_filename ?? "document")}`);
    toast.success(`${drafts.length} lines posted to the books`);
    setBusy(null);
    refresh();
  }

  async function addLine() {
    const { error } = await supabase.from("transactions").insert({
      client_id: clientId,
      txn_date: (doc?.period ?? new Date().toISOString().slice(0, 10)),
      description: "Manual line",
      amount: 0,
      direction: "out",
      account: "Uncategorized",
      document_id: primaryId,
      status: "draft",
      created_by: me.id,
    });
    if (error) return toast.error(error.message);
    await logActivity(me, clientId, "edit", `Added a manual draft line to ${(doc?.original_filename ?? "document")}`);
    refresh();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {doc.original_filename} <DocStatusBadge status={doc.status} /> <ParseBadge status={doc.parse_status} />
        </DialogTitle>
        <DialogDescription>
          {doc.category} · {fmtPeriod(doc.period)}
          {bundle.length > 1 && ` · ${bundle.length} pages`}
          {doc.note && ` · Note: ${doc.note}`}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {bundle.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {bundle.map((b, i) => (
                <Button key={b.id} size="sm" variant={i === page ? "default" : "outline"} onClick={() => setPage(i)}>Page {i + 1}</Button>
              ))}
            </div>
          )}
          <FileViewer doc={bundle[page] ?? doc} />
          <Button size="sm" variant="outline" onClick={() => downloadDocument(bundle[page] ?? doc).catch((e) => toast.error(e.message))}>
            <Download className="mr-1 h-4 w-4" /> Download original
          </Button>
        </div>
        <div className="space-y-3">
          {doc.parse_error && <ErrorBox error={doc.parse_error} />}
          {actionError && actionError !== doc.parse_error && <ErrorBox error={actionError} />}
          {summary && <TieOut summary={summary} />}
          {summary?.malformed?.length ? (
            <div className="rounded border border-warning/50 bg-warning/10 p-2 text-xs">
              <div className="mb-1 font-medium">{summary.malformed.length} malformed rows were skipped</div>
              {summary.malformed.map((m, i) => (
                <div key={i} className="num">Line {m.line}: {m.reason} <span className="text-muted-foreground">“{m.raw}”</span></div>
              ))}
            </div>
          ) : null}
          {canWork && doc.status !== "Posted to books" && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={runParse} disabled={!!busy}>
                <Wand2 className="mr-1 h-4 w-4" /> {busy === "parse" ? "Parsing…" : doc.parse_status === "parsed" ? "Parse again" : "Parse"}
              </Button>
              <Button size="sm" variant="outline" onClick={addLine} disabled={!!busy}><Plus className="mr-1 h-4 w-4" /> Add line</Button>
              <Button size="sm" onClick={postDocument} disabled={!!busy || drafts.length === 0 || !bank || !category}>
                {busy === "post" ? "Posting…" : `Post ${drafts.length} lines to books`}
              </Button>
            </div>
          )}
          {canWork && drafts.length > 0 && <div className="flex flex-wrap gap-2"><AccountPicker label="Category account" accounts={accounts.data ?? []} value={category} onChange={setCategory} /><AccountPicker label="Bank account" accounts={(accounts.data ?? []).filter(a => ["bank", "credit_card"].includes(a.account_type))} value={bank} onChange={setBank} /></div>}
          <div className="overflow-x-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Dir.</TableHead>
                  <TableHead>Conf.</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      {canWork ? "No lines yet. Parse the document or add a line by hand." : "No lines have been extracted yet."}
                    </TableCell>
                  </TableRow>
                )}
                {lines.map((l) => <LineRow key={l.id + l.updated_at} line={l} editable={canWork && l.status === "draft"} clientId={clientId} onChange={refresh} />)}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}

function TieOut({ summary }: { summary: NonNullable<DocRow["parse_summary"]> }) {
  const f = (n: number | null) => (n == null ? "not found" : fmtMoney(n));
  return (
    <div className="rounded border p-2 text-xs">
      <div className="mb-1 flex items-center gap-2 font-medium">
        Balance check
        {summary.ties === true && <Badge variant="success">Ties</Badge>}
        {summary.ties === false && <Badge variant="danger">Does not tie</Badge>}
        {summary.ties == null && <Badge variant="muted">Totals not found</Badge>}
        <span className="ml-auto font-normal text-muted-foreground">{summary.method === "model" ? "Read by model" : "Read by code"} · {summary.row_count} rows</span>
      </div>
      <div className="num grid grid-cols-2 gap-x-4 sm:grid-cols-4">
        <span>Opening {f(summary.opening_balance)}</span>
        <span>Deposits {f(summary.total_deposits)}</span>
        <span>Withdrawals {f(summary.total_withdrawals)}</span>
        <span>Ending {f(summary.ending_balance)}</span>
      </div>
      {summary.ties !== true && <p className="mt-1 text-muted-foreground">Every line stays a draft until a preparer checks it against the original.</p>}
    </div>
  );
}

function LineRow({ line, editable, clientId, onChange }: { line: TxnRow; editable: boolean; clientId: string; onChange: () => void }) {
  const me = useMe();
  const [v, setV] = useState({ txn_date: line.txn_date, description: line.description, account: line.account, amount: String(line.amount), direction: line.direction });
  const dirty = v.txn_date !== line.txn_date || v.description !== line.description || v.account !== line.account || Number(v.amount) !== Number(line.amount) || v.direction !== line.direction;
  async function save() {
    let cents; try { cents = Math.abs(moneyCents(v.amount)); } catch { return toast.error("Enter an amount with at most two decimal places"); }
    const amount = cents / 100;
    const { error } = await supabase.from("transactions").update({ ...v, amount, amount_cents: cents, updated_at: new Date().toISOString() }).eq("id", line.id);
    if (error) return toast.error(error.message);
    await logActivity(me, clientId, "edit", `Edited draft line "${v.description}" ${fmtMoney(amount)}`);
    onChange();
  }
  async function remove() {
    const { error } = await supabase.from("transactions").delete().eq("id", line.id);
    if (error) return toast.error(error.message);
    await logActivity(me, clientId, "edit", `Deleted draft line "${line.description}"`);
    onChange();
  }
  if (!editable)
    return (
      <TableRow>
        <TableCell className="num whitespace-nowrap">{line.txn_date}</TableCell>
        <TableCell>{line.description}</TableCell>
        <TableCell>{line.account}</TableCell>
        <TableCell className="num text-right">{fmtMoney(Number(line.amount))}</TableCell>
        <TableCell>{line.direction}</TableCell>
        <TableCell className="num">{line.confidence != null ? Number(line.confidence).toFixed(2) : "—"}</TableCell>
        <TableCell><Badge variant={line.status === "posted" ? "success" : "muted"}>{line.status}</Badge></TableCell>
      </TableRow>
    );
  return (
    <TableRow>
      <TableCell><Input type="date" className="num h-7 w-36 text-xs" value={v.txn_date} onChange={(e) => setV({ ...v, txn_date: e.target.value })} /></TableCell>
      <TableCell><Input className="h-7 min-w-40 text-xs" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></TableCell>
      <TableCell><Input className="h-7 w-32 text-xs" value={v.account} onChange={(e) => setV({ ...v, account: e.target.value })} /></TableCell>
      <TableCell><Input className="num h-7 w-24 text-right text-xs" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></TableCell>
      <TableCell>
        <Select value={v.direction} onValueChange={(d) => setV({ ...v, direction: d as "in" | "out" })}>
          <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="in">in</SelectItem><SelectItem value="out">out</SelectItem></SelectContent>
        </Select>
      </TableCell>
      <TableCell className="num text-xs">{line.confidence != null ? Number(line.confidence).toFixed(2) : "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        {dirty && <Button size="sm" className="h-7 px-2" onClick={save}>Save</Button>}
        <Button size="sm" variant="ghost" className="h-7 px-2" aria-label="Delete line" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
      </TableCell>
    </TableRow>
  );
}
