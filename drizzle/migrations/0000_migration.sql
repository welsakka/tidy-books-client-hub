
-- ============ TYPES ============
create type public.app_role as enum ('owner','admin','preparer','reviewer','client');

-- ============ TABLES ============
create table public.firm (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  status text not null default 'active' check (status in ('active','deactivated')),
  client_id uuid,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  assignee_id uuid references public.profiles(id),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add constraint profiles_client_fk foreign key (client_id) references public.clients(id);

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  category text not null,
  period date not null,
  note text,
  status text not null default 'open' check (status in ('open','fulfilled')),
  fulfilled_document_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  original_filename text not null,
  mime_type text not null,
  size_bytes integer not null,
  relative_path text not null default '',
  file_bytes bytea not null,
  preview_bytes bytea,
  category text not null check (category in ('Bank statement','Credit card statement','Invoice','Bill','Receipt','Payroll','Tax form','Contract','Other')),
  period date not null,
  note text,
  status text not null default 'In review' check (status in ('In review','Accepted','Posted to books','Rejected')),
  rejection_reason text,
  parse_status text not null default 'not_parsed' check (parse_status in ('not_parsed','parsed','failed')),
  parse_error text,
  parse_summary jsonb,
  bundle_id uuid,
  bundle_index integer not null default 0,
  request_id uuid references public.document_requests(id),
  created_at timestamptz not null default now()
);
create index documents_client_idx on public.documents(client_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  txn_date date not null,
  description text not null default '',
  payee text not null default '',
  account text not null default 'Uncategorized',
  category text not null default '',
  amount numeric(14,2) not null check (amount >= 0),
  direction text not null check (direction in ('in','out')),
  kind text not null default 'regular' check (kind in ('regular','adjusting','invoice','bill')),
  due_date date,
  paid boolean not null default false,
  document_id uuid references public.documents(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','posted')),
  confidence numeric(4,3),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_client_idx on public.transactions(client_id, txn_date);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  period date not null,
  due_date date not null,
  status text not null default 'open' check (status in ('open','delivered')),
  created_at timestamptz not null default now()
);

create table public.engagement_stages (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  name text not null,
  position integer not null,
  weight numeric(6,2) not null,
  percent integer not null default 0 check (percent between 0 and 100),
  assignee_id uuid references public.profiles(id),
  status text not null default 'not started' check (status in ('not started','in progress','blocked','done')),
  blocker_note text,
  signed_off_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  last_message_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  author_is_staff boolean not null default false,
  body text not null check (length(body) between 1 and 5000),
  document_id uuid references public.documents(id) on delete set null,
  request_id uuid references public.document_requests(id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages(thread_id, created_at);

create table public.message_reads (
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  actor_name text not null,
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index activity_created_idx on public.activity(created_at desc);

-- ============ GRANTS ============
grant select on public.firm to authenticated;
grant select on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update on public.clients to authenticated;
grant select, insert, update on public.document_requests to authenticated;
grant select, insert, update on public.documents to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update on public.engagements to authenticated;
grant select, insert, update on public.engagement_stages to authenticated;
grant select, insert, update on public.message_threads to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update on public.message_reads to authenticated;
grant select, insert on public.activity to authenticated;
grant all on public.firm, public.profiles, public.user_roles, public.clients, public.document_requests, public.documents, public.transactions, public.engagements, public.engagement_stages, public.message_threads, public.messages, public.message_reads, public.activity to service_role;

-- ============ HELPERS ============
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_active(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = _user_id and status = 'active')
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active(_user_id) and exists (select 1 from public.user_roles where user_id = _user_id and role in ('owner','admin','preparer','reviewer'))
$$;

create or replace function public.is_firm_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active(_user_id) and exists (select 1 from public.user_roles where user_id = _user_id and role in ('owner','admin'))
$$;

create or replace function public.can_work_books(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active(_user_id) and exists (select 1 from public.user_roles where user_id = _user_id and role in ('owner','admin','preparer'))
$$;

create or replace function public.my_client_id(_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.client_id from public.profiles p
  where p.id = _user_id and p.status = 'active'
    and exists (select 1 from public.user_roles r where r.user_id = _user_id and r.role = 'client')
$$;

-- ============ RLS ============
alter table public.firm enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.clients enable row level security;
alter table public.document_requests enable row level security;
alter table public.documents enable row level security;
alter table public.transactions enable row level security;
alter table public.engagements enable row level security;
alter table public.engagement_stages enable row level security;
alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.activity enable row level security;

create policy "firm readable by signed-in" on public.firm for select to authenticated using (true);

create policy "profiles: self" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: staff read all" on public.profiles for select to authenticated using (public.is_staff(auth.uid()));
create policy "profiles: clients see firm staff and own company" on public.profiles for select to authenticated using (
  public.my_client_id(auth.uid()) is not null and (
    public.is_staff(id) or client_id = public.my_client_id(auth.uid())
  )
);

create policy "roles: self" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "roles: staff" on public.user_roles for select to authenticated using (public.is_staff(auth.uid()));
create policy "roles: clients see staff roles" on public.user_roles for select to authenticated using (public.my_client_id(auth.uid()) is not null and role <> 'client');

create policy "clients: staff read" on public.clients for select to authenticated using (public.is_staff(auth.uid()));
create policy "clients: admin write" on public.clients for insert to authenticated with check (public.is_firm_admin(auth.uid()));
create policy "clients: admin update" on public.clients for update to authenticated using (public.is_firm_admin(auth.uid()));
create policy "clients: own company" on public.clients for select to authenticated using (id = public.my_client_id(auth.uid()));

create policy "requests: staff read" on public.document_requests for select to authenticated using (public.is_staff(auth.uid()));
create policy "requests: workers write" on public.document_requests for insert to authenticated with check (public.can_work_books(auth.uid()));
create policy "requests: workers update" on public.document_requests for update to authenticated using (public.can_work_books(auth.uid()));
create policy "requests: client read own" on public.document_requests for select to authenticated using (client_id = public.my_client_id(auth.uid()));

create policy "documents: staff read" on public.documents for select to authenticated using (public.is_staff(auth.uid()));
create policy "documents: staff insert" on public.documents for insert to authenticated with check (public.can_work_books(auth.uid()));
create policy "documents: workers update" on public.documents for update to authenticated using (public.can_work_books(auth.uid()));
create policy "documents: client read own" on public.documents for select to authenticated using (client_id = public.my_client_id(auth.uid()));
create policy "documents: client upload own" on public.documents for insert to authenticated with check (
  client_id = public.my_client_id(auth.uid()) and uploaded_by = auth.uid() and status = 'In review' and parse_status = 'not_parsed'
);

create policy "txns: staff read" on public.transactions for select to authenticated using (public.is_staff(auth.uid()));
create policy "txns: workers insert" on public.transactions for insert to authenticated with check (public.can_work_books(auth.uid()));
create policy "txns: workers update" on public.transactions for update to authenticated using (public.can_work_books(auth.uid()));
create policy "txns: workers delete drafts" on public.transactions for delete to authenticated using (public.can_work_books(auth.uid()) and status = 'draft');
create policy "txns: client read posted" on public.transactions for select to authenticated using (client_id = public.my_client_id(auth.uid()) and status = 'posted');

create policy "eng: staff read" on public.engagements for select to authenticated using (public.is_staff(auth.uid()));
create policy "eng: staff insert" on public.engagements for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "eng: staff update" on public.engagements for update to authenticated using (public.is_staff(auth.uid()));
create policy "eng: client read" on public.engagements for select to authenticated using (client_id = public.my_client_id(auth.uid()));

create policy "stages: staff read" on public.engagement_stages for select to authenticated using (public.is_staff(auth.uid()));
create policy "stages: staff insert" on public.engagement_stages for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "stages: staff update" on public.engagement_stages for update to authenticated using (public.is_staff(auth.uid()));
create policy "stages: client read" on public.engagement_stages for select to authenticated using (
  exists (select 1 from public.engagements e where e.id = engagement_id and e.client_id = public.my_client_id(auth.uid()))
);

create policy "threads: staff" on public.message_threads for select to authenticated using (public.is_staff(auth.uid()));
create policy "threads: staff insert" on public.message_threads for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "threads: client" on public.message_threads for select to authenticated using (client_id = public.my_client_id(auth.uid()));

create policy "messages: staff read" on public.messages for select to authenticated using (public.is_staff(auth.uid()));
create policy "messages: staff write" on public.messages for insert to authenticated with check (public.is_staff(auth.uid()) and author_id = auth.uid());
create policy "messages: client read" on public.messages for select to authenticated using (client_id = public.my_client_id(auth.uid()));
create policy "messages: client write" on public.messages for insert to authenticated with check (client_id = public.my_client_id(auth.uid()) and author_id = auth.uid());

create policy "reads: own" on public.message_reads for select to authenticated using (user_id = auth.uid());
create policy "reads: own insert" on public.message_reads for insert to authenticated with check (user_id = auth.uid());
create policy "reads: own update" on public.message_reads for update to authenticated using (user_id = auth.uid());

create policy "activity: staff read" on public.activity for select to authenticated using (public.is_staff(auth.uid()));
create policy "activity: write own" on public.activity for insert to authenticated with check (
  actor_id = auth.uid() and (public.is_staff(auth.uid()) or client_id = public.my_client_id(auth.uid()))
);

-- ============ TRIGGERS ============
create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_is_staff := public.is_staff(new.author_id);
  select client_id into new.client_id from public.message_threads where id = new.thread_id;
  return new;
end $$;
create trigger messages_bi before insert on public.messages for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.message_threads set last_message_at = new.created_at where id = new.thread_id;
  insert into public.message_reads(thread_id, user_id, last_read_at) values (new.thread_id, new.author_id, new.created_at)
    on conflict (thread_id, user_id) do update set last_read_at = greatest(public.message_reads.last_read_at, excluded.last_read_at);
  insert into public.activity(client_id, actor_id, actor_name, action, detail)
    select new.client_id, new.author_id, p.full_name, 'message', left(new.body, 140) from public.profiles p where p.id = new.author_id;
  return new;
end $$;
create trigger messages_ai after insert on public.messages for each row execute function public.messages_after_insert();

-- Uploads satisfy a matching open request
create or replace function public.documents_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare req uuid;
begin
  select id into req from public.document_requests
   where client_id = new.client_id and status = 'open' and category = new.category and period = new.period
   order by created_at limit 1;
  if req is not null then
    update public.document_requests set status = 'fulfilled', fulfilled_document_id = new.id where id = req;
    update public.documents set request_id = req where id = new.id and request_id is null;
  end if;
  return new;
end $$;
create trigger documents_ai after insert on public.documents for each row execute function public.documents_after_insert();

-- Unread counts per thread for the current user
create or replace function public.thread_summaries()
returns table (thread_id uuid, client_id uuid, client_name text, last_message_at timestamptz, last_body text, unread integer, unread_from_client integer)
language sql stable security invoker set search_path = public as $$
  select t.id, t.client_id, c.name, t.last_message_at,
    (select m.body from public.messages m where m.thread_id = t.id order by m.created_at desc limit 1),
    (select count(*)::int from public.messages m where m.thread_id = t.id and m.author_id <> auth.uid()
        and m.created_at > coalesce((select r.last_read_at from public.message_reads r where r.thread_id = t.id and r.user_id = auth.uid()), '-infinity'::timestamptz)),
    (select count(*)::int from public.messages m where m.thread_id = t.id and m.author_id <> auth.uid() and not m.author_is_staff
        and m.created_at > coalesce((select r.last_read_at from public.message_reads r where r.thread_id = t.id and r.user_id = auth.uid()), '-infinity'::timestamptz))
  from public.message_threads t join public.clients c on c.id = t.client_id
  order by t.last_message_at desc
$$;
grant execute on function public.thread_summaries() to authenticated;
