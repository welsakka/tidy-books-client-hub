import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/data";

/** Per-client roll-up used by Home, Clients and Reports. All figures come from live data. */
export function useFirmOverview() {
  const clients = useQuery(q.clients());
  const engs = useQuery(q.engagements());
  const docs = useQuery(q.documents());
  const reqs = useQuery(q.requests());
  const threads = useQuery(q.threads());
  const people = useQuery(q.people());
  const queries = [clients, engs, docs, reqs, threads, people];
  const isLoading = queries.some((x) => x.isLoading);
  const error = queries.find((x) => x.error)?.error;

  const rows = useMemo(() => {
    const names = new Map((people.data ?? []).map((p) => [p.id, p.full_name]));
    return (clients.data ?? []).map((c) => {
      const eng = (engs.data ?? []).find((e) => e.client_id === c.id);
      const open = (reqs.data ?? []).filter((r) => r.client_id === c.id && r.status === "open").sort((a, b) => a.period.localeCompare(b.period) || a.created_at.localeCompare(b.created_at));
      const thread = (threads.data ?? []).find((t) => t.client_id === c.id);
      const waiting = (docs.data ?? []).filter((d) => d.client_id === c.id && d.status === "In review" && (!d.bundle_id || d.bundle_index === 0)).length;
      const blocked = eng?.stages.filter((s) => s.status === "blocked") ?? [];
      const overdue = eng && eng.status === "open" && eng.due_date < new Date().toISOString().slice(0, 10);
      const status = !eng ? "No close" : eng.status === "delivered" ? "Delivered" : blocked.length ? "Blocked" : overdue ? "Overdue" : eng.percent >= 100 ? "Ready to deliver" : "On track";
      return {
        client: c,
        assignee: c.assignee_id ? names.get(c.assignee_id) ?? "—" : "Unassigned",
        engagement: eng,
        percent: eng?.percent ?? 0,
        openRequests: open,
        nextMissing: open[0] ?? null,
        unread: thread?.unread_from_client ?? 0,
        waiting,
        blocked,
        status,
      };
    });
  }, [clients.data, engs.data, docs.data, reqs.data, threads.data, people.data]);

  return { isLoading, error, rows, docs: docs.data ?? [], people: people.data ?? [] };
}
