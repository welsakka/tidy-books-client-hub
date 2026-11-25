import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, ErrorBox, ScrollTable, TableSkeleton } from "@/components/common";
import { DocumentReviewDialog } from "@/components/DocumentReview";
import { supabase } from "@/integrations/supabase/client";
import { q, logActivity, type DocRow, type TxnRow } from "@/lib/data";
import { useMe } from "@/lib/me-context";
import { canWorkBooks } from "@/lib/constants";
import { bq, moneyCents, recordTransaction } from "@/lib/bookkeeping";
import { AccountPicker } from "@/components/bookkeeping/shared";
import { fmtMoney } from "@/lib/format";

type Edit = { id?: string; txn_date: string; description: string; payee: string; account: string; category: string; amount: string; direction: "in" | "out"; kind: string };

export function LedgerTable({ clientId, readOnly }: { clientId: string; readOnly?: boolean }) {
  const me = useMe();
  const qc = useQueryClient();
  const txns = useQuery(q.transactions(clientId));
  const accounts = useQuery(bq.accounts(clientId));
  const [bank, setBank] = useState("");
  const [categoryAccount, setCategoryAccount] = useState("");
  const docs = useQuery({ ...q.documents(clientId), enabled: !readOnly });
  const [status, setStatus] = useState("all");
  const [term, setTerm] = useState("");
  const [limit, setLimit] = useState(100);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [review, setReview] = useState<DocRow | null>(null);
  const canWork = !readOnly && canWorkBooks(me.role);
  const docMap = useMemo(() => new Map((docs.data ?? []).map((d) => [d.id, d])), [docs.data]);

  const rows = useMemo(() => {
    const t = term.toLowerCase();
    return (txns.data ?? []).filter(
      (x) => (status === "all" || x.status === status) && (!t || `${x.description} ${x.payee} ${x.account}`.toLowerCase().includes(t)),
    );
  }, [txns.data, status, term]);
  const drafts = (txns.data ?? []).filter((x) => x.status === "draft");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
    qc.invalidateQueries({ queryKey: ["journals", clientId] });
  };

  async function postAll() {
    try { for (const t of drafts) await recordTransaction(t.id, t.category_account_id ?? categoryAccount, t.bank_account_id ?? bank); toast.success(`${drafts.length} lines posted`); } catch(e) { toast.error(e instanceof Error ? e.message : "Posting failed"); } refresh();
  }
  async function postOne(t: TxnRow) {
    try { await recordTransaction(t.id, t.category_account_id ?? categoryAccount, t.bank_account_id ?? bank); } catch(e) { toast.error(e instanceof Error ? e.message : "Posting failed"); } refresh();
  }
  async function save() {
    if (!edit) return;
    let cents; try { cents = Math.abs(moneyCents(edit.amount)); } catch { return toast.error("Enter an amount with at most two decimal places"); }
    const amount = cents / 100;
    if (!edit.txn_date || !Number.isFinite(amount)) return toast.error("Date and a numeric amount are required");
    const payload = { txn_date: edit.txn_date, description: edit.description, payee: edit.payee, account: edit.account, category: edit.category, amount_cents: cents, amount, direction: edit.direction, updated_at: new Date().toISOString() };
    const res = edit.id
      ? await supabase.from("transactions").update(payload).eq("id", edit.id)
      : await supabase.from("transactions").insert({ ...payload, client_id: clientId, kind: "adjusting", status: "draft", created_by: me.id });
    if (res.error) return toast.error(res.error.message);
    await logActivity(me, clientId, "edit", `${edit.id ? "Edited" : "Added adjusting entry"} "${edit.description}" ${fmtMoney(amount)}`);
    toast.success(edit.id ? "Line updated" : "Adjusting entry added as a draft");
    setEdit(null);
    refresh();
  }

  if (txns.isLoading) return <TableSkeleton />;
  if (txns.error) return <ErrorBox error={txns.error} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-8 w-56" placeholder="Search description, payee, account" value={term} onChange={(e) => setTerm(e.target.value)} />
        {!readOnly && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lines</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
            </SelectContent>
          </Select>
        )}
        <span className="num text-xs text-muted-foreground">{rows.length} lines{!readOnly && ` · ${drafts.length} drafts`}</span>
        {canWork && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEdit({ txn_date: new Date().toISOString().slice(0, 10), description: "", payee: "", account: "", category: "Adjustment", amount: "", direction: "out", kind: "adjusting" })}>
              Add adjusting entry
            </Button>
            <Button size="sm" disabled={!drafts.length || !bank || !categoryAccount} onClick={postAll}>Post all drafts</Button>
          </div>
        )}
      </div>
      {canWork && <div className="flex flex-wrap gap-2"><AccountPicker label="Category account" value={categoryAccount} onChange={setCategoryAccount} accounts={accounts.data ?? []}/><AccountPicker label="Bank account" value={bank} onChange={setBank} accounts={(accounts.data ?? []).filter(a=>["bank","credit_card"].includes(a.account_type))}/></div>}
      {rows.length === 0 ? (
        <Empty title={readOnly ? "Nothing has been posted yet" : "No ledger lines match"}>
          {readOnly ? "Your books will appear here once the firm posts them." : "Parse a document or add an adjusting entry."}
        </Empty>
      ) : (
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Dir.</TableHead>
                {!readOnly && <TableHead>Source</TableHead>}
                <TableHead>Status</TableHead>
                {canWork && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, limit).map((t) => {
                const src = t.document_id ? docMap.get(t.document_id) : null;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="num whitespace-nowrap">{t.txn_date}</TableCell>
                    <TableCell className="min-w-48">{t.description}{t.kind !== "regular" && <Badge variant="outline" className="ml-1 text-[10px]">{t.kind}</Badge>}</TableCell>
                    <TableCell className="whitespace-nowrap">{t.payee}</TableCell>
                    <TableCell className="whitespace-nowrap">{t.account}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{t.category}</TableCell>
                    <TableCell className={`num whitespace-nowrap text-right ${t.direction === "in" ? "text-success" : ""}`}>{t.direction === "out" ? "−" : ""}{fmtMoney(Number(t.amount))}</TableCell>
                    <TableCell>{t.direction}</TableCell>
                    {!readOnly && (
                      <TableCell className="max-w-40 truncate text-xs">
                        {src ? <button className="hover:underline" onClick={() => setReview(src)}>{src.original_filename}</button> : "—"}
                      </TableCell>
                    )}
                    <TableCell><Badge variant={t.status === "posted" ? "success" : "muted"}>{t.status}</Badge></TableCell>
                    {canWork && (
                      <TableCell className="whitespace-nowrap">
                        {t.status === "draft" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => setEdit({ ...t, amount: String(t.amount) })}>Edit</Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => postOne(t)}>Post</Button>
                          </>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length > limit && (
            <div className="border-t p-2 text-center">
              <Button size="sm" variant="ghost" onClick={() => setLimit(limit + 200)}>Show more ({rows.length - limit} remaining)</Button>
            </div>
          )}
        </ScrollTable>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit draft line" : "Adjusting entry"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date"><Input type="date" value={edit.txn_date} onChange={(e) => setEdit({ ...edit, txn_date: e.target.value })} /></Field>
              <Field label="Amount"><Input className="num" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
              <Field label="Description" wide><Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <Field label="Payee"><Input value={edit.payee} onChange={(e) => setEdit({ ...edit, payee: e.target.value })} /></Field>
              <Field label="Account"><Input value={edit.account} onChange={(e) => setEdit({ ...edit, account: e.target.value })} /></Field>
              <Field label="Category"><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field>
              <Field label="Direction">
                <Select value={edit.direction} onValueChange={(d) => setEdit({ ...edit, direction: d as "in" | "out" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="in">in (money received)</SelectItem><SelectItem value="out">out (money paid)</SelectItem></SelectContent>
                </Select>
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save}>Save draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DocumentReviewDialog doc={review} open={!!review} onOpenChange={(o) => !o && setReview(null)} />
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
