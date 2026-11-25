export const FIRM_NAME = "Kenna's Empire";

export const CATEGORIES = [
  "Bank statement",
  "Credit card statement",
  "Invoice",
  "Bill",
  "Receipt",
  "Payroll",
  "Tax form",
  "Contract",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DOC_STATUSES = ["In review", "Accepted", "Posted to books", "Rejected"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const STAGE_STATUSES = ["not started", "in progress", "blocked", "done"] as const;

export const ACCEPTED_EXTENSIONS = [
  "pdf", "csv", "txt", "xlsx", "ofx", "qfx", "qbo", "jpg", "jpeg", "png", "webp", "heic",
] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map((e) => "." + e).join(",");

export type StaffRole = "owner" | "admin" | "preparer" | "reviewer";
export type AppRole = StaffRole | "client";

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  preparer: "Preparer",
  reviewer: "Reviewer",
  client: "Client",
};

export function fileExtension(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function validateUploadFile(file: { name: string; size: number }): string | null {
  const ext = fileExtension(file.name);
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext))
    return `${file.name}: file type .${ext || "?"} is not accepted.`;
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is larger than 25 MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

export function canWorkBooks(role: AppRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "preparer";
}
export function isFirmAdmin(role: AppRole | null | undefined) {
  return role === "owner" || role === "admin";
}
