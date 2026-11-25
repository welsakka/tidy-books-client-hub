import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Upload, FileText, MessagesSquare, BookOpen, Gauge, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, q } from "@/lib/data";
import { MeContext } from "@/lib/me-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_portal")({
  ssr: false,
  beforeLoad: async () => {
    const me = await loadMe();
    if (!me || me.status !== "active") throw redirect({ to: "/" });
    if (me.role !== "client" || !me.client_id) throw redirect({ to: "/home" });
    const { data: approved } = await supabase.rpc("is_company_client", { _company: me.client_id });
    if (!approved) throw redirect({ to: "/access-pending" });
    return { me };
  },
  component: PortalLayout,
});

const NAV = [
  { to: "/portal", label: "Requests", icon: ClipboardList, exact: true },
  { to: "/portal/upload", label: "Upload", icon: Upload },
  { to: "/portal/documents", label: "Documents", icon: FileText },
  { to: "/portal/messages", label: "Messages", icon: MessagesSquare },
  { to: "/portal/books", label: "Books snapshot", icon: BookOpen },
  { to: "/portal/entries", label: "Transactions", icon: BookOpen },
  { to: "/portal/reports", label: "Reports", icon: Gauge },
  { to: "/portal/progress", label: "Firm progress", icon: Gauge },
] as const;

function PortalLayout() {
  const { me } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clients = useQuery(q.clients());
  const threads = useQuery({ ...q.threads(), refetchInterval: 20000 });
  const company = clients.data?.[0]?.name ?? "";
  const unread = threads.data?.[0]?.unread ?? 0;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-screen">
        <header className="bg-ink text-ink-foreground">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
            <div>
              <div className="text-base font-semibold">{company}</div>
              <div className="wordmark text-xs text-brass">Kenna's Empire</div>
            </div>
            <div className="ml-auto text-right text-xs">
              <div>{me.full_name}</div>
              <div className="opacity-70">{me.email}</div>
            </div>
            <Button size="sm" variant="ghost" className="text-ink-foreground hover:bg-sidebar-accent hover:text-ink-foreground" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
            {NAV.map((n) => {
              const active = "exact" in n ? path === n.to || path === n.to + "/" : path.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to} className={cn("flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm", active ? "border-brass text-ink-foreground" : "border-transparent opacity-70 hover:opacity-100")}>
                  <n.icon className="h-4 w-4" /> {n.label}
                  {n.to === "/portal/messages" && unread > 0 && <Badge className="num h-5 px-1.5">{unread}</Badge>}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </MeContext.Provider>
  );
}
