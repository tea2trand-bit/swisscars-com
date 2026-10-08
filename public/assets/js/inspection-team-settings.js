(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SCInspectionTeamSettings=api;})(typeof window==='undefined'?this:window,function(){
 'use strict';
 const numeric=v=>typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v.trim().replace(',','.')):NaN;
 function values(settings={}){const p=settings.inspectionTeamPricing;return p?{...p}:{origin_plz:'9000',origin_ort:'St. Gallen',base_fee:Number(settings.inspBaseFee)>0?Number(settings.inspBaseFee):120,km_rate:settings.inspKmRate??1.5,local_km:10,version:0};}
 function validate(p){
  const base=numeric(p.base_fee),rate=numeric(p.km_rate),local=numeric(p.local_km);
  if(!/^[1-9][0-9]{3}$/.test(p.origin_plz||'')||!p.origin_ort)throw Error('Izaberi mesto polaska sa liste predloga.');
  if(!Number.isFinite(base)||base<1||base>5000)throw Error('Paušalna cena mora biti između 1 i 5000 CHF.');
  if(!Number.isFinite(rate)||rate<0||rate>20)throw Error('Cena po kilometru mora biti između 0 i 20 CHF.');
  if(!Number.isInteger(local)||local<0||local>50)throw Error('Lokalno područje mora biti ceo broj od 0 do 50 km.');
  return {origin_plz:p.origin_plz,origin_ort:p.origin_ort,base_fee:Math.round(base*100)/100,km_rate:Math.round(rate*100)/100,local_km:local};
 }
 function example(p,d=30){const extra=Math.max(0,d-p.local_km);return{extra,total:Math.round((p.base_fee+2*extra*p.km_rate)*100)/100};}
 function bind({form,getSettings,allowed,rpc,onSaved}){
  if(!form)return null;
  const q=s=>form.querySelector(s), field=n=>q('[name="'+n+'"]'), status=q('[role="status"]'), input=field('origin'),list=q('[role="listbox"]'),button=q('[type="submit"]');
  let saved=null,origin=null,dirty=false,busy=false,seq=0,timer=null,items=[],active=-1,conflict=false;
  const numberControls=[];
  for(const [name,step,label,unit] of [['base_fee',10,'paušalnu cenu','CHF'],['local_km',1,'lokalno područje','km'],['km_rate',0.1,'cenu po kilometru','CHF']]){
   const input=field(name),wrap=document.createElement('div');wrap.className='team-number-control';input.before(wrap);wrap.append(input);
   for(const direction of [-1,1]){
    const b=document.createElement('button');b.type='button';b.className='b';b.textContent=direction<0?'−':'+';b.setAttribute('aria-label',(direction<0?'Smanji ':'Povećaj ')+label+' za '+String(step).replace('.',',')+' '+unit);b.setAttribute('aria-controls',input.id);
    if(direction<0)wrap.prepend(b);else wrap.append(b);
    b.addEventListener('click',()=>{if(busy||conflict||!allowed())return;const value=numeric(input.value),min=Number(input.min),max=Number(input.max);input.value=String(Math.round(Math.min(max,Math.max(min,Number.isFinite(value)?value+direction*step:min))*100)/100);input.dispatchEvent(new Event('input',{bubbles:true}));});
    numberControls.push({input,button:b,direction});
   }
  }
  function syncNumberControls(){for(const {input,button,direction} of numberControls){const value=numeric(input.value);button.disabled=busy||conflict||!allowed()||(direction<0?(!Number.isFinite(value)||value<=Number(input.min)):(Number.isFinite(value)&&value>=Number(input.max)));}}
  const message=s=>status.textContent=s;
  const close=()=>{items=[];active=-1;list.hidden=true;list.replaceChildren();input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
  function choose(p){origin=p;input.value=p.plz+' '+p.ort;dirty=true;close();preview();}
  function renderList(){list.replaceChildren(...items.map((p,i)=>{const li=document.createElement('li');li.setAttribute('role','option');li.id='teamOrigin'+i;li.setAttribute('aria-selected',String(i===active));li.textContent=p.plz+' '+p.ort+' · '+p.kanton;li.addEventListener('mousedown',e=>e.preventDefault());li.addEventListener('click',()=>choose(p));return li;}));list.hidden=!items.length;input.setAttribute('aria-expanded',String(!!items.length));if(active>=0)input.setAttribute('aria-activedescendant','teamOrigin'+active);}
  async function suggest(){const value=input.value.trim(),n=++seq;if(value.length<2){close();return;}try{const r=await rpc('sc_place_suggest',{p_prefix:value,p_limit:8});if(n!==seq||value!==input.value.trim())return;if(r.error)throw r.error;items=r.data||[];active=-1;renderList();message(items.length?'Izaberi mesto polaska.':'Nema mesta za ovaj unos.');}catch{if(n===seq)message('Predlozi mesta trenutno nisu dostupni. Pokušaj ponovo.');}}
  function read(){return validate({origin_plz:origin?.plz,origin_ort:origin?.ort,base_fee:field('base_fee').value,km_rate:field('km_rate').value,local_km:field('local_km').value});}
  function preview(){syncNumberControls();try{const p=read(),e=example(p);q('[data-example]').textContent='Primer: vozilo 30 km od polazišta → '+p.base_fee+' + 2 × '+e.extra+' km × '+p.km_rate+' = '+e.total+' CHF.';}catch{q('[data-example]').textContent='Lokalni pregled = paušal. Van lokalnog područja dodaje se put u oba smera.';}}
  function refresh(force=false){button.disabled=busy||!allowed()||conflict;syncNumberControls();if(busy||dirty&&!force)return;saved=values(getSettings());origin={plz:saved.origin_plz,ort:saved.origin_ort};input.value=origin.plz+' '+origin.ort;for(const n of ['base_fee','km_rate','local_km'])field(n).value=saved[n];preview();q('[data-state]').textContent=saved.version?'Sačuvani cenovnik SWISCARS tima. Izmene važe za nove obračune.':'Predlog cenovnika. Primenjuje se tek kada pritisneš „Sačuvaj cenovnik“. ';}
  input.addEventListener('input',()=>{dirty=true;origin=null;++seq;clearTimeout(timer);close();timer=setTimeout(suggest,250);});
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){close();return;}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(!items.length){suggest();return;}active=e.key==='ArrowDown'?Math.min(items.length-1,active+1):Math.max(0,active-1);renderList();}else if(e.key==='Enter'&&items.length){e.preventDefault();choose(items[Math.max(0,active)]);}});
  form.addEventListener('input',()=>{dirty=true;preview();});
  form.addEventListener('focusout',e=>{if(!form.contains(e.relatedTarget)){++seq;close();}});
  q('[data-reload]').addEventListener('click',()=>{dirty=false;conflict=false;refresh(true);message('Učitane su poslednje sačuvane vrednosti.');});
  form.addEventListener('submit',async e=>{e.preventDefault();if(busy||conflict||!allowed())return;let p;try{p=read();}catch(error){message(error.message);return;}busy=true;button.disabled=true;message('Čuvamo cenovnik…');try{const r=await rpc('sc_admin_save_inspection_pricing',{p_pricing:p,p_expected_version:saved?.version||null});if(r.error)throw r.error;if(!r.data||!r.data.version)throw Error('invalid_result');onSaved(r.data);dirty=false;message('Cenovnik je sačuvan. Nove ponude koriste ovu paušalnu cenu i tarifu puta.');}catch(error){conflict=/pricing_changed_reload/.test(error.message||error.code||'');message(conflict?'Cenovnik je u međuvremenu promenjen. Učitaj sačuvane vrednosti pre nove izmene.':'Čuvanje nije uspelo. Proveri vezu i pokušaj ponovo.');}finally{busy=false;refresh();}});
  refresh();return{refresh};
 }
 return{values,validate,example,bind};
});
