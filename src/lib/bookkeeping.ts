import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
export type Account = Database['public']['Tables']['accounts']['Row'];
export const ACCOUNT_TYPES = ['bank','accounts_receivable','other_current_asset','fixed_asset','other_asset','accounts_payable','credit_card','other_current_liability','long_term_liability','equity','income','cost_of_goods_sold','expense','other_income','other_expense'] as const;
export function moneyCents(raw: string): number {
  const s=raw.replace(/[$,\s]/g,''); const m=s.match(/^(\-?)(\d+)(?:\.(\d{1,2}))?$/);
  if(!m) throw new Error('Enter an amount with at most two decimal places');
  const n=Number(m[2])*100+Number((m[3]??'').padEnd(2,'0'));
  if(!Number.isSafeInteger(n)) throw new Error('Amount is too large');
  return m[1] ? -n : n;
}
export function centsMoney(n: number | bigint, currency='USD') { const v=Number(n); const f=new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Math.abs(v)/100); return v<0?`(${f})`:f; }
export type JournalLineInput={account_id:string;debit_cents:number;credit_cents:number;description?:string;contact_id?:string};
export function transactionLines(direction:string, amount:number,category:string,bank:string):JournalLineInput[] {return [{account_id:direction==='in'?bank:category,debit_cents:amount,credit_cents:0},{account_id:direction==='in'?category:bank,debit_cents:0,credit_cents:amount}];}
export function balanced(lines:JournalLineInput[]) {return lines.length>=2&&lines.every(l=>l.account_id&&Number.isSafeInteger(l.debit_cents)&&Number.isSafeInteger(l.credit_cents)&&((l.debit_cents>0&&l.credit_cents===0)||(l.credit_cents>0&&l.debit_cents===0)))&&lines.reduce((s,l)=>s+l.debit_cents-l.credit_cents,0)===0;}
export function requireData<T>(r:{data:T|null;error:{message:string}|null}):T {if(r.error)throw new Error(r.error.message);if(r.data===null)throw new Error('No data returned');return r.data;}
export const bq={
 accounts:(id:string)=>({queryKey:['accounts',id],queryFn:async()=>requireData(await supabase.from('accounts').select('*').eq('client_id',id).order('number'))}),
 journals:(id:string)=>({queryKey:['journals',id],queryFn:async()=>requireData(await supabase.from('journal_entries').select('*, journal_lines(*)').eq('client_id',id).order('entry_number',{ascending:false}))}),
 contacts:(id:string)=>({queryKey:['contacts',id],queryFn:async()=>requireData(await supabase.from('contacts').select('*').eq('client_id',id).order('name'))}),
 company:(id:string)=>({queryKey:['company',id],queryFn:async():Promise<Database['public']['Tables']['clients']['Row']>=>requireData(await supabase.from('clients').select('*').eq('id',id).single())}),
 access:(id:string)=>({queryKey:['access',id],queryFn:async()=>requireData(await supabase.from('client_access').select('*').eq('client_id',id))}),
 folders:(id:string)=>({queryKey:['folders',id],queryFn:async()=>requireData(await supabase.from('doc_folders').select('*').eq('client_id',id).order('name'))}),
 audit:(id:string)=>({queryKey:['audit',id],queryFn:async()=>requireData(await supabase.from('audit_log').select('*').eq('client_id',id).order('at',{ascending:false}).limit(200))}),
};
export type JournalReportEntry={entry_date:string;voided:boolean;journal_lines:{account_id:string;debit_cents:number;credit_cents:number}[]};
export function financialReport(accounts:Pick<Account,'id'|'name'|'number'|'account_type'>[],entries:JournalReportEntry[],from:string,to:string,cash:boolean){
 const eligible=entries.filter(e=>!e.voided&&e.entry_date<=to&&(!cash||!e.journal_lines.some(l=>accounts.some(a=>a.id===l.account_id&&['accounts_receivable','accounts_payable'].includes(a.account_type)))));
 const rows=accounts.map(a=>{let net=0,period=0;for(const e of eligible)for(const l of e.journal_lines)if(l.account_id===a.id){net+=l.debit_cents-l.credit_cents;if(e.entry_date>=from)period+=l.debit_cents-l.credit_cents;}return {...a,net,period};});
 const sum=(types:string[],p=false)=>rows.filter(a=>types.includes(a.account_type)).reduce((s,a)=>s+(p?a.period:a.net),0);
 const revenue=0-sum(['income'],true),cogs=sum(['cost_of_goods_sold'],true),expenses=sum(['expense'],true),other=-sum(['other_income'],true)-sum(['other_expense'],true);
 const assets=sum(['bank','accounts_receivable','other_current_asset','fixed_asset','other_asset']),liabilities=-sum(['accounts_payable','credit_card','other_current_liability','long_term_liability']),equity=-sum(['equity']);
 const retained=-sum(['income','other_income'])-sum(['expense','other_expense','cost_of_goods_sold']);
 return {rows,revenue,cogs,expenses,other,netIncome:revenue-cogs-expenses+other,assets,liabilities,equity:equity+retained,retained,balanced:assets===liabilities+equity+retained};
}
export async function recordTransaction(id:string,category:string,bank:string){ requireData(await supabase.rpc('categorize_transaction',{_txn:id,_category:category,_bank:bank})); }
