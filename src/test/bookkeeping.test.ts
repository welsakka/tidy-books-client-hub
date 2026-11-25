import {describe,it,expect} from 'vitest';
import {moneyCents,balanced,transactionLines,financialReport,centsMoney} from '@/lib/bookkeeping';
describe('bookkeeping integrity',()=>{
 it('stores $1,234.56 as 123456 cents',()=>expect(moneyCents('$1,234.56')).toBe(123456));
 it('rejects fractional cents',()=>expect(()=>moneyCents('1.001')).toThrow());
 it('formats negative money in parentheses',()=>expect(centsMoney(-123456)).toBe('($1,234.56)'));
 it('money out debits category and credits bank',()=>expect(transactionLines('out',123456,'expense','bank')).toEqual([{account_id:'expense',debit_cents:123456,credit_cents:0},{account_id:'bank',debit_cents:0,credit_cents:123456}]));
 it('requires two balanced one-sided lines',()=>{expect(balanced(transactionLines('in',100,'income','bank'))).toBe(true);expect(balanced([{account_id:'bank',debit_cents:100,credit_cents:0},{account_id:'income',debit_cents:0,credit_cents:99}])).toBe(false);});
 it('reports balance sheet and profit from journals, excluding voids',()=>{const a=[{id:'b',name:'Checking',number:'1000',account_type:'bank'},{id:'i',name:'Sales',number:'4000',account_type:'income'}];const r=financialReport(a,[{entry_date:'2026-10-01',voided:false,journal_lines:transactionLines('in',123456,'i','b')},{entry_date:'2026-10-02',voided:true,journal_lines:transactionLines('in',999,'i','b')}],'2026-10-01','2026-10-31',false);expect(r.netIncome).toBe(123456);expect(r.assets).toBe(123456);expect(r.equity).toBe(123456);expect(r.balanced).toBe(true);});
 it('cash basis excludes receivable entries',()=>{const a=[{id:'ar',name:'AR',number:'1100',account_type:'accounts_receivable'},{id:'i',name:'Sales',number:'4000',account_type:'income'}];expect(financialReport(a,[{entry_date:'2026-10-01',voided:false,journal_lines:transactionLines('in',10000,'i','ar')}],'2026-10-01','2026-10-31',true).revenue).toBe(0);});
});
