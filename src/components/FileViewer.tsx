import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/common";
import { fetchFileBlob, type DocRow } from "@/lib/data";
import { fileExtension } from "@/lib/constants";
import { Download } from "lucide-react";

export async function downloadDocument(doc: Pick<DocRow, "id" | "original_filename">) {
  const blob = await fetchFileBlob(doc.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.original_filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Shows the original file, fetched through the authenticated download route. */
export function FileViewer({ doc }: { doc: DocRow }) {
  const ext = fileExtension(doc.original_filename);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    setUrl(null);
    setText(null);
    setError(null);
    (async () => {
      try {
        const blob = await fetchFileBlob(doc.id, ext === "heic" ? "preview" : undefined);
        if (cancelled) return;
        if (["csv", "ofx", "qfx"].includes(ext)) setText(await blob.text());
        else {
          revoke = URL.createObjectURL(blob);
          setUrl(revoke);
        }
      } catch (e) {
        if (!cancelled) setError(e);
      }
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [doc.id, ext]);

  if (error) return <ErrorBox error={error} />;
  if (!url && text == null) return <Skeleton className="h-[60vh] w-full" />;
  if (text != null) return <pre className="num h-[60vh] overflow-auto rounded border bg-muted/40 p-3 text-xs">{text}</pre>;
  if (ext === "pdf") return <iframe title={doc.original_filename} src={url!} className="h-[60vh] w-full rounded border bg-card" />;
  if (["jpg", "jpeg", "png", "webp", "heic"].includes(ext))
    return (
      <div className="h-[60vh] overflow-auto rounded border bg-muted/40">
        <img src={url!} alt={doc.original_filename} className="mx-auto max-w-full" />
      </div>
    );
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded border bg-muted/40 text-sm text-muted-foreground">
      This file type can't be previewed here.
      <Button size="sm" variant="outline" onClick={() => downloadDocument(doc)}><Download className="mr-1 h-4 w-4" /> Download original</Button>
    </div>
  );
}
