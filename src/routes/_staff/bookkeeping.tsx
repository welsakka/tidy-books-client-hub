import {createFileRoute,Link} from '@tanstack/react-router';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {BookOpen,ArrowUpRight} from 'lucide-react';
import {PageHeader,PageSkeleton,ErrorBox,Empty} from '@/components/common';
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {q} from '@/lib/data';
import {Banking} from '@/components/bookkeeping/Banking';
import {Accounts} from '@/components/bookkeeping/Accounts';
import {Journals} from '@/components/bookkeeping/Journals';
import {FinancialReports} from '@/components/bookkeeping/FinancialReports';
import {Contacts} from '@/components/bookkeeping/Contacts';
import {CompanySettings,AuditHistory} from '@/components/bookkeeping/Settings';
import {DocumentFolders} from '@/components/bookkeeping/DocumentFolders';
export const Route=createFileRoute('/_staff/bookkeeping')({head:()=>({meta:[{title:"Bookkeeping center · Kenna's Empire"},{name:'description',content:'Company accounts, balanced journals, banking review, financial reports and audit history.'},{property:'og:title',content:"Bookkeeping center · Kenna's Empire"},{property:'og:description',content:'A complete financial workspace for every client.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Center});
function Center(){const clients=useQuery(q.clients()),[selected,setSelected]=useState(''),[tab,setTab]=useState('banking');if(clients.isLoading)return <PageSkeleton/>;if(clients.error)return <ErrorBox error={clients.error}/>;const id=selected||clients.data?.find(c=>!c.archived)?.id;if(!id)return <Empty title="Add a company to begin"/>;return <div className="space-y-5 animate-fade-up"><PageHeader title="Bookkeeping center" subtitle={clients.data?.find(c=>c.id===id)?.name} actions={<div className="flex flex-wrap gap-2"><Select value={id} onValueChange={setSelected}><SelectTrigger aria-label="Company" className="w-60"><SelectValue/></SelectTrigger><SelectContent>{clients.data?.filter(c=>!c.archived).map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" asChild><Link to="/clients/$clientId" params={{clientId:id}}><ArrowUpRight className="mr-2 size-4"/>Client workspace</Link></Button></div>}/><div className="flex items-center gap-2 border-b pb-3 text-sm text-muted-foreground"><BookOpen className="size-4 text-brass"/><span>{clients.data?.find(c=>c.id===id)?.industry}</span></div><Tabs key={id} value={tab} onValueChange={setTab}><div className="overflow-x-auto pb-1"><TabsList>{['banking','accounts','journals','reports','contacts','documents','settings','audit'].map(t=><TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}</TabsList></div><TabsContent value="banking"><Banking clientId={id}/></TabsContent><TabsContent value="accounts"><Accounts clientId={id}/></TabsContent><TabsContent value="journals"><Journals clientId={id}/></TabsContent><TabsContent value="reports"><FinancialReports clientId={id}/></TabsContent><TabsContent value="contacts"><Contacts clientId={id}/></TabsContent><TabsContent value="documents"><DocumentFolders clientId={id}/></TabsContent><TabsContent value="settings"><CompanySettings clientId={id}/></TabsContent><TabsContent value="audit"><AuditHistory clientId={id}/></TabsContent></Tabs></div>}
