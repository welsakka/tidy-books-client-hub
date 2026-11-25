
create or replace function public._seed_pdf(title text, body_lines text[]) returns bytea language plpgsql as $$
declare
  stream text := 'BT /F1 16 Tf 56 760 Td (' || replace(replace(title,'(','['),')',']') || ') Tj /F1 10 Tf';
  l text; doc text; offs int[] := '{}'; objs text[]; i int; xref text;
begin
  foreach l in array body_lines loop
    stream := stream || ' 0 -16 Td (' || replace(replace(l,'(','['),')',']') || ') Tj';
  end loop;
  stream := stream || ' ET';
  objs := array[
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj' || chr(10),
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj' || chr(10),
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj' || chr(10),
    '4 0 obj << /Length ' || length(stream) || ' >> stream' || chr(10) || stream || chr(10) || 'endstream endobj' || chr(10),
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj' || chr(10)
  ];
  doc := '%PDF-1.4' || chr(10);
  for i in 1..5 loop
    offs := offs || length(doc);
    doc := doc || objs[i];
  end loop;
  xref := 'xref' || chr(10) || '0 6' || chr(10) || '0000000000 65535 f ' || chr(10);
  for i in 1..5 loop
    xref := xref || lpad(offs[i]::text, 10, '0') || ' 00000 n ' || chr(10);
  end loop;
  doc := doc || xref || 'trailer << /Size 6 /Root 1 0 R >>' || chr(10) || 'startxref' || chr(10) || (length(doc)) || chr(10) || '%%EOF';
  return convert_to(doc, 'UTF8');
end $$;

do $$
declare
  u record;
  cl record;
  m int; i int;
  mstart date; base numeric; amt numeric;
  eng uuid; thr uuid;
  d_bank_aug uuid; d_bank_sep uuid; d_cc uuid; d_inv uuid; d_rcpt uuid; d_pay uuid; d_tax uuid;
  pcts int[]; stage_names text[] := array['Intake','Document collection','Categorization','Bank reconciliation','Adjusting entries','Review','Client questions','Delivery'];
  weights numeric[] := array[5,15,20,20,15,10,5,10];
  st text; csv text; preparer uuid; cuser uuid;
  rev_payees text[]; exp_items text[][];
  kenna uuid := 'a0000000-0000-4000-8000-000000000001';
  theo uuid := 'a0000000-0000-4000-8000-000000000004';
