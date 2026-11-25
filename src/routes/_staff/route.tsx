import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Home, Users, Inbox, MessagesSquare, BarChart3, ShieldCheck, LogOut, Search, BookOpen } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, q } from "@/lib/data";
import { MeContext } from "@/lib/me-context";
import { ROLE_LABEL, isFirmAdmin } from "@/lib/constants";

export const Route = createFileRoute("/_staff")({
  ssr: false,
  beforeLoad: async () => {
    const me = await loadMe();
    if (!me || me.status !== "active") throw redirect({ to: "/" });
    if (me.role === "client") throw redirect({ to: "/portal" });
    return { me };
  },
  component: StaffLayout,
});

function StaffLayout() {
  const { me } = Route.useRouteContext();
  return (
    <MeContext.Provider value={me}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <StaffSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="min-w-0 flex-1 p-4 md:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </MeContext.Provider>
  );
}

function StaffSidebar() {
  const { me } = Route.useRouteContext();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const threads = useQuery(q.threads());
  const unread = (threads.data ?? []).reduce((s, t) => s + t.unread_from_client, 0);
  const items = [
    { title: "Home", url: "/home", icon: Home },
    { title: "Clients", url: "/clients", icon: Users },
    { title: "Bookkeeping center", url: "/bookkeeping", icon: BookOpen },
    { title: "Inbox", url: "/inbox", icon: Inbox },
    { title: "Messages", url: "/messages", icon: MessagesSquare, badge: unread },
    { title: "Reports", url: "/reports", icon: BarChart3 },
    ...(isFirmAdmin(me.role) ? [{ title: "Admin", url: "/admin", icon: ShieldCheck }] : []),
  ];
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link to="/home" className="wordmark truncate text-lg text-sidebar-accent-foreground">
          {collapsed ? "KE" : "Kenna's Empire"}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuButton key={item.url} asChild isActive={path.startsWith(item.url)} tooltip={item.title}>
                  <Link to={item.url}>
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.title}</span>
                    {!!item.badge && !collapsed && <Badge className="num h-5 px-1.5">{item.badge}</Badge>}
                  </Link>
                </SidebarMenuButton>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {!collapsed && <div className="px-2 pb-2 text-xs opacity-60">Bookkeeping workspace</div>}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar() {
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clients = useQuery(q.clients());
  const [term, setTerm] = useState("");
  const matches = useMemo(
    () => (term.trim() ? (clients.data ?? []).filter((c) => c.name.toLowerCase().includes(term.toLowerCase())).slice(0, 6) : []),
    [term, clients.data],
  );
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b bg-card px-3">
      <SidebarTrigger />
      <span className="wordmark hidden text-sm sm:inline">Kenna's Empire</span>
      <div className="relative ml-auto w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Search clients"
          placeholder="Search clients"
          className="h-8 pl-8"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              navigate({ to: "/clients/$clientId", params: { clientId: matches[0].id } });
              setTerm("");
            }
          }}
        />
        {matches.length > 0 && (
          <div className="absolute left-0 right-0 top-9 z-30 rounded-md border bg-popover p-1 shadow-md">
            {matches.map((c) => (
              <button
                key={c.id}
                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  navigate({ to: "/clients/$clientId", params: { clientId: c.id } });
                  setTerm("");
                }}
              >
                {c.name}
                {c.archived && <span className="ml-2 text-xs text-muted-foreground">archived</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-ink-foreground">
            {me.full_name.slice(0, 1)}
          </span>
          <span className="hidden leading-tight md:block">
            <span className="block text-sm font-medium">{me.full_name}</span>
            <span className="block text-xs text-muted-foreground">{ROLE_LABEL[me.role]}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {me.full_name} · {ROLE_LABEL[me.role]}
            <div className="text-xs font-normal text-muted-foreground">{me.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
