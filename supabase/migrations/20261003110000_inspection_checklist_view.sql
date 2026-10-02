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
           'insp',x->>'insp','inspChecklist',x->'inspChecklist','inspNote',x->>'inspNote','inspAt',x->'inspAt','inspPhotos',coalesce(x->'inspPhotos','[]'::jsonb),'choice',x->>'choice') order by (x->>'at')::bigint), '[]'::jsonb)
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
