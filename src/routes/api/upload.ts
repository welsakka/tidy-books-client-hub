import { createFileRoute } from "@tanstack/react-router";
import { CATEGORIES, validateUploadFile } from "@/lib/constants";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authFromRequest, bytesToHex, writeDiskCopy } = await import("@/lib/route-auth.server");
        const auth = await authFromRequest(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const { supabase, userId, profile } = auth;

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "The upload could not be read." }, 400);
        }
        const clientId = String(form.get("client_id") ?? "");
        const category = String(form.get("category") ?? "");
        const month = String(form.get("period") ?? "");
        const note = String(form.get("note") ?? "").slice(0, 1000) || null;
        const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
        const previews = form.getAll("previews");

        // A file is never saved without a category and a period.
        if (!(CATEGORIES as readonly string[]).includes(category)) return json({ error: "Choose a category before uploading." }, 400);
        if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: "Choose the accounting month before uploading." }, 400);
        if (!clientId) return json({ error: "Missing client." }, 400);
        if (!files.length) return json({ error: "Choose at least one file." }, 400);
        for (const f of files) {
          const err = validateUploadFile(f);
          if (err) return json({ error: err }, 400);
        }
        if (profile.client_id && profile.client_id !== clientId) return json({ error: "You can only upload for your own company." }, 403);

        const bundleId = files.length > 1 ? crypto.randomUUID() : null;
        const saved: { id: string; filename: string; disk: boolean }[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const id = crypto.randomUUID();
          const bytes = new Uint8Array(await f.arrayBuffer());
          const prev = previews[i];
          const previewBytes = prev && typeof prev !== "string" && prev.size > 0 ? new Uint8Array(await prev.arrayBuffer()) : null;
          const relative_path = `uploads/clients/${clientId}/${id}/original`;
          const { error } = await supabase.from("documents").insert({
            id,
            client_id: clientId,
            uploaded_by: userId,
            original_filename: f.name,
            mime_type: f.type || "application/octet-stream",
            size_bytes: f.size,
            relative_path,
            file_bytes: bytesToHex(bytes),
            preview_bytes: previewBytes ? bytesToHex(previewBytes) : null,
            category,
            period: `${month}-01`,
            note,
            status: "In review",
            parse_status: "not_parsed",
            bundle_id: bundleId,
            bundle_index: i,
          });
          if (error) return json({ error: `Could not save ${f.name}: ${error.message}`, saved }, 400);
          const disk = await writeDiskCopy(clientId, id, bytes);
          saved.push({ id, filename: f.name, disk });
          await supabase.from("activity").insert({
            client_id: clientId,
            actor_id: userId,
            actor_name: profile.full_name,
            action: "upload",
            detail: `Uploaded ${f.name} (${category}, ${month})`,
          });
        }
        return json({ saved });
      },
    },
  },
});
