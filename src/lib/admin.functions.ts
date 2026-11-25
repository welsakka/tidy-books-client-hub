import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string };

async function requireFirmAdmin({ supabase, userId }: Ctx) {
  const { data } = await supabase.rpc("is_firm_admin", { _user_id: userId });
  if (!data) throw new Error("Only the Owner or an Admin can do this.");
  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
  return me?.full_name ?? "Admin";
}

async function requireVisiblePerson(context: Ctx, id: string) {
  const {data} = await context.supabase.from("profiles").select("id").eq("id",id).maybeSingle();
  if (!data) throw new Error("User is outside your firm");
}

function tempPassword() {
  const words = ["ledger", "harbor", "brass", "stone", "column", "audit", "accrual", "balance"];
  const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length];
  return `${pick()}-${pick()}-${(crypto.getRandomValues(new Uint32Array(1))[0] % 9000) + 1000}`;
}

async function createLogin(name: string, email: string, role: string, clientId: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const password = tempPassword();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) throw new Error(error?.message?.includes("already") ? "Someone with that email already has a login." : error?.message ?? "Could not create the login.");
  const id = data.user.id;
  const { error: pErr } = await supabaseAdmin.from("profiles").insert({ id, full_name: name, email, client_id: clientId });
  if (pErr) throw new Error(pErr.message);
  await supabaseAdmin.from("user_roles").insert({ user_id: id, role: role as "owner" });
  return { id, password };
}

const staffRole = z.enum(["admin", "preparer", "reviewer"]);

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().email().max(255), role: staffRole }).parse(d))
  .handler(async ({ data, context }) => {
    const actor = await requireFirmAdmin(context);
    // Staff seats are unlimited: no cap is checked here.
    const res = await createLogin(data.name, data.email, data.role, null);
    const { data: membership } = await context.supabase.from("firm_members").select("firm_id").eq("user_id", context.userId).limit(1).single();
    if (!membership) throw new Error("Firm membership is missing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: membershipError } = await supabaseAdmin.from("firm_members").insert({firm_id:membership.firm_id,user_id:res.id});
    if (membershipError) throw new Error(membershipError.message);
    await context.supabase.from("activity").insert({ actor_id: context.userId, actor_name: actor, action: "invite", detail: `Invited ${data.name} (${data.role})` });
    return { email: data.email, password: res.password };
  });

export const inviteClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().email().max(255), clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const actor = await requireFirmAdmin(context);
    const { data: allowed } = await context.supabase.rpc("has_company_access", { _company: data.clientId });
    if (!allowed) throw new Error("Company access required");
    const res = await createLogin(data.name, data.email, "client", data.clientId);
    await context.supabase.from("activity").insert({ client_id: data.clientId, actor_id: context.userId, actor_name: actor, action: "invite", detail: `Invited client user ${data.name}` });
    return { email: data.email, password: res.password };
  });

export const changeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: staffRole }).parse(d))
  .handler(async ({ data, context }) => {
    const actor = await requireFirmAdmin(context);
    await requireVisiblePerson(context, data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    const current = roles?.map((r) => r.role) ?? [];
    if (current.includes("owner")) throw new Error("The Owner's role cannot be changed.");
    if (current.includes("client")) throw new Error("Client users do not have staff roles.");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    const { data: p } = await supabaseAdmin.from("profiles").select("full_name").eq("id", data.userId).single();
    await context.supabase.from("activity").insert({ actor_id: context.userId, actor_name: actor, action: "role", detail: `Changed ${p?.full_name} to ${data.role}` });
    return { ok: true };
  });

export const setPersonStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const actor = await requireFirmAdmin(context);
    await requireVisiblePerson(context, data.userId);
    if (data.userId === context.userId) throw new Error("You cannot deactivate yourself.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    if (roles?.some((r) => r.role === "owner")) throw new Error("The Owner cannot be deactivated.");
    // Ban blocks sign-in; history rows stay untouched.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : "876000h" });
    if (error) throw new Error(error.message);
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .update({ status: data.active ? "active" : "deactivated" })
      .eq("id", data.userId)
      .select("full_name, client_id")
      .single();
    await context.supabase.from("activity").insert({ client_id: p?.client_id ?? null, actor_id: context.userId, actor_name: actor, action: "status", detail: `${data.active ? "Reactivated" : "Deactivated"} ${p?.full_name}` });
    return { ok: true };
  });
