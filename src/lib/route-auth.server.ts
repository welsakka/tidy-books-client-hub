// Verifies the Bearer token on a raw server route and returns an RLS-scoped client.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function keyFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export async function authFromRequest(request: Request) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Server is missing its backend configuration.");
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3) return null;
  const supabase = createClient<Database>(url, key, {
    global: { fetch: keyFetch(key), headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  const userId = data.claims.sub as string;
  const { data: profile } = await supabase.from("profiles").select("id, full_name, status, client_id").eq("id", userId).maybeSingle();
  if (!profile || profile.status !== "active") return null;
  return { supabase, userId, profile };
}

export function bytesToHex(bytes: Uint8Array) {
  let s = "\\x";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("\\x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

const diskPath = (clientId: string, documentId: string) => `uploads/clients/${clientId}/${documentId}/original`;

/** Best-effort disk copy. Returns false when the disk is not writable. */
export async function writeDiskCopy(clientId: string, documentId: string, bytes: Uint8Array) {
  try {
    const fs = await import("node:fs/promises");
    const path = diskPath(clientId, documentId);
    await fs.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    await fs.writeFile(path, bytes);
    return true;
  } catch {
    return false;
  }
}

export async function readDiskCopy(clientId: string, documentId: string): Promise<Uint8Array | null> {
  try {
    const fs = await import("node:fs/promises");
    const buf = await fs.readFile(diskPath(clientId, documentId));
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}
