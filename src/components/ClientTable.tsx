import { useNavigate } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CloseBar, ScrollTable } from "@/components/common";
import type { useFirmOverview } from "@/lib/overview";
import { fmtDate, fmtPeriod } from "@/lib/format";

type Row = ReturnType<typeof useFirmOverview>["rows"][number];

export function ClientTable({ rows }: { rows: Row[] }) {
  const navigate = useNavigate();
  return (
    <ScrollTable>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Close progress</TableHead>
            <TableHead>Next missing document</TableHead>
            <TableHead className="text-right">Unread</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.client.id} className="cursor-pointer transition-colors hover:bg-accent/60" onClick={() => navigate({ to: "/clients/$clientId", params: { clientId: r.client.id } })}>
              <TableCell className="whitespace-nowrap font-medium">{r.client.name}</TableCell>
              <TableCell className="max-w-48 truncate text-muted-foreground">{r.client.industry}</TableCell>
              <TableCell className="num whitespace-nowrap">{r.engagement ? fmtPeriod(r.engagement.period) : "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{r.assignee}</TableCell>
              <TableCell><CloseBar percent={r.percent} /></TableCell>
              <TableCell className="whitespace-nowrap">
                {r.nextMissing ? `${r.nextMissing.category}, ${fmtPeriod(r.nextMissing.period)}` : <span className="text-muted-foreground">None</span>}
              </TableCell>
              <TableCell className="num text-right">{r.unread ? <Badge className="num">{r.unread}</Badge> : "0"}</TableCell>
              <TableCell className="num whitespace-nowrap">{r.engagement ? fmtDate(r.engagement.due_date) : "—"}</TableCell>
              <TableCell>
                <Badge variant={r.status === "Blocked" || r.status === "Overdue" ? "danger" : r.status === "On track" ? "info" : "success"}>{r.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollTable>
  );
}
