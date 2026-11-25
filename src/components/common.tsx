import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="surface hover-lift p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Empty({ title, action, children }: { title: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="surface animate-fade-up flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-md text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error instanceof Error ? error.message : String(error ?? "Something went wrong.")}</span>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="surface space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-56" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <TableSkeleton />
    </div>
  );
}

export function DocStatusBadge({ status }: { status: string }) {
  const v = status === "Accepted" ? "info" : status === "Posted to books" ? "success" : status === "Rejected" ? "danger" : "warning";
  return <Badge variant={v}>{status}</Badge>;
}

export function StageStatusBadge({ status }: { status: string }) {
  const v = status === "done" ? "success" : status === "blocked" ? "danger" : status === "in progress" ? "warning" : "muted";
  return <Badge variant={v} className="capitalize">{status}</Badge>;
}

export function ParseBadge({ status }: { status: string }) {
  if (status === "parsed") return <Badge variant="success">Parsed</Badge>;
  if (status === "failed") return <Badge variant="danger">Parse failed</Badge>;
  return <Badge variant="muted">Not parsed</Badge>;
}

export function CloseBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Progress value={percent} className="h-1.5 w-20 bg-muted" />
      <span className="num w-9 text-right text-xs font-medium">{percent}%</span>
    </div>
  );
}

/** Horizontal scroll wrapper for wide tables on small screens. */
export function ScrollTable({ children }: { children: ReactNode }) {
  return <div className="surface overflow-x-auto">{children}</div>;
}
