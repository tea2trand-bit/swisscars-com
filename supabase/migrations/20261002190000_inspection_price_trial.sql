-- A separate, read-only trial quote; existing inspection tariffs remain in use.
create or replace function public.sc_insp_price_preview(p_place text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  q jsonb;
  km_rate numeric;
  base_fee numeric;
  distance numeric;
begin
  q := public.sc_insp_quote(left(trim(coalesce(p_place, '')), 80));
  if coalesce((q->>'found')::boolean, false) is not true then
    return jsonb_build_object('found', false);
  end if;
  km_rate := public.sc_set('inspKmRate', 1.5);
  base_fee := public.sc_set('inspBaseFee', 100);
  distance := (q->>'dist')::numeric;
  if km_rate < 0 or km_rate > 100 or base_fee < 0 or base_fee > 10000
     or distance is null or distance < 0 then
    return jsonb_build_object('found', true, 'available', false);
  end if;
  return jsonb_build_object(
    'found', true, 'available', true,
    'plz', q->>'plz', 'ort', q->>'ort',
    'price', round(base_fee + distance * 2 * km_rate, 2)
  );
end;
$function$;
revoke all on function public.sc_insp_price_preview(text) from public;
grant execute on function public.sc_insp_price_preview(text) to anon, authenticated, service_role;
