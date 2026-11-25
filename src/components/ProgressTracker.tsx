import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CloseBar, Empty, ErrorBox, ScrollTable, StageStatusBadge, TableSkeleton } from "@/components/common";
import { supabase } from "@/integrations/supabase/client";
import { q, logActivity } from "@/lib/data";
import { useMe } from "@/lib/me-context";
import { STAGE_STATUSES } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtPeriod } from "@/lib/format";

type Stage = {
  id: string; name: string; position: number; weight: number; percent: number; assignee_id: string | null;
  status: string; blocker_note: string | null; signed_off_by: string | null; updated_at: string;
};

export function ProgressTracker({ clientId, readOnly }: { clientId: string; readOnly?: boolean }) {
  const me = useMe();
  const engs = useQuery(q.engagements());
  const people = useQuery({ ...q.people(), enabled: !readOnly || true });
  if (engs.isLoading) return <TableSkeleton rows={8} />;
  if (engs.error) return <ErrorBox error={engs.error} />;
  const eng = (engs.data ?? []).find((e) => e.client_id === clientId);
  if (!eng) return <Empty title="No monthly close has been opened yet">The firm opens a close engagement for each month.</Empty>;
  const staff = (people.data ?? []).filter((p) => p.role !== "client" && p.status === "active");
  const name = (id: string | null) => (people.data ?? []).find((p) => p.id === id)?.full_name ?? "Unassigned";
  const editable = !readOnly && me.role !== "client";

  return (
    <div className="space-y-3">
      <div className="surface flex flex-wrap items-center gap-6 p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{fmtPeriod(eng.period)} close</div>
          <div className="num text-3xl font-semibold">{eng.percent}%</div>
        </div>
        <Progress value={eng.percent} className="h-2 min-w-40 flex-1" />
        <div className="text-sm text-muted-foreground">Due <span className="num font-medium text-foreground">{fmtDate(eng.due_date)}</span></div>
      </div>
      <ScrollTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead>Complete</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Blocker</TableHead>
              <TableHead>Updated</TableHead>
              {editable && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(eng.stages as Stage[]).map((s) =>
              editable ? (
                <EditableStage key={s.id + s.updated_at} s={s} clientId={clientId} staff={staff} name={name} />
              ) : (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.position}. {s.name}</TableCell>
                  <TableCell className="num text-right">{Number(s.weight)}%</TableCell>
                  <TableCell><CloseBar percent={s.percent} /></TableCell>
                  <TableCell><StageStatusBadge status={s.status} /></TableCell>
                  <TableCell>{name(s.assignee_id)}</TableCell>
                  <TableCell className="max-w-64 text-xs text-muted-foreground">{s.blocker_note ?? "—"}</TableCell>
                  <TableCell className="num whitespace-nowrap text-xs">{fmtDateTime(s.updated_at)}</TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </ScrollTable>
      {editable && <p className="text-xs text-muted-foreground">Overall percent is the weighted sum of stage percents. Reviewers sign off a stage to mark it done.</p>}
    </div>
  );
}

function EditableStage({ s, clientId, staff, name }: { s: Stage; clientId: string; staff: { id: string; full_name: string }[]; name: (id: string | null) => string }) {
  const me = useMe();
  const qc = useQueryClient();
  const [percent, setPercent] = useState(String(s.percent));
  const [status, setStatus] = useState(s.status);
  const [assignee, setAssignee] = useState(s.assignee_id ?? "none");
  const [blocker, setBlocker] = useState(s.blocker_note ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = percent !== String(s.percent) || status !== s.status || assignee !== (s.assignee_id ?? "none") || blocker !== (s.blocker_note ?? "");

  async function save(patch?: Partial<Stage>) {
    const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    const update = patch ?? { percent: p, status, assignee_id: assignee === "none" ? null : assignee, blocker_note: blocker.trim() || null };
    setBusy(true);
    const { error } = await supabase.from("engagement_stages").update({ ...update, updated_at: new Date().toISOString() }).eq("id", s.id);
    setBusy(false);
    if (error) return toast.error(`Stage not saved: ${error.message}`);
    await logActivity(me, clientId, "progress", `${s.name}: ${update.percent ?? s.percent}% · ${update.status ?? s.status}${update.signed_off_by ? " · signed off" : ""}`);
    toast.success(`${s.name} updated`);
    qc.invalidateQueries({ queryKey: ["engagements"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
  }

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">{s.position}. {s.name}</TableCell>
      <TableCell className="num text-right">{Number(s.weight)}%</TableCell>
      <TableCell>
        <Input aria-label={`${s.name} percent`} type="number" min={0} max={100} className="num h-8 w-20" value={percent} onChange={(e) => setPercent(e.target.value)} />
      </TableCell>
      <TableCell>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-32 capitalize"><SelectValue /></SelectTrigger>
          <SelectContent>{STAGE_STATUSES.map((x) => <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="h-8 w-36"><SelectValue>{assignee === "none" ? "Unassigned" : name(assignee)}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {staff.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input className="h-8 min-w-48" placeholder="Blocker note" value={blocker} onChange={(e) => setBlocker(e.target.value)} />
      </TableCell>
      <TableCell className="num whitespace-nowrap text-xs">
        {fmtDateTime(s.updated_at)}
        {s.signed_off_by && <div className="text-success">Signed off by {name(s.signed_off_by)}</div>}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex gap-1">
          <Button size="sm" disabled={!dirty || busy} onClick={() => save()}>Save</Button>
          {(me.role === "reviewer" || me.role === "owner" || me.role === "admin") && s.status !== "done" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => save({ percent: 100, status: "done", signed_off_by: me.id, blocker_note: null })}>
              Sign off
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
