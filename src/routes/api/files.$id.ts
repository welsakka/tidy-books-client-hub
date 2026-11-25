import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authFromRequest, hexToBytes, readDiskCopy } = await import("@/lib/route-auth.server");
        const auth = await authFromRequest(request);
        if (!auth) return new Response("Please sign in again.", { status: 401 });
        const { supabase, userId, profile } = auth;
        const wantPreview = new URL(request.url).searchParams.get("variant") === "preview";

        // RLS decides whether this user may read the row.
        const { data: meta } = await supabase
          .from("documents")
          .select("id, client_id, original_filename, mime_type")
          .eq("id", params.id)
          .maybeSingle();
        if (!meta) return new Response("File not found.", { status: 404 });

        await supabase.from("activity").insert({
          client_id: meta.client_id,
          actor_id: userId,
          actor_name: profile.full_name,
          action: "download",
          detail: `Opened ${meta.original_filename}`,
        });

        let bytes: Uint8Array | null = null;
        let mime = meta.mime_type;
        if (wantPreview) {
          const { data } = await supabase.from("documents").select("preview_bytes").eq("id", meta.id).single();
          if (data?.preview_bytes) {
            bytes = hexToBytes(data.preview_bytes as unknown as string);
            mime = "image/jpeg";
          }
        }
        if (!bytes) bytes = await readDiskCopy(meta.client_id, meta.id);
        if (!bytes) {
          const { data } = await supabase.from("documents").select("file_bytes").eq("id", meta.id).single();
          if (!data) return new Response("File not found.", { status: 404 });
          bytes = hexToBytes(data.file_bytes as unknown as string);
        }
        const body = new ReadableStream({
          start(c) {
            c.enqueue(bytes!);
            c.close();
          },
        });
        return new Response(body, {
          headers: {
            "Content-Type": mime,
            "Content-Length": String(bytes.length),
            "Content-Disposition": `inline; filename="${meta.original_filename.replace(/"/g, "")}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
