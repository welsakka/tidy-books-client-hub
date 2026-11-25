import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import type { Account } from '@/lib/bookkeeping';
export function Field({label,children}:{label:string;children:ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>}
export function TextField({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){return <Field label={label}><Input aria-label={label} type={type} value={value} onChange={e=>onChange(e.target.value)}/></Field>}
export function AccountPicker({value,onChange,accounts,label='Account'}:{value:string;onChange:(v:string)=>void;accounts:Account[];label?:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="min-w-40"><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{accounts.filter(a=>a.is_active).map(a=><SelectItem key={a.id} value={a.id}>{a.number} · {a.name}</SelectItem>)}</SelectContent></Select>}
