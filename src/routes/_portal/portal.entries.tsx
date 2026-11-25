import {createFileRoute} from '@tanstack/react-router';
import {Banking} from '@/components/bookkeeping/Banking';
import {PageHeader} from '@/components/common';
import {useMe} from '@/lib/me-context';
export const Route=createFileRoute('/_portal/portal/entries')({head:()=>({meta:[{title:"Submit entries · Kenna's Empire client portal"},{name:'description',content:'Submit income and expense entries for staff review.'},{property:'og:title',content:"Submit entries · Kenna's Empire"},{property:'og:description',content:'Your transactions awaiting bookkeeping review.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Entries});
function Entries(){const me=useMe();if(!me.client_id)return null;return <div className="space-y-5"><PageHeader title="Your transactions"/><Banking clientId={me.client_id} portal/></div>}
