import { format, parseISO } from "date-fns";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const fmtMoney = (n: number) => money.format(n);
export const fmtMoney0 = (n: number) => money0.format(n);
export const fmtPeriod = (d: string) => format(parseISO(d), "MMM yyyy");
export const fmtDate = (d: string) => format(parseISO(d), "MMM d, yyyy");
export const fmtDateTime = (d: string) => format(new Date(d), "MMM d, h:mm a");
export const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

/** "2026-09" or Date -> "2026-09-01" */
export const monthToPeriod = (m: string) => (m.length === 7 ? `${m}-01` : m);
