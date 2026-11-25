import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorBox } from "@/components/common";
import { ACCEPT_ATTR, CATEGORIES, validateUploadFile } from "@/lib/constants";
import { uploadDocuments } from "@/lib/data";
import { fmtBytes } from "@/lib/format";
import { X } from "lucide-react";

export function UploadForm({
  clientId,
  defaultCategory,
  defaultMonth,
  onDone,
}: {
  clientId: string;
  defaultCategory?: string;
  defaultMonth?: string;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(defaultCategory ?? "");
  const [month, setMonth] = useState(defaultMonth ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fileErrors = files.map(validateUploadFile).filter(Boolean) as string[];
  const ready = files.length > 0 && !!category && !!month && fileErrors.length === 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await uploadDocuments({ clientId, category, month, note, files });
      toast.success(`${res.saved.length} file${res.saved.length > 1 ? "s" : ""} uploaded for review`);
      setFiles([]);
      setNote("");
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="files">Files</Label>
        <Input
          id="files"
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
        />
        <p className="text-xs text-muted-foreground">
          PDF, CSV, XLSX, OFX, QFX, JPG, PNG, WEBP or HEIC, up to 25 MB each. Several phone photos of one statement upload as pages of one document, in the order shown.
        </p>
        {files.length > 0 && (
          <ol className="space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1">
                <span className="num text-xs text-muted-foreground">{i + 1}.</span>
                <span className="flex-1 truncate">{f.name}</span>
                <span className="num text-xs text-muted-foreground">{fmtBytes(f.size)}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ol>
        )}
        {fileErrors.map((m) => (
          <p key={m} className="text-xs text-destructive">{m}</p>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category (required)</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label="Category" aria-invalid={!category}>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="month">Accounting month (required)</Label>
          <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the firm should know about this file" />
      </div>
      {error && <ErrorBox error={error} />}
      {!ready && !busy && (
        <p className="text-xs text-muted-foreground">
          {files.length === 0 ? "Add a file" : !category ? "Choose a category" : !month ? "Choose the accounting month" : "Fix the file problems above"} to enable upload.
        </p>
      )}
      <Button type="submit" disabled={!ready}>{busy ? "Uploading…" : "Upload"}</Button>
    </form>
  );
}
