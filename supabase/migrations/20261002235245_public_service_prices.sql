-- Public projection of advertised service price and import-calculator assumptions.
-- Do not expose capital, reserve, margins, payment information or team settings.
create or replace function public.sc_public_service_prices()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'swissPackageCHF', greatest(0, least(100000, public.sc_set('swissPackageFee',900))),
    'importDefaults', jsonb_build_object(
      'rate', greatest(0.01, least(10, public.sc_set('rate',1.057))),
      'transport', greatest(0, least(100000, public.sc_set('prevoz',500))),
      'export', greatest(0, least(100000, public.sc_set('izvoz',100))),
      'eco', greatest(0, least(100000, public.sc_set('eko',155)))
    )
  );
$function$;
revoke all on function public.sc_public_service_prices() from public;
grant execute on function public.sc_public_service_prices() to anon, authenticated, service_role;

-- Initialize only the new field. Preserve every other existing setting.
update public.sc_docs
set data = jsonb_set(data,'{swissPackageFee}','900'::jsonb,true)
where collection='settings' and id='main' and not (data ? 'swissPackageFee');
