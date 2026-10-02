-- Preserve requirements for new website requests; existing documents are unchanged.
-- Keep the existing request validation, rate limits and tracking-token access.

CREATE OR REPLACE FUNCTION public.sc_submit_order(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t text := encode(extensions.gen_random_bytes(12), 'hex');
  nm text := left(trim(coalesce(p->>'name','')), 120);
  em text := lower(left(trim(coalesce(p->>'email','')), 160));
  ph text := left(trim(coalesce(p->>'phone','')), 60);
  md text := left(trim(coalesce(p->>'model','')), 160);
  nt text := left(trim(coalesce(p->>'notes','')), 1500);
  bud numeric := nullif(regexp_replace(coalesce(p->>'budget',''), '[^0-9]', '', 'g'), '')::numeric;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  lg text := case when p->>'lang' in ('sr','de','en') then p->>'lang' else 'sr' end;
begin
  if coalesce(p->>'website','') <> '' then return jsonb_build_object('ok', true); end if;
  if nm = '' or (em = '' and ph = '') or (md = '' and nt = '') then raise exception 'missing'; end if;
  if em <> '' and em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'email'; end if;
  if (select count(*) from public.sc_docs where collection = 'leads' and data->>'source' = 'web' and created_at > now() - interval '10 minutes') > 20 then raise exception 'busy'; end if;
  if em <> '' and (select count(*) from public.sc_docs where collection = 'leads' and data->>'email' = em and created_at > now() - interval '1 hour') >= 3 then raise exception 'busy'; end if;
  insert into public.sc_docs (collection, id, data) values ('leads', 'web-' || left(t, 12), jsonb_build_object(
    'source','web','token',t,'name',nm,'email',em,'phone',ph,'model',coalesce(nullif(md,''),'(vidi napomenu)'),'budget',bud,
    'mileage',left(coalesce(p->>'mileage',''),40),'gearbox',left(coalesce(p->>'gearbox',''),40),'brand',left(trim(coalesce(p->>'brand','')),80),
    'yearFrom',case when coalesce(p->>'yearFrom','') ~ '^[0-9]{4}$' then (p->>'yearFrom')::integer else null end,
    'fuel',left(trim(coalesce(p->>'fuel','')),40),'body',left(trim(coalesce(p->>'body','')),40),
    'drive',left(trim(coalesce(p->>'drive','')),40),'color',left(trim(coalesce(p->>'color','')),80),
    'when',left(trim(coalesce(p->>'when','')),80),'city',left(trim(coalesce(p->>'city','')),120),
    'equip',coalesce((select jsonb_agg(left(entry,80)) from (
      select value as entry from jsonb_array_elements_text(
        case when jsonb_typeof(p->'equip')='array' then p->'equip' else '[]'::jsonb end
      ) limit 30
    ) equipment),'[]'::jsonb),
    'note',nt,'where','Sajt',
    'contact',concat_ws(' · ', nullif(nm,''), nullif(ph,''), nullif(em,'')),'status','novo','payer','Sajt','lang',lg,
    'created',now_ms,'proposals','[]'::jsonb));
  insert into public.sc_docs (collection, id, data) values ('events', 'web-ev-' || left(t, 12), jsonb_build_object(
    'type','order','actor','Sajt','at',now_ms,'carId',null,
    'text','Novi upit sa sajta: ' || coalesce(nullif(md,''),'(vidi napomenu)') || coalesce(', budžet ' || bud::text || ' €', '') || ' (' || nm || ')'));
  return jsonb_build_object('ok', true, 'token', t);
end $function$;

CREATE OR REPLACE FUNCTION public.sc_order_view(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l jsonb; c jsonb; props jsonb; rate numeric := public.sc_set('rate',1.057);
begin
  if coalesce(p_token,'') !~ '^[a-f0-9]{24}$' then return null; end if;
  select data into l from public.sc_docs where collection = 'leads' and data->>'token' = p_token limit 1;
  if l is null then return null; end if;
  if coalesce(l->>'carId','') <> '' then select data into c from public.sc_docs where collection = 'cars' and id = l->>'carId'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','title',x->>'title','year',x->'year','km',x->'km','gear',x->'gear','fuel',x->'fuel',
           'price',x->'price','note',x->>'note','at',x->'at',
           'answer', case when x->>'answer' = 'da' then 'zanima' else x->>'answer' end,
           'photos',coalesce(x->'photos','[]'::jsonb),'adNote',x->>'adNote','photosAt',x->'photosAt',
           'url',x->>'url','place',x->>'place','dist',x->'dist','inspFee',x->'inspFee','adChf',x->'adChf','commission',x->'commission',
           'depositPct',x->'depositPct','avail',x->>'avail','availAt',x->'availAt','deposit',x->'deposit','depositPaidAt',x->'depositPaidAt','depositRefundAt',x->'depositRefundAt',
           'refundEur', case when (x->>'deposit') is not null then greatest(0, (x->>'deposit')::numeric - round(coalesce((x->>'inspFee')::numeric,0)*rate)) end,
           'insp',x->>'insp','inspNote',x->>'inspNote','inspAt',x->'inspAt','inspPhotos',coalesce(x->'inspPhotos','[]'::jsonb),'choice',x->>'choice') order by (x->>'at')::bigint), '[]'::jsonb)
    into props from jsonb_array_elements(coalesce(l->'proposals','[]'::jsonb)) x;
  return jsonb_build_object('name',split_part(coalesce(l->>'name',''),' ',1),'model',l->>'model','budget',l->'budget','mileage',l->>'mileage',
    'gearbox',l->>'gearbox','yearFrom',l->'yearFrom','fuel',l->>'fuel','body',l->>'body','drive',l->>'drive','equip',coalesce(l->'equip','[]'::jsonb),
    'brand',l->>'brand','color',l->>'color','when',l->>'when','city',l->>'city','note',l->>'note',
    'created',l->'created','status',l->>'status','lang',l->>'lang','proposals',props,
    'aiAt',l->'aiCheckedAt','aiN',l->'aiFound',
    'depositPct', public.sc_set('depositPct',10), 'commission', public.sc_set('provizija',1000), 'fee50', public.sc_set('pregled50',100), 'fee100', public.sc_set('pregled100',200),
    'pay', nullif((select data->>'payInfo' from public.sc_docs where collection='settings' and id='main'),''),
    'car', case when c is null then null else jsonb_build_object('model',c->>'model','year',c->'year','km',c->'km','fuel',c->'fuel','gear',c->'gear',
      'kw',c->'kw','color',c->'color','status',c->>'status','photos',coalesce(c->'photos','[]'::jsonb),'equip',coalesce(c->'equip','[]'::jsonb),
      'price',coalesce(l->'agreedPrice',c->'askEur')) end);
end $function$;

