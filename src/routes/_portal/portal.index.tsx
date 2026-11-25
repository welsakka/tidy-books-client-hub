import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, ErrorBox, PageHeader, PageSkeleton } from "@/components/common";
import { UploadForm } from "@/components/UploadForm";
import { q } from "@/lib/data";
import { useMe } from "@/lib/me-context";
import { fmtPeriod } from "@/lib/format";

export const Route = createFileRoute("/_portal/portal/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Requests · Kenna's Empire client portal" },
      { name: "description", content: "Documents Kenna's Empire still needs from you." },
      { property: "og:title", content: "Requests · Kenna's Empire client portal" },
      { property: "og:description", content: "Documents Kenna's Empire still needs from you." },
    ],
  }),
  component: Requests,
});

function Requests() {
  const me = useMe();
  const reqs = useQuery(q.requests(me.client_id!));
  const [uploadFor, setUploadFor] = useState<{ category: string; period: string } | null>(null);
  if (reqs.isLoading) return <PageSkeleton />;
  if (reqs.error) return <ErrorBox error={reqs.error} />;
  const open = (reqs.data ?? []).filter((r) => r.status === "open");
  const done = (reqs.data ?? []).filter((r) => r.status === "fulfilled");
  return (
    <div className="space-y-4">
      <PageHeader title="What the firm still needs" subtitle="Uploading a file with the matching category and month completes the request." />
      {open.length === 0 ? (
        <Empty title="You're all caught up" action={<Button asChild size="sm"><Link to="/portal/upload">Upload something else</Link></Button>}>The firm has no open requests right now.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {open.map((r) => (
            <div key={r.id} className="surface flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2"><Badge variant="warning">Needed</Badge><span className="font-medium">{r.category}</span><span className="num ml-auto text-sm text-muted-foreground">{fmtPeriod(r.period)}</span></div>
              {r.note && <p className="text-sm text-muted-foreground">{r.note}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setUploadFor({ category: r.category, period: r.period.slice(0, 7) })}>Upload</Button>
                <Button size="sm" variant="ghost" asChild><Link to="/portal/messages" search={{ req: r.id }}>Ask a question</Link></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="surface p-4">
          <h3 className="mb-2 text-sm font-semibold">Received</h3>
          {done.map((r) => <div key={r.id} className="text-sm text-muted-foreground">{r.category}, {fmtPeriod(r.period)}</div>)}
        </div>
      )}
      <Dialog open={!!uploadFor} onOpenChange={(o) => !o && setUploadFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload {uploadFor?.category}</DialogTitle></DialogHeader>
          {uploadFor && <UploadForm clientId={me.client_id!} defaultCategory={uploadFor.category} defaultMonth={uploadFor.period} onDone={() => setUploadFor(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
