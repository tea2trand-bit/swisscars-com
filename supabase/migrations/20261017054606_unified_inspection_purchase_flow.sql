CREATE OR REPLACE FUNCTION public.sc_customer_inspection_completed(p jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
begin
 if p is null or coalesce(p->>'inspAt','') !~ '^[0-9]+([.][0-9]+)?$' then return false; end if;
 if (p->>'inspAt')::numeric<=0 then return false; end if;
 if p->>'inspectionReviewed'='false' or p->>'insp'='ne' or p->'inspChecklist'->>'overall'='ne'
 or p->>'avail'='ne' or p->>'answer'='ne' then return false; end if;
 if not coalesce(p->>'insp' in ('ok','da','oprez') or p->'inspChecklist'->>'overall' in ('da','oprez'),false) then return false; end if;
 if (p->'quoteCalculation'->>'version'='1' or p->>'serviceFlow'='inspection-first') and p->>'inspectionPaid' is distinct from 'true' then return false; end if;
 return true;
end $function$;

-- Token-scoped client actions. They never mark a deposit received or create a purchased car.
create or replace function sc_private.release_amount(v text) returns numeric
language sql immutable set search_path='' as $$
 select case when v ~ '^[0-9]+([.][0-9]+)?$' then v::numeric else null end;
$$;

create or replace function sc_private.package_offer(l jsonb, p jsonb, configured numeric)
returns jsonb language plpgsql immutable set search_path='' as $$
declare price numeric; paid numeric:=0;
begin
 price:=case when p->>'serviceMode'='package' then sc_private.release_amount(p->>'packageChf') end;
 price:=coalesce(price,sc_private.release_amount(l#>>'{listingQuote,result,packageChf}'),sc_private.release_amount(p->>'commission'),configured);
 if price is null or price<=0 then return null; end if;
 if p->>'inspectionPaid'='true' and coalesce(p->>'inspectionPaymentCurrency','CHF')='CHF' then
  paid:=least(price,coalesce(sc_private.release_amount(p->>'inspectionPaymentAmount'),sc_private.release_amount(p->>'inspFee'),0));
 end if;
 return jsonb_build_object('packageChf',price,'inspectionCreditChf',paid,'remainingChf',round(price-paid,2));
end $$;

create or replace function sc_private.deposit_plan(l jsonb,p jsonb,configured numeric)
returns jsonb language plpgsql immutable set search_path='' as $$
declare base numeric; pct numeric; amount numeric;
begin
 if sc_private.release_amount(p#>>'{depositNoticeQuote,amount}')>0 then return p->'depositNoticeQuote'; end if;
 base:=coalesce(sc_private.release_amount(l#>>'{listingQuote,result,total}'),sc_private.release_amount(p#>>'{quoteCalculation,totalEur}'),sc_private.release_amount(p->>'price'));
 pct:=coalesce(sc_private.release_amount(p->>'depositPct'),configured,10);
 amount:=sc_private.release_amount(p->>'deposit');
 if amount>0 then return jsonb_build_object('base',base,'percent',pct,'amount',amount,'currency','EUR','fixed',true); end if;
 if base is null or base<=0 or pct<=0 or pct>100 then return null; end if;
 return jsonb_build_object('base',base,'percent',pct,'amount',ceil(base*pct/1000)*10,'currency','EUR','rounding',10);
end $$;

create or replace function public.sc_order_choose_package(p_token text,p_id text,p_expected_price numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid text; l jsonb; p jsonb; offer jsonb; patch jsonb; arr jsonb; now_ms bigint:=(extract(epoch from now())*1000)::bigint;
begin
 if coalesce(p_token,'') !~ '^[a-f0-9]{24}$' then return jsonb_build_object('ok',false,'reason','not_found'); end if;
 select id,data into rid,l from public.sc_docs where collection='leads' and data->>'token'=p_token limit 1 for update;
 if l is null or l->>'status' in ('arhiva','odustao','otkazano','predato','kupljeno','kupio') or nullif(l->>'carId','') is not null then return jsonb_build_object('ok',false,'reason','request_closed'); end if;
 select value into p from jsonb_array_elements(coalesce(l->'proposals','[]'::jsonb)) where value->>'id'=p_id;
 if p is null or (p->>'serviceFlow' is distinct from 'inspection-first' and p#>>'{quoteCalculation,version}' is distinct from '1') or p->>'inspectionPaid' is distinct from 'true' or p->>'avail' is distinct from 'da' or not public.sc_customer_inspection_completed(p) or not public.sc_proposal_available(p,rid) then return jsonb_build_object('ok',false,'reason','inspection_not_complete'); end if;
 if coalesce(p->>'choice','') not in ('','buy') then return jsonb_build_object('ok',false,'reason','decision_already_saved'); end if;
 offer:=sc_private.package_offer(l,p,public.sc_set('provizija',700));
 if offer is null then return jsonb_build_object('ok',false,'reason','price_missing'); end if;
 if p->>'serviceMode'='package' and p->>'serviceSelectedBy'='client' then return jsonb_build_object('ok',true,'duplicate',true,'view',p||jsonb_build_object('packageOffer',offer)); end if;
 if p_expected_price is distinct from (offer->>'packageChf')::numeric then return jsonb_build_object('ok',false,'reason','price_changed','offer',offer); end if;
 patch:=jsonb_build_object('choice','buy','choiceAt',coalesce(p->'choiceAt',to_jsonb(now_ms)),'serviceMode','package','serviceSelectedBy','client','serviceSelectedAt',now_ms,'packageChf',offer->'packageChf');
 select jsonb_agg(case when value->>'id'=p_id then value||patch else value end order by ord) into arr from jsonb_array_elements(l->'proposals') with ordinality a(value,ord);
 update public.sc_docs set data=data||jsonb_build_object('proposals',arr) where collection='leads' and id=rid;
 return jsonb_build_object('ok',true,'view',p||patch||jsonb_build_object('packageOffer',offer));
end $$;
revoke all on function public.sc_order_choose_package(text,text,numeric) from public;
grant execute on function public.sc_order_choose_package(text,text,numeric) to anon,authenticated,service_role;

create or replace function public.sc_inspection_choose_package(p_token text,p_expected_price numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid text; d jsonb; price numeric; paid numeric:=0; offer jsonb; patch jsonb; now_ms bigint:=(extract(epoch from now())*1000)::bigint;
begin
 if coalesce(p_token,'') !~ '^[a-f0-9]{24}$' then return jsonb_build_object('ok',false,'reason','not_found'); end if;
 select id,data into rid,d from public.sc_docs where collection='inspections' and data->>'token'=p_token limit 1 for update;
 if d is null or d->>'status'='otkazano' then return jsonb_build_object('ok',false,'reason','request_closed'); end if;
 price:=case when d->>'serviceMode'='package' then sc_private.release_amount(d->>'packageChf') end;
 price:=coalesce(price,public.sc_set('provizija',700));
 if price<=0 then return jsonb_build_object('ok',false,'reason','price_missing'); end if;
 if public.sc_positive_stage_stamp(d,'paidAt') then paid:=least(price,coalesce(sc_private.release_amount(d->>'paymentAmount'),sc_private.release_amount(d->>'fee'),0)); end if;
 offer:=jsonb_build_object('packageChf',price,'inspectionCreditChf',paid,'remainingChf',round(price-paid,2));
 if d->>'serviceMode'='package' and d->>'serviceSelectedBy'='client' then return jsonb_build_object('ok',true,'duplicate',true,'view',public.sc_inspection_view(p_token)); end if;
 if p_expected_price is distinct from price then return jsonb_build_object('ok',false,'reason','price_changed','offer',offer); end if;
 patch:=jsonb_build_object('serviceMode','package','serviceSelectedBy','client','serviceSelectedAt',now_ms,'packageChf',price);
 update public.sc_docs set data=data||patch where collection='inspections' and id=rid;
 return jsonb_build_object('ok',true,'view',public.sc_inspection_view(p_token));
end $$;
revoke all on function public.sc_inspection_choose_package(text,numeric) from public;
grant execute on function public.sc_inspection_choose_package(text,numeric) to anon,authenticated,service_role;

create or replace function public.sc_order_deposit_notice(p_token text,p_id text,p_expected_amount numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid text; l jsonb; p jsonb; plan jsonb; patch jsonb; arr jsonb; now_ms bigint:=(extract(epoch from now())*1000)::bigint;
begin
 if coalesce(p_token,'') !~ '^[a-f0-9]{24}$' then return jsonb_build_object('ok',false,'reason','not_found'); end if;
 select id,data into rid,l from public.sc_docs where collection='leads' and data->>'token'=p_token limit 1 for update;
 if l is null or l->>'status' in ('arhiva','odustao','otkazano','predato','kupljeno','kupio') or nullif(l->>'carId','') is not null then return jsonb_build_object('ok',false,'reason','request_closed'); end if;
 select value into p from jsonb_array_elements(coalesce(l->'proposals','[]'::jsonb)) where value->>'id'=p_id;
 if p is null or p->>'choice' is distinct from 'buy' or p->>'serviceMode' is distinct from 'package' or p->>'inspectionPaid' is distinct from 'true' or not public.sc_customer_inspection_completed(p) or not public.sc_proposal_available(p,rid) or public.sc_positive_stage_stamp(p,'depositPaidAt') or public.sc_positive_stage_stamp(p,'depositRefundAt') then return jsonb_build_object('ok',false,'reason','deposit_not_open'); end if;
 if public.sc_positive_stage_stamp(p,'depositReportedAt') then return jsonb_build_object('ok',true,'duplicate',true); end if;
 plan:=sc_private.deposit_plan(l,p,public.sc_set('depositPct',10));
 if plan is null or (plan->>'amount')::numeric<=0 then return jsonb_build_object('ok',false,'reason','amount_missing'); end if;
 if p_expected_amount is distinct from (plan->>'amount')::numeric then return jsonb_build_object('ok',false,'reason','amount_changed','plan',plan); end if;
 patch:=jsonb_build_object('depositReportedAt',now_ms,'depositReportedBy','client','depositNoticeQuote',plan);
 select jsonb_agg(case when value->>'id'=p_id then value||patch else value end order by ord) into arr from jsonb_array_elements(l->'proposals') with ordinality a(value,ord);
 update public.sc_docs set data=data||jsonb_build_object('proposals',arr) where collection='leads' and id=rid;
 return jsonb_build_object('ok',true,'plan',plan);
end $$;
revoke all on function public.sc_order_deposit_notice(text,text,numeric) from public;
grant execute on function public.sc_order_deposit_notice(text,text,numeric) to anon,authenticated,service_role;

create or replace function public.sc_team_listing_outcome(p_lead_id text,p_outcome text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l jsonb; patch jsonb; now_ms bigint:=(extract(epoch from now())*1000)::bigint; message text;
begin
 if not public.sc_is_member() then raise exception 'not_granted' using errcode='42501'; end if;
 if p_request_id is null or p_outcome not in ('available','inactive') then return jsonb_build_object('ok',false,'reason','invalid_outcome'); end if;
 select data into l from public.sc_docs where collection='leads' and id=p_lead_id for update;
 if l is null or nullif(l->>'carId','') is not null or jsonb_array_length(coalesce(l->'proposals','[]'::jsonb))>0 then return jsonb_build_object('ok',false,'reason','vehicle_already_in_progress'); end if;
 if l->>'status'='arhiva' then return jsonb_build_object('ok',l#>>'{listingCheck,status}'=p_outcome,'duplicate',true,'patch','{}'::jsonb); end if;
 if l->>'status' in ('odustao','otkazano') then return jsonb_build_object('ok',false,'reason','request_closed'); end if;
 if l#>>'{listingCheck,requestId}'=p_request_id::text then return jsonb_build_object('ok',l#>>'{listingCheck,status}'=p_outcome,'duplicate',true,'patch','{}'::jsonb); end if;
 patch:=jsonb_build_object('listingCheck',jsonb_build_object('status',p_outcome,'at',now_ms,'by',auth.uid(),'requestId',p_request_id),'statusChangedAt',now_ms);
 if p_outcome='inactive' then
  patch:=patch||jsonb_build_object('status','arhiva','archivedAt',now_ms,'archiveReason','listing_unavailable');
  message:=case l->>'lang' when 'de' then 'Inserat nicht verfügbar, bitte senden Sie eine neue Anfrage.' when 'en' then 'Listing unavailable, please send a new request.' else 'Oglas nije dostupan, pošaljite novi upit.' end;
  perform public.sc_team_send_message(p_lead_id,message,p_request_id);
 end if;
 update public.sc_docs set data=data||patch where collection='leads' and id=p_lead_id;
 return jsonb_build_object('ok',true,'patch',patch,'messageSaved',p_outcome='inactive');
end $$;
revoke all on function public.sc_team_listing_outcome(text,text,uuid) from public,anon;
grant execute on function public.sc_team_listing_outcome(text,text,uuid) to authenticated,service_role;

create or replace function public.sc_order_new_listing(p_token text,p_url text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid text; l jsonb; existing_token text; result jsonb; new_token text; now_ms bigint:=(extract(epoch from now())*1000)::bigint;
begin
 if coalesce(p_token,'') !~ '^[a-f0-9]{24}$' or p_request_id is null or char_length(coalesce(p_url,''))>2048 or p_url !~ '^https?://[^[:space:]]+$' then return jsonb_build_object('ok',false,'reason','invalid_url'); end if;
 select id,data into rid,l from public.sc_docs where collection='leads' and data->>'token'=p_token limit 1 for update;
 if l is null or l->>'status' is distinct from 'arhiva' or l->>'archiveReason' is distinct from 'listing_unavailable' then return jsonb_build_object('ok',false,'reason','request_not_archived'); end if;
 select data->>'token' into existing_token from public.sc_docs where collection='leads' and data->>'parentInquiry'=rid and data->>'replacementRequestId'=p_request_id::text limit 1;
 if existing_token is not null then return jsonb_build_object('ok',true,'duplicate',true,'token',existing_token); end if;
 result:=public.sc_submit_order(jsonb_build_object('name',l->>'name','email',l->>'email','phone',l->>'phone','city',l->>'city','lang',l->>'lang','budget',l->'budget','model','Auto iz oglasa','notes','Upit za pomoć pri kupovini izabranog auta. Oglas: '||p_url));
 new_token:=result->>'token'; if result->>'ok' is distinct from 'true' or new_token is null then return result; end if;
 update public.sc_docs set data=data||jsonb_build_object('listingUrl',p_url,'parentInquiry',rid,'replacementRequestId',p_request_id) where collection='leads' and data->>'token'=new_token;
 return result;
end $$;
revoke all on function public.sc_order_new_listing(text,text,uuid) from public;
grant execute on function public.sc_order_new_listing(text,text,uuid) to anon,authenticated,service_role;

create or replace function public.sc_reservation_request(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; result jsonb; ref text:=left(coalesce(p->>'ref',''),120);
begin
 if coalesce(p->>'website','')<>'' then return jsonb_build_object('ok',true); end if;
 select data into c from public.sc_docs where collection='cars' and id=ref and data->>'status' in ('kupljen','transport','carinjen','garaza','prodaja') limit 1;
 if c is null or c->>'demo'='true' then return jsonb_build_object('ok',false,'reason','car_unavailable'); end if;
 result:=public.sc_submit_order(p||jsonb_build_object('model',c->>'model','budget',coalesce(c->'askEur',c->'price'),'notes','Zahtev za rezervaciju vozila iz SWISCARS ponude. Referenca: '||ref||'. Kapara i uslovi se dogovaraju pre uplate.'));
 if result->>'ok'='true' and result->>'token' is not null then update public.sc_docs set data=data||jsonb_build_object('reservationRequest',true,'requestedCarRef',ref) where collection='leads' and data->>'token'=result->>'token'; end if;
 return result;
end $$;
revoke all on function public.sc_reservation_request(jsonb) from public;
grant execute on function public.sc_reservation_request(jsonb) to anon,authenticated,service_role;

revoke all on function sc_private.release_amount(text) from public,anon,authenticated;
revoke all on function sc_private.package_offer(jsonb,jsonb,numeric) from public,anon,authenticated;
revoke all on function sc_private.deposit_plan(jsonb,jsonb,numeric) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sc_order_view(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rid text; l jsonb; c jsonb; props jsonb; rate numeric := public.sc_set('rate',1.057);
begin
 if coalesce(p_token,'') !~ '^[a-f0-9]{24}$' then return null; end if;
 select id,data into rid,l from public.sc_docs where collection = 'leads' and data->>'token' = p_token limit 1;
 if l is null then return null; end if;
 if coalesce(l->>'carId','') <> '' then select data into c from public.sc_docs where collection = 'cars' and id = l->>'carId'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','title',x->>'title','year',x->'year','km',x->'km','gear',x->'gear','fuel',x->'fuel',
 'price',x->'price','note',x->>'note','at',x->'at','favorite',x->'favorite','favoriteAt',x->'favoriteAt','unavailableReason',x->>'unavailableReason',
 'answer', case when x->>'answer' = 'da' then 'zanima' else x->>'answer' end,
 'photos',coalesce(x->'photos','[]'::jsonb),'adNote',x->>'adNote','photosAt',x->'photosAt',
 'plannedAt',x->>'plannedAt','url',x->>'url','place',x->>'place','dist',x->'dist','inspFee',x->'inspFee','inspectionPaid',x->'inspectionPaid','inspectionPaidAt',x->'inspectionPaidAt','inspectionScheduled',x->'inspectionScheduled','inspectionReviewed',x->'inspectionReviewed','inspectionPaymentAmount',x->'inspectionPaymentAmount','quoteCalculation',x->'quoteCalculation','adChf',x->'adChf','commission',x->'commission',
 'depositPct',x->'depositPct','avail',case
 when nullif(l->>'carId','') is not null and exists(select 1 from public.sc_docs own_car where own_car.collection='cars'
 and own_car.id=l->>'carId' and own_car.data->>'orderId'=rid
 and ((nullif(x->>'findId','') is not null and own_car.data->>'fromFind'=x->>'findId') or x->>'carId'=own_car.id)
 and (x->>'answer' in ('zelim','da','zanima') or x->>'choice'='buy' or x->>'inspectionPaid'='true' or nullif(x->>'depositPaidAt','') is not null)) then x->>'avail'
 when public.sc_proposal_is_unavailable(x,rid) then 'ne' else x->>'avail' end,'availAt',x->'availAt','deposit',x->'deposit','depositPaidAt',x->'depositPaidAt','depositRefundAt',x->'depositRefundAt',
 'refundEur', case when (x->>'deposit') is not null then greatest(0, (x->>'deposit')::numeric - round(coalesce((x->>'inspFee')::numeric,0)*rate)) end,
 'insp',x->>'insp','inspChecklist',x->'inspChecklist','inspNote',x->>'inspNote','inspAt',x->'inspAt','inspPhotos',coalesce(x->'inspPhotos','[]'::jsonb),'choice',x->>'choice') || jsonb_build_object('answeredAt',x->'answeredAt','choiceAt',x->'choiceAt','changeDates',x->'changeDates','chVatRefundVerified',x->'chVatRefundVerified','originProofVerified',x->'originProofVerified','checksUpdatedAt',x->'checksUpdatedAt','serviceFlow',x->'serviceFlow','serviceMode',x->'serviceMode','serviceSelectedBy',x->'serviceSelectedBy','serviceSelectedAt',x->'serviceSelectedAt','packageChf',x->'packageChf','inspectionPaymentCurrency',x->'inspectionPaymentCurrency','depositReportedAt',x->'depositReportedAt','depositReportedBy',x->'depositReportedBy','depositNoticeQuote',x->'depositNoticeQuote','packageOffer',sc_private.package_offer(l,x,public.sc_set('provizija',700)),'depositPlan',sc_private.deposit_plan(l,x,public.sc_set('depositPct',10))) order by (x->>'at')::bigint), '[]'::jsonb)
 into props from jsonb_array_elements(coalesce(l->'proposals','[]'::jsonb)) x;
 return jsonb_build_object('name',split_part(coalesce(l->>'name',''),' ',1),'model',l->>'model','budget',l->'budget','mileage',l->>'mileage',
 'gearbox',l->>'gearbox','yearFrom',l->'yearFrom','fuel',l->>'fuel','body',l->>'body','drive',l->>'drive','equip',coalesce(l->'equip','[]'::jsonb),
 'brand',l->>'brand','color',l->>'color','when',l->>'when','city',l->>'city','note',l->>'note',
 'listingUrl',l->>'listingUrl','listingCheck',l->'listingCheck','listingReview',l->'listingReview','listingVehicle',l->'listingVehicle','listingQuote',l->'listingQuote','archiveReason',l->>'archiveReason','created',l->'created','statusDates',l->'statusDates','statusChangedAt',l->'statusChangedAt','status',l->>'status','lang',l->>'lang','proposals',props,
 'quoteSettings',jsonb_build_object('version',1,'transport',public.sc_set('prevoz',500),'export',public.sc_set('izvoz',0),'eco',public.sc_set('eko',155),'serviceChf',coalesce(nullif(l->'commission','null'::jsonb),to_jsonb(public.sc_set('provizija',700)))),
 'routeCounts',sc_private.route_counts(),'aiAt',l->'aiCheckedAt','aiN',l->'aiFound',
 'depositPct', public.sc_set('depositPct',10), 'commission', public.sc_set('provizija',1000), 'fee50', public.sc_set('pregled50',100), 'fee100', public.sc_set('pregled100',200),
 'pay', nullif((select data->>'payInfo' from public.sc_docs where collection='settings' and id='main'),''),
 'car', case when c is null then null else jsonb_build_object('model',c->>'model','year',c->'year','km',c->'km','fuel',c->'fuel','gear',c->'gear',
 'kw',c->'kw','color',c->'color','status',c->>'status','photos',coalesce(c->'photos','[]'::jsonb),'equip',coalesce(c->'equip','[]'::jsonb),
 'price',coalesce(l->'agreedPrice',c->'askEur'),'statusDates',c->'statusDates','statusChangedAt',c->'statusChangedAt','boughtDate',c->'boughtDate','soldDate',c->'soldDate') end);
end $function$;

CREATE OR REPLACE FUNCTION public.sc_inspection_view(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d jsonb;
begin
 if coalesce(p_token,'') !~ '^[a-f0-9]{24}$' then return null; end if;
 select data into d from public.sc_docs where collection = 'inspections' and data->>'token' = p_token limit 1;
 if d is null then return null; end if;
 return jsonb_build_object('name', split_part(coalesce(d->>'name',''),' ',1), 'url', d->>'url', 'car', d->>'car', 'place', d->>'place',
 'ort', d->>'ort', 'dist', d->'dist', 'fee', d->'fee', 'status', d->>'status', 'created', d->'created', 'lang', d->>'lang',
 'paidAt', d->'paidAt', 'plannedAt', d->>'plannedAt', 'reportAt', d->'reportAt', 'report', d->'report',
 'photos', coalesce(d->'photos','[]'::jsonb),
 'plz',d->>'plz','paymentAmount',d->'paymentAmount','serviceMode',d->>'serviceMode','serviceSelectedBy',d->>'serviceSelectedBy','serviceSelectedAt',d->'serviceSelectedAt','packageChf',d->'packageChf','packageOffer',sc_private.package_offer(jsonb_build_object('listingQuote',jsonb_build_object('result',jsonb_build_object('packageChf',public.sc_set('provizija',700)))),d||jsonb_build_object('inspectionPaid',public.sc_positive_stage_stamp(d,'paidAt'),'inspectionPaymentAmount',coalesce(d->'paymentAmount',d->'fee')),public.sc_set('provizija',700)),'pay', nullif((select data->>'payInfo' from public.sc_docs where collection='settings' and id='main'),''));
end $function$;

CREATE OR REPLACE FUNCTION public.sc_order_answer(p_token text, p_id text, p_answer text, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rid text; l jsonb; x jsonb; newarr jsonb := '[]'::jsonb; hit boolean := false; ttl text; a text := p_answer; fid text;
 dep numeric; prev text; msg text; inspection_first boolean:=false; now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
 if a = 'da' then a := 'zelim'; end if;
 if coalesce(p_token,'') !~ '^[a-f0-9]{24}$' or a not in ('zelim','ne','kupujem','nekupujem','refund','continue') then raise exception 'bad'; end if;
 select id, data into rid, l from public.sc_docs where collection = 'leads' and data->>'token' = p_token limit 1 for update;
 if rid is null or coalesce(l->>'status','') in ('odustao','predato','kupio','kupljeno') or nullif(l->>'carId','') is not null then raise exception 'bad'; end if;
 if a='zelim' and exists(
 select 1 from jsonb_array_elements(coalesce(l->'proposals','[]'::jsonb)) other
 where other->>'id' is distinct from p_id
 and coalesce(other->>'answer','')<>'ne' and coalesce(other->>'avail','')<>'ne'
 and coalesce(other->>'choice','') not in ('refund','continue') and nullif(other->>'depositRefundAt','') is null
 and (other->>'answer' in ('zelim','da','zanima') or other->>'choice'='buy'
 or other->>'inspectionPaid'='true' or nullif(other->>'depositPaidAt','') is not null)
 ) then raise exception 'bad'; end if;
 for x in select value from jsonb_array_elements(coalesce(l->'proposals','[]'::jsonb)) loop
 if x->>'id' = p_id then
 hit := true; ttl := x->>'title'; fid := x->>'findId'; prev := coalesce(x->>'answer',''); inspection_first:=x->'quoteCalculation'->>'version'='1';
 if a in ('zelim','kupujem') and not public.sc_proposal_available(x,rid) then raise exception 'unavailable'; end if;
 if a = 'ne' then
 if prev = 'zelim' or coalesce(x->>'depositPaidAt','') <> '' then raise exception 'bad'; end if;
 x := x || jsonb_build_object('answer','ne','answerNote',left(coalesce(p_note,''),500),'answeredAt',now_ms);
 elsif a = 'zelim' then
 if prev = 'zelim' or prev = 'ne' then raise exception 'bad'; end if;
 dep := ceil(coalesce((x->>'price')::numeric, 0) * coalesce(nullif(x->>'depositPct','')::numeric, public.sc_set('depositPct',10)) / 100 / 10) * 10;
 x := x || jsonb_build_object('answer','zelim','answerNote',left(coalesce(p_note,''),500),'answeredAt',now_ms,'deposit',dep,'depositAt',now_ms);
 elsif a in ('kupujem','nekupujem') then
 if a='kupujem' and (inspection_first or x->>'serviceFlow'='inspection-first') then return jsonb_build_object('ok',false,'reason','package_confirmation_required'); end if;
 if coalesce(x->>'inspAt','') = '' or coalesce(x->>'choice','') <> '' or coalesce(x->>'insp','') = 'ne' or x->'inspChecklist'->>'overall'='ne'
 or not public.sc_customer_inspection_completed(x) then raise exception 'bad'; end if;
 x := x || jsonb_build_object('choice', case when a = 'kupujem' then 'buy' else 'refund' end, 'choiceAt', now_ms, 'answerNote', left(coalesce(p_note,''),500));
 else
 if (coalesce(x->>'insp','') <> 'ne' and coalesce(x->'inspChecklist'->>'overall','')<>'ne') or coalesce(x->>'choice','') <> ''
 or not public.sc_positive_stage_stamp(x,'inspAt') then raise exception 'bad'; end if;
 x := x || jsonb_build_object('choice',a,'choiceAt',now_ms);
 end if;
 end if;
 newarr := newarr || jsonb_build_array(x);
 end loop;
 if not hit then raise exception 'bad'; end if;
 update public.sc_docs set data = data || jsonb_build_object('proposals', newarr) where collection = 'leads' and id = rid;
 if a = 'nekupujem' and fid is not null then
 update public.sc_docs set data = data || jsonb_build_object('status','odbijeno','stepAt',now_ms) where collection = 'finds' and id = fid and data->>'status' in ('izabrano','pogledano','gledano');
 end if;
 msg := case a when 'ne' then ' ne želi: ' when 'zelim' then case when inspection_first then ' želi pregled (čeka uplatu pregleda): ' else ' želi pregled (čeka kaparu): ' end when 'kupujem' then ' KUPUJE posle pregleda: '
 when 'nekupujem' then ' ne kupuje posle pregleda: ' when 'refund' then ' traži povrat kapare za: ' else ' traži drugo auto umesto: ' end;
 insert into public.sc_docs (collection, id, data) values ('events', 'ans-' || encode(extensions.gen_random_bytes(6),'hex'), jsonb_build_object(
 'type','order','actor','Potražilac','at',now_ms,'carId',null,
 'text','Potražilac ' || coalesce(l->>'name','') || msg || ttl ||
 (case when coalesce(p_note,'') <> '' then ' — „' || left(p_note,200) || '“' else '' end)));
 return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.sc_customer_purchase_ready(l jsonb, c jsonb, p_car_id text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$ declare p jsonb; selected integer:=0; begin if l is null or c is null or coalesce(l->>'status','') in ('odustao','predato','kupio') or (nullif(l->>'carId','') is not null and l->>'carId' is distinct from p_car_id) or jsonb_typeof(coalesce(l->'proposals','[]'::jsonb))<>'array' then return false; end if; for p in select value from jsonb_array_elements(coalesce(l->'proposals','[]'::jsonb)) loop if ((nullif(c->>'fromFind','') is not null and p->>'findId'=c->>'fromFind') or (nullif(c->>'fromFind','') is null and nullif(p_car_id,'') is not null and p->>'carId'=p_car_id)) and public.sc_customer_inspection_completed(p) and p->>'inspectionPaid'='true' and p->>'choice'='buy' and ((p->>'serviceFlow' is distinct from 'inspection-first' and p#>>'{quoteCalculation,version}' is distinct from '1') or (p->>'serviceMode'='package' and p->>'serviceSelectedBy'='client')) and coalesce(p->>'depositPaidAt','') ~ '^[0-9]+([.][0-9]+)?$' and coalesce(p->>'choice','') not in ('refund','continue') and nullif(p->>'depositRefundAt','') is null then if (p->>'depositPaidAt')::numeric>0 then selected:=selected+1; end if; end if; end loop; return selected=1; end $function$;
notify pgrst, 'reload schema';
