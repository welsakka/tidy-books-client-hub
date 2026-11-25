import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { loadMe } from "@/lib/data";
import { Building2, UserRound, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · Kenna's Empire" },
      { name: "description", content: "Sign in to Kenna's Empire to work client books or share documents with the firm." },
      { property: "og:title", content: "Sign in · Kenna's Empire" },
      { property: "og:description", content: "Staff and client sign-in for Kenna's Empire." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const me = await loadMe();
    if (me && me.status === "active") throw redirect({ to: me.role === "client" ? "/portal" : "/home" });
  },
  component: SignIn,
});

const DEMOS = [
  { email: "kenna@kennasempire.com", label: "Kenna", role: "Owner", icon: Building2 },
  { email: "jonas@kennasempire.com", label: "Jonas Keller", role: "Preparer", icon: ClipboardList },
  { email: "priya@northwind.co", label: "Priya Raman", role: "Client · Northwind Ceramics", icon: UserRound },
];

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: string, p: string) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
    if (error) {
      setBusy(false);
      setError(error.message.toLowerCase().includes("banned") ? "This login has been deactivated. Contact Kenna's Empire." : "That email and password don't match.");
      return;
    }
    const me = await loadMe();
    setBusy(false);
    if (!me || me.status !== "active") {
      await supabase.auth.signOut();
      setError("This login has been deactivated. Contact Kenna's Empire.");
      return;
    }
    navigate({ to: me.role === "client" ? "/portal" : "/home", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-ink-foreground lg:flex">
        <div className="grid-lines animate-grid-pan pointer-events-none absolute inset-0" aria-hidden />
        <div className="animate-gold-drift pointer-events-none absolute -top-32 right-0 h-[28rem] w-[28rem] rounded-full bg-brass/20 blur-3xl" aria-hidden />
        <div className="animate-gold-drift-slow pointer-events-none absolute bottom-1/4 right-1/3 h-96 w-96 rounded-full bg-brass/10 blur-3xl" aria-hidden />
        <div className="animate-gold-drift-fast pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-success/10 blur-3xl" aria-hidden />
        {[
          { left: "14%", bottom: "18%", delay: "0s" },
          { left: "52%", bottom: "8%", delay: "2.4s" },
          { left: "30%", bottom: "34%", delay: "4.6s" },
          { left: "70%", bottom: "22%", delay: "6.2s" },
        ].map((d, i) => (
          <span key={i} className="animate-float-dot pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-brass/60" style={{ left: d.left, bottom: d.bottom, animationDelay: d.delay }} aria-hidden />
        ))}
        <div className="wordmark animate-fade-up relative text-2xl">Kenna's Empire</div>
        <div className="animate-fade-up relative max-w-md space-y-4" style={{ animationDelay: "120ms" }}>
          <div className="animate-line-grow h-px w-16 bg-brass" />
          <p className="shine-auto wordmark text-5xl leading-[1.1]">Books kept close, <em className="text-brass">every month.</em></p>
          <p className="text-sm opacity-75">Monthly closes, source documents and client conversations for the businesses we keep books for.</p>
        </div>
        <div className="animate-fade-up num relative text-xs tracking-wide opacity-60" style={{ animationDelay: "240ms" }}>
          Bookkeeping · Close management · Client portal
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="animate-fade-up w-full max-w-sm space-y-6">
          <div>
            <div className="wordmark text-2xl text-foreground lg:hidden">Kenna's Empire</div>
            <h1 className="mt-2 text-xl font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">Staff and client accounts are created by the firm.</p>
          </div>
          <form
            className="surface shine space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              signIn(email.trim(), password);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="animate-glow-breathe w-full font-semibold shadow-md transition-transform hover:-translate-y-px" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Demo accounts · password "ledger"</p>
            {DEMOS.map((d, i) => (
              <button
                key={d.email}
                type="button"
                disabled={busy}
                onClick={() => signIn(d.email, "ledger")}
                className="surface hover-lift card-glow animate-fade-up flex w-full items-center gap-3 px-3 py-2.5 text-left"
                style={{ animationDelay: `${200 + i * 90}ms` }}
              >
                <d.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{d.label}</span>
                  <span className="block text-xs text-muted-foreground">{d.role} · {d.email}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
