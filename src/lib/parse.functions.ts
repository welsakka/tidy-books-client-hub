// All document parsing goes through parseDocument so a different parser can replace it later
// without changing any screen.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fileExtension } from "@/lib/constants";
import { ties } from "@/lib/analytics";

export const MISSING_KEY_MESSAGE = "Parsing is unavailable until the AI key is set.";

type Summary = {
  opening_balance: number | null;
  total_deposits: number | null;
  total_withdrawals: number | null;
  ending_balance: number | null;
};
type Row = { date: string; description: string; amount: number; direction: "in" | "out"; confidence: number };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rows", "opening_balance", "total_deposits", "total_withdrawals", "ending_balance"],
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "description", "amount", "direction", "confidence"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          description: { type: "string" },
          amount: { type: "number", description: "Positive amount" },
          direction: { type: "string", enum: ["in", "out"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    opening_balance: { type: ["number", "null"] },
    total_deposits: { type: ["number", "null"] },
    total_withdrawals: { type: ["number", "null"] },
    ending_balance: { type: ["number", "null"] },
  },
} as const;

function hexToBytes(hex: string) {
  const h = hex.startsWith("\\x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

async function callModel(apiKey: string, parts: unknown[]): Promise<{ rows: Row[] } & Summary> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      store: false,
      stream: true,
      reasoning: { effort: "high" },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extract every transaction from this financial source document. The pages are given in order and form one document. " +
                "For each row return date (YYYY-MM-DD), description, amount as a positive number, direction (in for money received, out for money paid), and confidence from 0 to 1. " +
                "Also return opening balance, total deposits, total withdrawals, and ending balance if they are printed; use null when not visible. Do not invent rows. Respond with JSON only.",
            },
            ...parts,
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "statement_extraction", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as { error?: { message?: string }; message?: string } | null;
    const msg = data?.error?.message ?? data?.message ?? `HTTP ${res.status}`;
    if (res.status === 402) throw new Error(`AI credits are used up: ${msg}`);
    if (res.status === 429) throw new Error("The parser is busy right now. Try again in a minute.");
    throw new Error(`The parsing model returned an error: ${msg}`);
  }
  // Read the server-sent event stream and collect the JSON text.
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", refusal = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        else if (ev.type === "response.refusal.delta") refusal += ev.delta ?? "";
        else if (ev.type === "response.failed" || ev.type === "error") throw new Error(ev.response?.error?.message ?? ev.message ?? "Parsing failed.");
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  if (refusal && !text) throw new Error(`The parsing model declined this document: ${refusal}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The parsing model did not return readable JSON.");
  }
}

export const parseDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: canWork } = await supabase.rpc("can_work_books", { _user_id: userId });
    if (!canWork) throw new Error("Only Owners, Admins, and Preparers can parse documents.");
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
    const actor = me?.full_name ?? "Staff";

    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, client_id, original_filename, mime_type, bundle_id, bundle_index, status")
      .eq("id", data.documentId)
      .single();
    if (error || !doc) throw new Error("Document not found.");
    if (doc.status === "Posted to books") throw new Error("This document is already posted to the books.");

    // Several photos of one statement share a bundle and are sent together, in order.
    let members = [doc];
    if (doc.bundle_id) {
      const { data: all } = await supabase
        .from("documents")
        .select("id, client_id, original_filename, mime_type, bundle_id, bundle_index, status")
        .eq("bundle_id", doc.bundle_id)
        .neq("status", "Rejected")
        .order("bundle_index");
      if (all?.length) members = all;
    }
    const primaryId = members[0].id;
    const memberIds = members.map((m) => m.id);

    const fail = async (message: string) => {
      await supabase.from("documents").update({ parse_status: "failed", parse_error: message }).in("id", memberIds);
      await supabase.from("activity").insert({ client_id: doc.client_id, actor_id: userId, actor_name: actor, action: "parse", detail: `Parse failed for ${doc.original_filename}: ${message}` });
      return { ok: false as const, error: message };
    };

    let rows: Row[] = [];
    let summary: Summary = { opening_balance: null, total_deposits: null, total_withdrawals: null, ending_balance: null };
    let malformed: { line: number; raw: string; reason: string }[] = [];
    let method = "code";

    const ext = fileExtension(doc.original_filename);
    try {
      if (["csv", "txt", "xlsx", "ofx", "qfx", "qbo"].includes(ext)) {
        const { parseCsv, parseOfx, parseGrid } = await import("@/lib/parse-tabular");
        for (const m of members) {
          const { data: fb } = await supabase.from("documents").select("file_bytes").eq("id", m.id).single();
          if (!fb) throw new Error("Document bytes are unavailable.");
          const bytes = hexToBytes(fb.file_bytes as unknown as string);
          const e = fileExtension(m.original_filename);
          let r;
          if (e === "xlsx") {
            const XLSX = await import("xlsx");
            const wb = XLSX.read(bytes, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            r = parseGrid(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as (string | number | null)[][]);
          } else {
            const text = new TextDecoder().decode(bytes);
            r = ["csv", "txt"].includes(e) ? parseCsv(text) : parseOfx(text);
          }
          rows.push(...r.rows);
          malformed.push(...r.malformed);
        }
      } else {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return await fail(MISSING_KEY_MESSAGE);
        method = "model";
        const parts: unknown[] = [];
        for (const m of members) {
          const isHeic = fileExtension(m.original_filename) === "heic" || m.mime_type.includes("heic");
          const { data: fb } = await supabase.from("documents").select(isHeic ? "preview_bytes" : "file_bytes").eq("id", m.id).single();
          const hex = (fb as Record<string, string | null> | null)?.[isHeic ? "preview_bytes" : "file_bytes"];
          if (!hex) return await fail(`${m.original_filename} has no JPEG conversion. Re-upload it from a browser that can convert HEIC.`);
          const bytes = hexToBytes(hex);
          if (m.mime_type === "application/pdf" || fileExtension(m.original_filename) === "pdf") {
            parts.push({ type: "input_file", filename: m.original_filename, file_data: `data:application/pdf;base64,${b64(bytes)}`, detail: "high" });
          } else {
            const mime = isHeic ? "image/jpeg" : m.mime_type || "image/jpeg";
            parts.push({ type: "input_image", image_url: `data:${mime};base64,${b64(bytes)}`, detail: "original" });
          }
        }
        const out = await callModel(apiKey, parts);
        rows = (out.rows ?? []).filter((r) => r && r.date && Number.isFinite(r.amount));
        summary = {
          opening_balance: out.opening_balance ?? null,
          total_deposits: out.total_deposits ?? null,
          total_withdrawals: out.total_withdrawals ?? null,
          ending_balance: out.ending_balance ?? null,
        };
      }
    } catch (e) {
      return await fail(e instanceof Error ? e.message : "Parsing failed.");
    }

    // Replace earlier drafts from this document; never touch posted lines.
    await supabase.from("transactions").delete().in("document_id", memberIds).eq("status", "draft");
    if (rows.length) {
      const { error: insErr } = await supabase.from("transactions").insert(
        rows.map((r) => ({
          client_id: doc.client_id,
          txn_date: r.date,
          description: r.description || "(no description)",
          payee: r.description?.split(" - ")[0]?.slice(0, 80) ?? "",
          account: "Uncategorized",
          category: r.direction === "in" ? "Income" : "Expense",
          amount: Math.abs(Number(r.amount)),
          amount_cents: Math.round(Math.abs(Number(r.amount))*100),
          source: "import",
          direction: r.direction,
          document_id: primaryId,
          status: "draft",
          confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 1))),
          created_by: userId,
        })),
      );
      if (insErr) return await fail(`Draft lines could not be saved: ${insErr.message}`);
    }
    const tie = ties(summary);
    const parse_summary = { ...summary, ties: tie, method, row_count: rows.length, malformed };
    await supabase.from("documents").update({ parse_status: "parsed", parse_error: null, parse_summary }).in("id", memberIds);
    await supabase.from("activity").insert({
      client_id: doc.client_id,
      actor_id: userId,
      actor_name: actor,
      action: "parse",
      detail: `Parsed ${doc.original_filename}${members.length > 1 ? ` (+${members.length - 1} pages)` : ""}: ${rows.length} draft lines${malformed.length ? `, ${malformed.length} malformed rows skipped` : ""}`,
    });
    return { ok: true as const, rows: rows.length, malformed: malformed.length, ties: tie };
  });
