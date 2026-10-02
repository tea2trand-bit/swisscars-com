-- Round new inspection quotes to the nearest CHF 10; exact halves round upward.
-- The preview reuses the same quote so display and submitted fee agree.
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
  fee := case when km_rate between 0 and 100 and base_fee between 0 and 10000 then round((base_fee + 2 * d * km_rate) / 10) * 10 else null end;
  return jsonb_build_object('found', true, 'plz', r.plz, 'ort', r.ort, 'kanton', r.kanton, 'dist', d, 'fee', fee);
end;
$function$;

CREATE OR REPLACE FUNCTION public.sc_insp_price_preview(p_place text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q jsonb;
begin
  q := public.sc_insp_quote(left(trim(coalesce(p_place, '')), 80));
  if coalesce((q->>'found')::boolean, false) is not true then
    return jsonb_build_object('found', false);
  end if;
  if q->>'fee' is null then
    return jsonb_build_object('found', true, 'available', false);
  end if;
  return jsonb_build_object(
    'found', true, 'available', true,
    'plz', q->>'plz', 'ort', q->>'ort',
    'price', (q->>'fee')::numeric
  );
end;
$function$;
