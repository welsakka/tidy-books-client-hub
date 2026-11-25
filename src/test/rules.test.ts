import { describe, it, expect } from "vitest";
import { overallPercent } from "@/lib/progress";
import { parseCsv, parseAmount, parseOfx } from "@/lib/parse-tabular";
import { summarize, aging, ties, coverageGrid } from "@/lib/analytics";
import { validateUploadFile, canWorkBooks, isFirmAdmin } from "@/lib/constants";

const W = [5, 15, 20, 20, 15, 10, 5, 10];
const stages = (p: number[]) => p.map((percent, i) => ({ weight: W[i], percent }));

describe("close progress", () => {
  it("is the weighted sum of stage percents", () => {
    expect(overallPercent(stages([100, 80, 30, 0, 0, 0, 0, 0]))).toBe(23);
    expect(overallPercent(stages([100, 100, 100, 100, 100, 80, 100, 0]))).toBe(88);
  });
});

describe("tabular parsing", () => {
  it("treats parentheses and minus as outflows and skips malformed rows", () => {
    const r = parseCsv("Posted Date,Memo,Amount\n2026-09-03,Fee,-10.50\n2026-09-04,Rent,(200.00)\n2026-09-05,Refund,12\nbad,row,x\n");
    expect(r.rows.map((x) => x.direction)).toEqual(["out", "out", "in"]);
    expect(r.rows[1].amount).toBe(200);
    expect(r.malformed).toHaveLength(1);
  });
  it("accepts debit/credit columns", () => {
    const r = parseCsv("Date,Description,Debit,Credit\n09/01/2026,Supplies,45.00,\n09/02/2026,Deposit,,300\n");
    expect(r.rows).toEqual([
      expect.objectContaining({ amount: 45, direction: "out" }),
      expect.objectContaining({ amount: 300, direction: "in" }),
    ]);
  });
  it("parses semicolon and tab-separated statements", () => {
    expect(parseCsv("Date;Description;Amount\n2026-10-24;Rent;-100.25").rows[0]).toMatchObject({amount:100.25,direction:"out"});
    expect(parseCsv("Date\tDescription\tAmount\n2026-10-24\tDeposit\t50.10").rows[0]).toMatchObject({amount:50.1,direction:"in"});
  });
  it("parses OFX", () => {
    const r = parseOfx("<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260903<TRNAMT>-19.99<NAME>Coffee</STMTTRN>");
    expect(r.rows[0]).toMatchObject({ date: "2026-09-03", amount: 19.99, direction: "out" });
  });
  it("rejects text amounts", () => expect(parseAmount("abc")).toBeNull());
});

describe("analytics", () => {
  const t = (o: Partial<Parameters<typeof summarize>[0][0]>) => ({ txn_date: "2026-09-10", amount: 100, direction: "in", account: "Revenue", payee: "A", status: "posted", kind: "regular", ...o });
  it("counts only posted lines", () => {
    const s = summarize([t({}), t({ status: "draft", amount: 999 }), t({ direction: "out", amount: 40, account: "Rent" })], "2026-09-01", "2026-09-30");
    expect(s.revenue).toBe(100);
    expect(s.netIncome).toBe(60);
  });
  it("buckets aging by days past due", () => {
    const a = aging([t({ kind: "invoice", due_date: "2026-08-01", amount: 50 }), t({ kind: "invoice", due_date: "2026-11-01", amount: 20 })], "invoice", "2026-10-24");
    expect(a).toEqual({ current: 20, d30: 0, d60: 50, d90: 0 });
  });
  it("checks that balances tie", () => {
    expect(ties({ opening_balance: 100, total_deposits: 50, total_withdrawals: 30, ending_balance: 120 })).toBe(true);
    expect(ties({ opening_balance: 100, total_deposits: 50, total_withdrawals: 30, ending_balance: 121 })).toBe(false);
    expect(ties({ opening_balance: null, total_deposits: 50, total_withdrawals: 30, ending_balance: 120 })).toBeNull();
  });
  it("marks coverage", () => {
    const g = coverageGrid([{ category: "Bill", period: "2026-09-01", status: "In review" }], ["Bill"], ["2026-09", "2026-10"]);
    expect(g.Bill).toEqual({ "2026-09": "received", "2026-10": "missing" });
  });
});

describe("uploads and roles", () => {
  it("accepts allowed types up to 25 MB", () => {
    expect(validateUploadFile({ name: "a.HEIC", size: 10 })).toBeNull();
    expect(validateUploadFile({ name: "a.exe", size: 10 })).not.toBeNull();
    expect(validateUploadFile({ name: "a.pdf", size: 25 * 1024 * 1024 + 1 })).not.toBeNull();
  });
  it("reviewers cannot work books or administer", () => {
    expect(canWorkBooks("reviewer")).toBe(false);
    expect(isFirmAdmin("reviewer")).toBe(false);
    expect(isFirmAdmin("admin")).toBe(true);
  });
});
