import {createFileRoute} from '@tanstack/react-router';
import {FinancialReports} from '@/components/bookkeeping/FinancialReports';
import {PageHeader} from '@/components/common';
import {useMe} from '@/lib/me-context';
export const Route=createFileRoute('/_portal/portal/reports')({head:()=>({meta:[{title:"Financial reports · Kenna's Empire client portal"},{name:'description',content:'Read-only profit and loss, balance sheet and trial balance.'},{property:'og:title',content:"Financial reports · Kenna's Empire"},{property:'og:description',content:'Your posted financial reports.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Reports});
function Reports(){const me=useMe();if(!me.client_id)return null;return <div className="space-y-5"><PageHeader title="Financial reports"/><FinancialReports clientId={me.client_id}/></div>}
