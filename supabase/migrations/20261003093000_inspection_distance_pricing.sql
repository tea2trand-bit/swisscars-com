-- Approved pricing for newly submitted inspections and newly created proposals.
-- Existing inspection documents and proposals keep their stored fees.
CREATE OR REPLACE FUNCTION public.sc_insp_quote(p_place text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; d int; fee numeric; km_rate numeric := public.sc_set('inspKmRate',1.5); base_fee numeric := public.sc_set('inspBaseFee',100);
begin
  select * into r from public.sc_place(left(coalesce(p_place,''),80));
  if r.plz is null then return jsonb_build_object('found', false); end if;
  d := round(1.25 * 6371 * 2 * asin(sqrt(power(sin(radians(r.lat - 47.4239) / 2), 2)
        + cos(radians(47.4239)) * cos(radians(r.lat)) * power(sin(radians(r.lon - 9.3748) / 2), 2))))::int;
  fee := case when km_rate between 0 and 100 and base_fee between 0 and 10000 then round(base_fee + 2 * d * km_rate,2) else null end;
  return jsonb_build_object('found', true, 'plz', r.plz, 'ort', r.ort, 'kanton', r.kanton, 'dist', d, 'fee', fee);
end;
$function$;

CREATE OR REPLACE FUNCTION public.sc_submit_inspection(p jsonb)
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
  url text := left(trim(coalesce(p->>'url','')), 500);
  car text := left(trim(coalesce(p->>'car','')), 160);
  pl text := left(trim(coalesce(p->>'place','')), 80);
  nt text := left(trim(coalesce(p->>'notes','')), 1500);
  lg text := case when p->>'lang' in ('sr','de','en') then p->>'lang' else 'sr' end;
  q jsonb; now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if coalesce(p->>'website','') <> '' then return jsonb_build_object('ok', true); end if;
  if nm = '' or (em = '' and ph = '') or pl = '' or (url = '' and car = '') then raise exception 'missing'; end if;
  if url <> '' and url !~* '^https?://' then raise exception 'url'; end if;
  if em <> '' and em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'email'; end if;
  if (select count(*) from public.sc_docs where collection = 'inspections' and created_at > now() - interval '10 minutes') > 15 then raise exception 'busy'; end if;
  q := public.sc_insp_quote(pl);
  if coalesce((q->>'found')::boolean,false) is not true then raise exception 'place_not_found'; end if;
  if q->>'fee' is null then raise exception 'quote_unavailable'; end if;
  if coalesce(p->>'expectedFee','') !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'price_changed'; end if;
  if (p->>'expectedFee')::numeric is distinct from (q->>'fee')::numeric then raise exception 'price_changed'; end if;
  insert into public.sc_docs (collection, id, data) values ('inspections', 'pg-' || left(t, 12), jsonb_build_object(
    'token', t, 'name', nm, 'email', em, 'phone', ph, 'url', url, 'car', car, 'place', pl,
    'plz', q->>'plz', 'ort', q->>'ort', 'kanton', q->>'kanton', 'dist', q->'dist', 'fee', q->'fee',
    'inspectionPricing', jsonb_build_object('kmRate',public.sc_set('inspKmRate',1.5),'baseFee',public.sc_set('inspBaseFee',100),'version','per-km-v1'),
    'note', nt, 'lang', lg, 'status', 'novo', 'created', now_ms));
  insert into public.sc_docs (collection, id, data) values ('events', 'pg-ev-' || left(t, 12), jsonb_build_object(
    'type','order','actor','Sajt','at',now_ms,'carId',null,
    'text','Nova narudžbina pregleda: ' || coalesce(nullif(car,''), url) || ' · ' || coalesce(q->>'ort', pl) ||
           coalesce(' (~' || (q->>'dist') || ' km, ' || (q->>'fee') || ' CHF)', ' (cena po dogovoru)') || ' — ' || nm));
  return jsonb_build_object('ok', true, 'token', t, 'fee', q->'fee', 'dist', q->'dist', 'ort', q->>'ort');
end;
$function$;

CREATE OR REPLACE FUNCTION public.sc_make_proposal(p_find text, p_lead text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f jsonb; l jsonb; q jsonb; dist int; fee numeric; car numeric; est numeric; fuel text; pct int; now_ms bigint := (extract(epoch from now())*1000)::bigint;
begin
  select data into f from public.sc_docs where collection='finds' and id=p_find;
  select data into l from public.sc_docs where collection='leads' and id=p_lead;
  if f is null then return null; end if;
  q := public.sc_insp_quote(f->>'place');
  dist := (q->>'dist')::int; fee := (q->>'fee')::numeric;
  car := coalesce((f->>'priceChf')::numeric,0) * public.sc_set('rate',1.057);
  est := car + public.sc_set('prevoz',500) + public.sc_set('izvoz',100) + public.sc_set('eko',155)
         + (car + public.sc_set('prevoz',500)) * public.sc_set('pdv',20)/100 + public.sc_set('provizija',1000)*public.sc_set('rate',1.057);
  fuel := nullif(nullif(l->>'fuel',''),'Svejedno');
  pct := coalesce(public.sc_lead_finance_pct(p_find), 50);
  return jsonb_build_object('id','p-'||p_find,'findId',p_find,'title',coalesce(f->>'title',f->>'model'),'year',f->'year','km',f->'km','gear',f->'gear',
    'fuel',coalesce(fuel,'Dizel'),'url',f->>'url','place',f->>'place','dist',dist,'inspFee',fee,'adChf',f->'priceChf',
    'commission',public.sc_set('provizija',1000),'price',ceil(est/50)*50,'depositPct',pct,'note','','at',now_ms,'by','Asistent','answer',null,'photos','[]'::jsonb);
end;
$function$;
