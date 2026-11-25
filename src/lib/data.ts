import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/constants";
import { overallPercent } from "@/lib/progress";

export type Me = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  client_id: string | null;
  role: AppRole;
};

export async function loadMe(): Promise<Me | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const [{ data: p }, { data: r }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, status, client_id").eq("id", u.user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", u.user.id),
  ]);
  if (!p || !r?.length) return null;
  return { ...p, role: r[0].role as AppRole };
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Pages through results so lists never stop at the 1000-row default. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(await build(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export const DOC_COLS =
  "id, client_id, uploaded_by, original_filename, mime_type, size_bytes, relative_path, category, period, note, status, rejection_reason, parse_status, parse_error, parse_summary, bundle_id, bundle_index, request_id, folder_id, deleted_at, created_at";

export type DocRow = {
  id: string; client_id: string; uploaded_by: string | null; original_filename: string; mime_type: string; size_bytes: number;
  relative_path: string; category: string; period: string; note: string | null; status: string; rejection_reason: string | null;
  parse_status: string; parse_error: string | null; parse_summary: ParseSummary | null; bundle_id: string | null; bundle_index: number;
  request_id: string | null; folder_id: string | null; deleted_at: string | null; created_at: string;
};
export type ParseSummary = {
  opening_balance: number | null; total_deposits: number | null; total_withdrawals: number | null; ending_balance: number | null;
  ties: boolean | null; method: string; row_count: number; malformed: { line: number; raw: string; reason: string }[];
};

export type TxnRow = {
  id: string; client_id: string; txn_date: string; description: string; payee: string; account: string; category: string;
  amount: number; direction: "in" | "out"; kind: string; due_date: string | null; paid: boolean; document_id: string | null;
  amount_cents: number; category_account_id: string | null; bank_account_id: string | null; entry_id: string | null; source: string; deleted_at: string | null; created_by: string | null;
  status: "draft" | "posted"; confidence: number | null; created_at: string; updated_at: string;
};

export const q = {
  clients: () => ({
    queryKey: ["clients"],
    queryFn: async () =>
      check(await supabase.from("clients").select("id, name, industry, contact_name, contact_email, assignee_id, archived, created_at").order("name")),
  }),
  people: () => ({
    queryKey: ["people"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, status, client_id, created_at").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map(check(roles).map((r) => [r.user_id, r.role as AppRole]));
      return check(profiles).map((p) => ({ ...p, role: roleMap.get(p.id) ?? ("client" as AppRole) }));
    },
  }),
  engagements: () => ({
    queryKey: ["engagements"],
    queryFn: async () => {
      const rows = check(
        await supabase
          .from("engagements")
          .select("id, client_id, period, due_date, status, engagement_stages(id, name, position, weight, percent, assignee_id, status, blocker_note, signed_off_by, updated_at)")
          .order("period", { ascending: false }),
      );
      return rows.map((e) => {
        const stages = [...e.engagement_stages].sort((a, b) => a.position - b.position);
        return { ...e, stages, percent: overallPercent(stages) };
      });
    },
  }),
  documents: (clientId?: string) => ({
    queryKey: ["documents", clientId ?? "all"],
    queryFn: async () =>
      fetchAll<DocRow>((f, t) => {
        let b = supabase.from("documents").select(DOC_COLS).is("deleted_at", null).order("created_at", { ascending: false }).range(f, t);
        if (clientId) b = b.eq("client_id", clientId);
        return b as unknown as PromiseLike<{ data: DocRow[] | null; error: { message: string } | null }>;
      }),
  }),
  requests: (clientId?: string) => ({
    queryKey: ["requests", clientId ?? "all"],
    queryFn: async () => {
      let b = supabase.from("document_requests").select("id, client_id, category, period, note, status, fulfilled_document_id, created_at").order("created_at");
      if (clientId) b = b.eq("client_id", clientId);
      return check(await b);
    },
  }),
  transactions: (clientId?: string) => ({
    queryKey: ["transactions", clientId ?? "all"],
    queryFn: async () =>
      fetchAll<TxnRow>((f, t) => {
        let b = supabase.from("transactions").select("*").is("deleted_at", null).order("txn_date", { ascending: false }).order("created_at").range(f, t);
        if (clientId) b = b.eq("client_id", clientId);
        return b as unknown as PromiseLike<{ data: TxnRow[] | null; error: { message: string } | null }>;
      }),
  }),
  threads: () => ({
    queryKey: ["threads"],
    queryFn: async () => check(await supabase.rpc("thread_summaries")),
  }),
  messages: (clientId: string) => ({
    queryKey: ["messages", clientId],
    queryFn: async () => {
      const thread = check<{ id: string } | null>(await supabase.from("message_threads").select("id").eq("client_id", clientId).maybeSingle());
      if (!thread) return { threadId: null as string | null, messages: [] };
      const messages = check(
        await supabase.from("messages").select("id, author_id, author_is_staff, body, document_id, request_id, created_at").eq("thread_id", thread.id).order("created_at"),
      );
      return { threadId: thread.id, messages };
    },
  }),
  activity: (clientId?: string) => ({
    queryKey: ["activity", clientId ?? "all"],
    queryFn: async () => {
      let b = supabase.from("activity").select("id, client_id, actor_name, action, detail, created_at").order("created_at", { ascending: false }).limit(60);
      if (clientId) b = b.eq("client_id", clientId);
      return check(await b);
    },
  }),
};

export async function logActivity(me: Me, clientId: string | null, action: string, detail: string) {
  await supabase.from("activity").insert({ client_id: clientId, actor_id: me.id, actor_name: me.full_name, action, detail });
}

async function bearer() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  return { Authorization: `Bearer ${token}` };
}

export async function fetchFileBlob(id: string, variant?: "preview") {
  const res = await fetch(`/api/files/${id}${variant ? "?variant=preview" : ""}`, { headers: await bearer() });
  if (!res.ok) throw new Error((await res.text()) || "The file could not be opened.");
  return res.blob();
}

export async function uploadDocuments(input: { clientId: string; category: string; month: string; note: string; files: File[] }) {
  const form = new FormData();
  form.set("client_id", input.clientId);
  form.set("category", input.category);
  form.set("period", input.month);
  form.set("note", input.note);
  for (const f of input.files) {
    form.append("files", f);
    let preview: Blob = new Blob([]);
    if (/\.heic$/i.test(f.name) || f.type.includes("heic")) {
      try {
        const heic2any = (await import("heic2any")).default;
        const out = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.92 });
        preview = Array.isArray(out) ? out[0] : out;
      } catch {
        preview = new Blob([]);
      }
    }
    form.append("previews", preview, "preview.jpg");
  }
  const res = await fetch("/api/upload", { method: "POST", body: form, headers: await bearer() });
  const body = await res.json().catch(() => ({ error: "Upload failed." }));
  if (!res.ok) throw new Error(body.error ?? "Upload failed.");
  return body as { saved: { id: string; filename: string; disk: boolean }[] };
}

export async function markThreadRead(threadId: string, userId: string) {
  await supabase.from("message_reads").upsert({ thread_id: threadId, user_id: userId, last_read_at: new Date().toISOString() });
}

export async function sendMessage(input: { clientId: string; authorId: string; body: string; documentId?: string | null; requestId?: string | null }) {
  let thread = check<{ id: string } | null>(await supabase.from("message_threads").select("id").eq("client_id", input.clientId).maybeSingle());
  if (!thread) thread = check(await supabase.from("message_threads").insert({ client_id: input.clientId }).select("id").single());
  check(
    await supabase.from("messages").insert({
      thread_id: thread.id,
      client_id: input.clientId,
      author_id: input.authorId,
      body: input.body,
      document_id: input.documentId ?? null,
      request_id: input.requestId ?? null,
    }),
  );
}