begin
  perform setseed(0.42);
  insert into public.firm(name) values ('Kenna''s Empire');

  -- clients first (profiles reference them)
  insert into public.clients(id,name,industry,contact_name,contact_email) values
   ('c0000000-0000-4000-8000-000000000001','Northwind Ceramics','Ceramics studio and wholesale pottery','Priya Raman','priya@northwind.co'),
   ('c0000000-0000-4000-8000-000000000002','Harbor & Rye Catering','Event catering','Marcus Bell','marcus@harborandrye.com'),
   ('c0000000-0000-4000-8000-000000000003','Lumen Pediatric Dental','Pediatric dental practice','Dr. Adaeze Okafor','adaeze@lumendental.com'),
   ('c0000000-0000-4000-8000-000000000004','Fieldnote Studio','Brand and design studio','June Alvarez','june@fieldnote.studio'),
   ('c0000000-0000-4000-8000-000000000005','Oak & Iron Construction','Residential general contractor','Ray Donnelly','ray@oakandiron.build');

  for u in select * from (values
    ('a0000000-0000-4000-8000-000000000001'::uuid,'Kenna','kenna@kennasempire.com','owner'::public.app_role,null::uuid),
    ('a0000000-0000-4000-8000-000000000002','Jonas Keller','jonas@kennasempire.com','preparer',null),
    ('a0000000-0000-4000-8000-000000000003','Dana Whitfield','dana@kennasempire.com','preparer',null),
    ('a0000000-0000-4000-8000-000000000004','Theo Brandt','theo@kennasempire.com','reviewer',null),
    ('a0000000-0000-4000-8000-000000000005','Ava Lindqvist','ava@kennasempire.com','admin',null),
    ('b0000000-0000-4000-8000-000000000001','Priya Raman','priya@northwind.co','client','c0000000-0000-4000-8000-000000000001'),
    ('b0000000-0000-4000-8000-000000000002','Marcus Bell','marcus@harborandrye.com','client','c0000000-0000-4000-8000-000000000002'),
    ('b0000000-0000-4000-8000-000000000003','Dr. Adaeze Okafor','adaeze@lumendental.com','client','c0000000-0000-4000-8000-000000000003'),
    ('b0000000-0000-4000-8000-000000000004','June Alvarez','june@fieldnote.studio','client','c0000000-0000-4000-8000-000000000004'),
    ('b0000000-0000-4000-8000-000000000005','Ray Donnelly','ray@oakandiron.build','client','c0000000-0000-4000-8000-000000000005')
  ) as t(id,name,email,role,client_id) loop
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
    values ('00000000-0000-0000-0000-000000000000',u.id,'authenticated','authenticated',u.email,extensions.crypt('ledger',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name',u.name),now(),now(),'','','','');
    insert into auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values (gen_random_uuid(),u.id,u.id::text,jsonb_build_object('sub',u.id::text,'email',u.email,'email_verified',true),'email',now(),now(),now());
    insert into public.profiles(id,full_name,email,client_id) values (u.id,u.name,u.email,u.client_id);
    insert into public.user_roles(user_id,role) values (u.id,u.role);
  end loop;

  update public.clients set assignee_id = 'a0000000-0000-4000-8000-000000000002' where id in ('c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000005');
  update public.clients set assignee_id = 'a0000000-0000-4000-8000-000000000003' where id in ('c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000003');

  for cl in select c.*, row_number() over (order by c.id) as n from public.clients c loop
    preparer := cl.assignee_id;
    cuser := ('b0000000-0000-4000-8000-00000000000' || cl.n)::uuid;
    if cl.n = 1 then
      base := 38000; rev_payees := array['Juniper Home Goods','Saltbox Restaurant Group','Studio class tuition','Market Hall Gallery'];
      exp_items := array[['Ridgeline Clay Supply','Materials'],['Pacific Gas & Electric','Utilities'],['Gusto Payroll','Payroll'],['Dockside Properties','Rent'],['UPS Freight','Shipping'],['Kiln Works Repair','Repairs & maintenance'],['Hartford Insurance','Insurance'],['Adobe','Software']];
    elsif cl.n = 2 then
      base := 72000; rev_payees := array['Whitmore Wedding','Brightline Corporate Events','Ferris Foundation Gala','Weekly office lunches'];
      exp_items := array[['Restaurant Depot','Food & beverage'],['Coastal Produce Co.','Food & beverage'],['Gusto Payroll','Payroll'],['Commissary Kitchen LLC','Rent'],['Enterprise Truck Rental','Vehicles'],['Linen King','Rentals'],['Hartford Insurance','Insurance'],['Shell Fleet','Fuel']];
    elsif cl.n = 3 then
      base := 115000; rev_payees := array['Delta Dental PPO','Patient payments','Cigna Dental','MetLife Dental'];
      exp_items := array[['Henry Schein','Dental supplies'],['Patterson Dental','Dental supplies'],['ADP Payroll','Payroll'],['Brookside Medical Plaza','Rent'],['Dentrix','Software'],['Coastal Dental Lab','Lab fees'],['MedPro Group','Insurance'],['City Water & Power','Utilities']];
    elsif cl.n = 4 then
      base := 46000; rev_payees := array['Tidewater Coffee retainer','Alder Outdoor brand project','Meridian Credit Union','Harlow Books'];
      exp_items := array[['Figma','Software'],['Adobe','Software'],['Gusto Payroll','Payroll'],['WeWork','Rent'],['Contract illustrator - M. Ortiz','Contractors'],['Dell Technologies','Equipment'],['Hiscox Insurance','Insurance'],['Comcast Business','Utilities']];
    else
      base := 160000; rev_payees := array['Halvorsen kitchen remodel','Pine Street ADU','Maple Court addition','Change order deposits'];
      exp_items := array[['Home Depot Pro','Materials'],['Ferguson Plumbing Supply','Materials'],['ADP Payroll','Payroll'],['Bayline Electric (sub)','Subcontractors'],['Sunbelt Rentals','Equipment rental'],['Liberty Mutual','Insurance'],['Shell Fleet','Fuel'],['Cascade Waste Hauling','Disposal']];
    end if;

    -- 14 months of ledger: Sep 2025 .. Oct 2026
    for m in 0..13 loop
      mstart := (date '2025-09-01' + make_interval(months => m))::date;
      for i in 1..4 loop
        amt := round((base/4 * (0.75 + random()*0.5) * (1 + 0.12*sin(m)))::numeric, 2);
        insert into public.transactions(client_id,txn_date,description,payee,account,category,amount,direction,status,created_by)
        values (cl.id, mstart + (i*6 + floor(random()*4))::int, 'Deposit - ' || rev_payees[i], rev_payees[i], 'Revenue', 'Income', amt, 'in',
          case when mstart >= date '2026-09-01' and i > 2 then 'draft' else 'posted' end, preparer);
      end loop;
      for i in 1..8 loop
        amt := round((base * (array[0.14,0.05,0.32,0.09,0.04,0.03,0.03,0.02])[i] * (0.85 + random()*0.3))::numeric, 2);
        insert into public.transactions(client_id,txn_date,description,payee,account,category,amount,direction,status,created_by)
        values (cl.id, mstart + (i*3 + floor(random()*2))::int, exp_items[i][1] || ' - ' || to_char(mstart,'Mon YYYY'), exp_items[i][1], exp_items[i][2], 'Expense', amt, 'out',
          case when mstart >= date '2026-09-01' and i > 5 then 'draft' else 'posted' end, preparer);
      end loop;
    end loop;

    -- open invoices and bills for aging
    insert into public.transactions(client_id,txn_date,description,payee,account,category,amount,direction,kind,due_date,paid,status,created_by) values
      (cl.id, current_date - 20, 'Invoice #' || (1040+cl.n*10), rev_payees[1], 'Accounts receivable', 'Invoice', round((base*0.12)::numeric,2), 'in', 'invoice', current_date + 10, false, 'posted', preparer),
      (cl.id, current_date - 55, 'Invoice #' || (1031+cl.n*10), rev_payees[2], 'Accounts receivable', 'Invoice', round((base*0.08)::numeric,2), 'in', 'invoice', current_date - 25, false, 'posted', preparer),
      (cl.id, current_date - 95, 'Invoice #' || (1022+cl.n*10), rev_payees[3], 'Accounts receivable', 'Invoice', round((base*0.05)::numeric,2), 'in', 'invoice', current_date - 65, false, 'posted', preparer),
      (cl.id, current_date - 130, 'Invoice #' || (1013+cl.n*10), rev_payees[4], 'Accounts receivable', 'Invoice', round((base*0.03)::numeric,2), 'in', 'invoice', current_date - 100, false, 'posted', preparer),
      (cl.id, current_date - 10, 'Bill - ' || exp_items[1][1], exp_items[1][1], 'Accounts payable', 'Bill', round((base*0.07)::numeric,2), 'out', 'bill', current_date + 20, false, 'posted', preparer),
      (cl.id, current_date - 45, 'Bill - ' || exp_items[5][1], exp_items[5][1], 'Accounts payable', 'Bill', round((base*0.03)::numeric,2), 'out', 'bill', current_date - 15, false, 'posted', preparer),
      (cl.id, current_date - 80, 'Bill - ' || exp_items[6][1], exp_items[6][1], 'Accounts payable', 'Bill', round((base*0.02)::numeric,2), 'out', 'bill', current_date - 50, false, 'posted', preparer);

    -- documents
    d_bank_aug := gen_random_uuid(); d_bank_sep := gen_random_uuid(); d_cc := gen_random_uuid(); d_inv := gen_random_uuid(); d_rcpt := gen_random_uuid(); d_pay := gen_random_uuid(); d_tax := gen_random_uuid();
    csv := 'Posted Date,Description,Amount' || chr(10) ||
      '2026-09-03,' || exp_items[8][1] || ',-' || round((base*0.02)::numeric,2) || chr(10) ||
      '2026-09-09,' || exp_items[5][1] || ',(' || round((base*0.015)::numeric,2) || ')' || chr(10) ||
      '2026-09-14,Office supplies - Staples,-184.22' || chr(10) ||
      '2026-09-18,Refund - ' || exp_items[1][1] || ',212.40' || chr(10) ||
      '2026-09-22,Team lunch - Tartine,-96.18' || chr(10) ||
      'not a date,Card payment thank you,abc' || chr(10);
    insert into public.documents(id,client_id,uploaded_by,original_filename,mime_type,size_bytes,relative_path,file_bytes,category,period,status,parse_status,created_at) values
      (d_bank_aug, cl.id, cuser, 'bank-statement-aug-2026.pdf','application/pdf',0,'',public._seed_pdf(cl.name || ' - Business Checking - August 2026', array['Opening balance 41,210.55','Total deposits ' || round(base,2),'Total withdrawals ' || round(base*0.7,2),'Ending balance ' || round(41210.55 + base*0.3,2)]),'Bank statement','2026-08-01','Accepted','not_parsed', now() - interval '40 days'),
      (d_bank_sep, cl.id, cuser, 'bank-statement-sep-2026.pdf','application/pdf',0,'',public._seed_pdf(cl.name || ' - Business Checking - September 2026', array['Statement period 09/01/2026 - 09/30/2026','Opening balance ' || round(41210.55 + base*0.3,2),'See transaction detail on following lines','09/08 Deposit ' || rev_payees[1] || ' ' || round(base/4,2),'09/12 ' || exp_items[3][1] || ' ' || round(base*0.32,2)]),'Bank statement','2026-09-01','In review','not_parsed', now() - interval '6 days'),
      (d_cc, cl.id, cuser, 'card-activity-sep-2026.csv','text/csv',0,'',convert_to(csv,'UTF8'),'Credit card statement','2026-09-01','In review','not_parsed', now() - interval '4 days'),
      (d_inv, cl.id, preparer, 'invoice-' || (1040+cl.n*10) || '.pdf','application/pdf',0,'',public._seed_pdf('Invoice #' || (1040+cl.n*10), array['Bill to: ' || rev_payees[1], 'Amount due ' || round(base*0.12,2), 'Terms: Net 30']),'Invoice','2026-09-01','Accepted','not_parsed', now() - interval '20 days'),
      (d_rcpt, cl.id, cuser, 'receipt-' || lower(replace(exp_items[6][1],' ','-')) || '.pdf','application/pdf',0,'',public._seed_pdf('Receipt - ' || exp_items[6][1], array['Date 09/17/2026','Total ' || round(base*0.03,2),'Paid by business card ending 4421']),'Receipt','2026-09-01','In review','not_parsed', now() - interval '2 days'),
      (d_pay, cl.id, cuser, 'payroll-register-aug-2026.pdf','application/pdf',0,'',public._seed_pdf('Payroll register - August 2026', array['Gross wages ' || round(base*0.27,2),'Employer taxes ' || round(base*0.05,2),'Net pay ' || round(base*0.2,2)]),'Payroll','2026-08-01','Posted to books','not_parsed', now() - interval '35 days'),
      (d_tax, cl.id, cuser, 'w9-vendor.pdf','application/pdf',0,'',public._seed_pdf('Form W-9 (unsigned copy)', array['Name: ' || exp_items[4][1],'Signature: ____________']),'Tax form','2026-09-01','Rejected','not_parsed', now() - interval '9 days');
    update public.documents set rejection_reason = 'The W-9 is unsigned. Please upload the signed copy.' where id = d_tax;
    update public.documents set size_bytes = octet_length(file_bytes), relative_path = 'uploads/clients/' || client_id || '/' || id || '/original' where client_id = cl.id;
    update public.transactions set document_id = d_bank_aug where client_id = cl.id and kind = 'regular' and txn_date between '2026-08-01' and '2026-08-31' and account <> 'Payroll';
    update public.transactions set document_id = d_pay where client_id = cl.id and kind = 'regular' and txn_date between '2026-08-01' and '2026-08-31' and account = 'Payroll';
    update public.transactions set document_id = d_bank_sep where client_id = cl.id and status = 'draft';
    update public.transactions set document_id = d_inv where client_id = cl.id and kind = 'invoice' and due_date = current_date + 10;

    -- requests
    insert into public.document_requests(client_id,category,period,note,created_by,created_at) values
      (cl.id,'Payroll','2026-09-01','September payroll register from your payroll provider', preparer, now() - interval '8 days'),
      (cl.id,'Bill','2026-09-01','Any unpaid vendor bills dated in September', preparer, now() - interval '7 days'),
      (cl.id,'Tax form','2026-09-01','Signed W-9 for ' || exp_items[4][1], preparer, now() - interval '5 days');
    if cl.n in (3,5) then
      insert into public.document_requests(client_id,category,period,note,created_by,created_at) values
        (cl.id,'Contract','2026-09-01','Signed lease or subcontract agreement renewed in September', preparer, now() - interval '3 days');
    end if;

    -- engagement (September close)
    insert into public.engagements(client_id,period,due_date) values (cl.id,'2026-09-01', (date '2026-10-20' + (cl.n*3)::int)) returning id into eng;
    pcts := case cl.n
      when 1 then array[100,100,100,100,0,0,40,0]       -- 62
      when 2 then array[100,100,100,5,0,0,0,0]          -- 41
      when 3 then array[100,100,100,100,100,80,100,0]   -- 88
      when 4 then array[100,80,30,0,0,0,0,0]            -- 23
      else array[100,100,100,100,60,0,40,0] end;        -- 71
    for i in 1..8 loop
      st := case when pcts[i] = 100 then 'done' when pcts[i] > 0 then 'in progress' else 'not started' end;
      insert into public.engagement_stages(engagement_id,name,position,weight,percent,assignee_id,status,blocker_note,updated_at)
      values (eng, stage_names[i], i, weights[i], pcts[i], case when i = 6 then theo else preparer end, st, null, now() - make_interval(days => 9 - i));
    end loop;
    if cl.n = 2 then
      update public.engagement_stages set status = 'blocked', blocker_note = 'Waiting on September payroll register before reconciling the operating account.' where engagement_id = eng and name = 'Bank reconciliation';
    elsif cl.n = 4 then
      update public.engagement_stages set status = 'blocked', blocker_note = 'Contractor invoices for September have not been uploaded yet.' where engagement_id = eng and name = 'Document collection';
    end if;

    -- message thread
    insert into public.message_threads(client_id) values (cl.id) returning id into thr;
    insert into public.messages(thread_id,client_id,author_id,body,created_at) values
      (thr, cl.id, preparer, 'Hi ' || split_part(cl.contact_name,' ',1) || ', we have started the September close. Could you upload the payroll register when it is ready?', now() - interval '6 days'),
      (thr, cl.id, cuser, 'Will do. The bank statement and card activity are uploaded now.', now() - interval '5 days 20 hours');
    insert into public.messages(thread_id,client_id,author_id,body,document_id,created_at) values
      (thr, cl.id, preparer, 'Thanks. The W-9 came through unsigned, so I sent it back with a note.', d_tax, now() - interval '3 days'),
      (thr, cl.id, cuser, 'Question on the ' || exp_items[6][1] || ' receipt: should that go to repairs or equipment?', d_rcpt, now() - interval '20 hours'),
      (thr, cl.id, cuser, 'Also, the payroll provider says the September register will be available Friday.', null, now() - interval '3 hours');
    -- read markers: client has not read the W-9 message; staff have not read the last two client messages
    insert into public.message_reads(thread_id,user_id,last_read_at) values
      (thr, cuser, now() - interval '5 days'),
      (thr, preparer, now() - interval '2 days'),
      (thr, kenna, now() - interval '2 days')
    on conflict (thread_id,user_id) do update set last_read_at = excluded.last_read_at;

    insert into public.activity(client_id,actor_id,actor_name,action,detail,created_at)
      select cl.id, p.id, p.full_name, x.action, x.detail, x.at from public.profiles p,
      (values (cuser,'upload','Uploaded bank-statement-sep-2026.pdf (Bank statement, Sep 2026)', now() - interval '6 days'),
              (preparer,'progress','Categorization set to ' || pcts[3] || '%', now() - interval '4 days'),
              (preparer,'reject','Rejected w9-vendor.pdf: The W-9 is unsigned.', now() - interval '3 days')) as x(actor,action,detail,at)
      where p.id = x.actor;
  end loop;
  -- the trigger-created reads for authors are fine; reset preparer/kenna markers already set above
end $$;

drop function public._seed_pdf(text, text[]);
