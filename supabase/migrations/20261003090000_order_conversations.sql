-- Conversations are separate from vehicle, financial and request documents.
-- Public access is limited to one existing personal request link.
create table public.sc_order_messages (
  seq bigint generated always as identity primary key,
  request_id uuid not null unique,
  lead_id text not null,
  sender text not null check (sender in ('client', 'team')),
  author text not null,
  member_id uuid,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  sent_at timestamptz not null default now()
);
create index sc_order_messages_lead_seq on public.sc_order_messages (lead_id, seq desc);
alter table public.sc_order_messages enable row level security;
revoke all on public.sc_order_messages from public, anon, authenticated;
revoke all on sequence public.sc_order_messages_seq_seq from public, anon, authenticated;

-- Internal helper; it is never callable by a browser role.
create function public.sc_message_page(p_lead_id text, p_before bigint default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with page as (
    select seq, sender, author, body, sent_at from public.sc_order_messages
    where lead_id = p_lead_id and (p_before is null or seq < p_before)
    order by seq desc limit 100
  )
  select jsonb_build_object('messages', coalesce((select jsonb_agg(jsonb_build_object(
    'id', seq::text, 'sender', sender, 'author', author, 'body', body, 'at', sent_at
  ) order by seq) from page), '[]'::jsonb),
  'hasMore', exists (select 1 from public.sc_order_messages where lead_id = p_lead_id
    and seq < (select min(seq) from page)));
$$;
revoke all on function public.sc_message_page(text,bigint) from public, anon, authenticated;

create function public.sc_order_messages(p_token text, p_before bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rid text;
begin
  if coalesce(p_token,'') !~ '^[a-f0-9]{24}$' then raise exception 'not_found'; end if;
  select id into rid from public.sc_docs where collection='leads' and data->>'token'=p_token limit 1;
  if rid is null then raise exception 'not_found'; end if;
  return public.sc_message_page(rid,p_before);
end $$;

create function public.sc_team_order_messages(p_lead_id text, p_before bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sc_is_member() then raise exception 'not_granted' using errcode='42501'; end if;
  if not exists (select 1 from public.sc_docs where collection='leads' and id=p_lead_id) then raise exception 'not_found'; end if;
  return public.sc_message_page(p_lead_id,p_before);
end $$;

create function public.sc_order_send_message(p_token text, p_text text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare rid text; doc jsonb; msg public.sc_order_messages; txt text := btrim(coalesce(p_text,''));
begin
  if coalesce(p_token,'') !~ '^[a-f0-9]{24}$' then raise exception 'not_found'; end if;
  if char_length(txt) not between 1 and 3000 or p_request_id is null then raise exception 'invalid_message'; end if;
  select id,data into rid,doc from public.sc_docs where collection='leads' and data->>'token'=p_token limit 1 for update;
  if rid is null then raise exception 'not_found'; end if;
  select * into msg from public.sc_order_messages where request_id=p_request_id;
  if found then
    if msg.lead_id=rid and msg.sender='client' and msg.body=txt then return jsonb_build_object('ok',true,'id',msg.seq::text); end if;
    raise exception 'invalid_message';
  end if;
  if (select count(*) from public.sc_order_messages where lead_id=rid and sender='client' and sent_at > now()-interval '15 minutes') >= 20
    or exists (select 1 from public.sc_order_messages where lead_id=rid and sender='client' and sent_at > now()-interval '2 seconds') then
    raise exception 'rate_limited';
  end if;
  insert into public.sc_order_messages(request_id,lead_id,sender,author,body)
    values(p_request_id,rid,'client','Klijent',txt) returning * into msg;
  insert into public.sc_docs(collection,id,data) values ('events','message-'||msg.seq,
    jsonb_build_object('type','order','actor','Klijent','at',(extract(epoch from msg.sent_at)*1000)::bigint,
      'leadId',rid,'text','Nova poruka klijenta uz upit: '||left(coalesce(doc->>'model',''),160)));
  return jsonb_build_object('ok',true,'id',msg.seq::text);
end $$;

create function public.sc_team_send_message(p_lead_id text, p_text text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare doc jsonb; member_name text; msg public.sc_order_messages; txt text := btrim(coalesce(p_text,''));
begin
  if not public.sc_is_member() then raise exception 'not_granted' using errcode='42501'; end if;
  select name into member_name from public.sc_members where user_id=auth.uid() and active;
  if char_length(txt) not between 1 and 3000 or p_request_id is null then raise exception 'invalid_message'; end if;
  select data into doc from public.sc_docs where collection='leads' and id=p_lead_id for update;
  if doc is null then raise exception 'not_found'; end if;
  select * into msg from public.sc_order_messages where request_id=p_request_id;
  if found then
    if msg.lead_id=p_lead_id and msg.sender='team' and msg.member_id=auth.uid() and msg.body=txt then return jsonb_build_object('ok',true,'id',msg.seq::text); end if;
    raise exception 'invalid_message';
  end if;
  insert into public.sc_order_messages(request_id,lead_id,sender,author,member_id,body)
    values(p_request_id,p_lead_id,'team',coalesce(nullif(member_name,''),'SWISCARS tim'),auth.uid(),txt) returning * into msg;
  insert into public.sc_docs(collection,id,data) values ('events','message-'||msg.seq,
    jsonb_build_object('type','order','actor',member_name,'at',(extract(epoch from msg.sent_at)*1000)::bigint,
      'leadId',p_lead_id,'text','Odgovor tima uz upit: '||left(coalesce(doc->>'model',''),160)));
  return jsonb_build_object('ok',true,'id',msg.seq::text);
end $$;

create function public.sc_team_message_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sc_is_member() then raise exception 'not_granted' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('leadId',lead_id,'count',n,'waiting',client_seq>team_seq))
    from (select lead_id,count(*) n,coalesce(max(seq) filter (where sender='client'),0) client_seq,
      coalesce(max(seq) filter (where sender='team'),0) team_seq from public.sc_order_messages group by lead_id) s),'[]'::jsonb);
end $$;

revoke all on function public.sc_order_messages(text,bigint),public.sc_order_send_message(text,text,uuid),
  public.sc_team_order_messages(text,bigint),public.sc_team_send_message(text,text,uuid),public.sc_team_message_summary()
  from public, anon, authenticated;
grant execute on function public.sc_order_messages(text,bigint),public.sc_order_send_message(text,text,uuid) to anon, authenticated;
grant execute on function public.sc_team_order_messages(text,bigint),public.sc_team_send_message(text,text,uuid),public.sc_team_message_summary() to authenticated;
