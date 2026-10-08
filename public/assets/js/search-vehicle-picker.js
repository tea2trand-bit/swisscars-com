/* Searchable vehicle selector. The catalogue is not a demand ranking. */
(() => {
  'use strict';
  const offline=!!document.querySelector('[data-sc-offline-preview]');
  const form=document.getElementById('companyManualSearch'), legacy=form?.querySelector('input[name="model"]');
  if(!legacy || document.getElementById('vehiclePicker')) return;
  Object.assign(window.EV_DICT||{}, {'Bilo koje':['Beliebig','Any'],'Izaberi zaradu':['Gewinn wählen','Choose profit'],'Pretraga obuhvata izabrane modele; radijus je okviran. Procena nije garancija prodaje.':['Die Suche umfasst die ausgewählten Modelle; der Umkreis ist ungefähr. Die Schätzung ist keine Verkaufsgarantie.','Search covers the selected models; the radius is approximate. The estimate is not a sale guarantee.']});
  const catalog={
    Volkswagen:['Golf','Golf 2.0 TDI','Polo','Passat','Passat 2.0 TDI','Tiguan','Touran','T-Roc','Touareg','Caddy','Sharan','Transporter','up!','Arteon','ID.3','ID.4'],
    Audi:['A1','A3','A4','A5','A6','A7','A8','Q2','Q3','Q5','Q7','Q8','TT','e-tron'],
    BMW:['1','2','3','4','5','6','7','8','X1','X2','X3','X4','X5','X6','X7','i3','i4','iX','Z4'],
    Opel:['Astra','Corsa','Insignia','Meriva','Zafira','Mokka','Crossland','Grandland','Combo','Vivaro'],
    'Škoda':['Octavia','Fabia','Superb','Rapid','Scala','Kamiq','Karoq','Kodiaq','Yeti','Enyaq','Citigo'],
    Peugeot:['107','108','206','207','208','2008','307','308','3008','407','508','5008','Partner','Rifter'],
    'Mercedes-Benz':['A-Klasse','B-Klasse','C-Klasse','CLA','CLS','E-Klasse','S-Klasse','GLA','GLB','GLC','GLE','GLS','V-Klasse','Vito','Sprinter'],
    Renault:['Clio','Megane','Scenic','Grand Scenic','Captur','Kadjar','Koleos','Talisman','Laguna','Twingo','Kangoo','Trafic'],
    Ford:['Fiesta','Focus','Mondeo','Kuga','Puma','S-Max','Galaxy','C-Max','EcoSport','Transit','Ranger','Mustang'],
    Fiat:['500','500L','500X','Panda','Punto','Grande Punto','Tipo','Bravo','Doblo','Ducato'],
    Toyota:['Yaris','Corolla','Auris','Avensis','C-HR','RAV4','Prius','Aygo','Land Cruiser','Hilux'],
    Citroën:['C1','C3','C3 Aircross','C4','C4 Picasso','Grand C4 Picasso','C5','C5 Aircross','Berlingo'],
    Hyundai:['i10','i20','i30','i40','ix35','Kona','Tucson','Santa Fe','Ioniq','Ioniq 5'],
    Kia:['Picanto','Rio','Ceed','ProCeed','Stonic','Sportage','Sorento','Niro','Optima','EV6'],
    Nissan:['Micra','Note','Juke','Qashqai','X-Trail','Leaf','Navara'],
    SEAT:['Ibiza','Leon','Arona','Ateca','Tarraco','Alhambra','Toledo'],
    Volvo:['V40','V60','V70','V90','S60','S80','S90','XC40','XC60','XC90'],
    Dacia:['Sandero','Duster','Logan','Lodgy','Dokker','Jogger','Spring'],
    Mazda:['2','3','5','6','CX-3','CX-30','CX-5','CX-60','MX-5'],
    Honda:['Jazz','Civic','Accord','HR-V','CR-V'],
    Suzuki:['Swift','Ignis','SX4','S-Cross','Vitara','Jimny'],
    'Alfa Romeo':['MiTo','Giulietta','Giulia','Stelvio','Tonale','159'],
    Tesla:['Model 3','Model S','Model X','Model Y'],
    CUPRA:['Leon','Formentor','Ateca','Born'],
    Porsche:['911','Cayman','Boxster','Cayenne','Macan','Panamera','Taycan']
  };
  const key=offline?'swiscars.local.vehicle-selection.v2':'swiscars.vehicle-selection.v2';
  const norm=v=>v.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const id=v=>norm(v.make)+'|'+norm(v.model);
  const tr=(sr,de,en)=>({sr,de,en}[window.EV?.lang]||sr);
  const modelLabel=(make,model)=>make==='BMW'&&/^[1-8]$/.test(model)?tr('Serija ','Baureihe ','Series ')+model:model;
  const fullLabel=v=>v.make+' '+modelLabel(v.make,v.model);
  let selected=[],draft=[],activeMake='';
  try {const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))selected=saved.filter(v=>v&&typeof v.make==='string'&&typeof v.model==='string'&&v.make.trim()&&v.model.trim()&&fullLabel(v).length<=120).filter((v,i,a)=>a.findIndex(x=>id(x)===id(v))===i);}catch(_){}
  const original=legacy.closest('label');original.hidden=true;legacy.type='hidden';legacy.required=false;
  const field=document.createElement('div');field.className='vehicle-picker-field';field.setAttribute('translate','no');
  field.innerHTML='<label for="vehiclePickerTrigger"></label><button type="button" id="vehiclePickerTrigger" aria-haspopup="dialog" aria-controls="vehiclePicker" aria-expanded="false"><span></span><span aria-hidden="true">⌄</span></button><div class="vehicle-selection" aria-live="polite"></div>';
  original.after(field);
  const trigger=field.querySelector('button'),summary=field.querySelector('.vehicle-selection');
  const dialog=document.createElement('dialog');dialog.id='vehiclePicker';dialog.className='vehicle-picker';dialog.setAttribute('translate','no');dialog.setAttribute('aria-labelledby','vehiclePickerTitle');
  dialog.innerHTML='<header><h3 id="vehiclePickerTitle"></h3><button type="button" data-close>×</button></header><div class="vehicle-picker-body"><section class="vehicle-makes"><label for="vehicleMakeQuery"></label><input id="vehicleMakeQuery" type="search" autocomplete="off"><div class="vehicle-make-list"></div></section><section class="vehicle-models"><div class="vehicle-model-heading"><button type="button" data-back>‹</button><h4></h4></div><label class="vehicle-sr-only" for="vehicleModelQuery"></label><input id="vehicleModelQuery" type="search" autocomplete="off"><div class="vehicle-model-list"></div></section></div><details class="vehicle-custom"><summary></summary><div><label><span></span><input data-custom-make maxlength="50" autocomplete="off"></label><label><span></span><input data-custom-model maxlength="60" autocomplete="off"></label><button type="button" data-add></button></div><p role="status"></p></details><footer><div class="vehicle-draft-summary" aria-live="polite"></div><div class="vehicle-picker-actions"><button type="button" data-cancel></button><button type="button" data-apply></button></div></footer>';
  document.body.append(dialog);
  const dialogHint=document.createElement('p');dialogHint.id='vehiclePickerHint';dialogHint.className='vehicle-picker-hint';dialog.querySelector('header').after(dialogHint);dialog.setAttribute('aria-describedby',dialogHint.id);
  const q=s=>dialog.querySelector(s),makeQuery=q('#vehicleMakeQuery'),modelQuery=q('#vehicleModelQuery'),makeList=q('.vehicle-make-list'),modelList=q('.vehicle-model-list');
  const makeKeys=()=>[...new Set([...Object.keys(catalog),...draft.map(v=>v.make)])];
  function chip(item,remove){const b=document.createElement('button');b.type='button';b.className='vehicle-chip';b.textContent=fullLabel(item)+' ×';b.setAttribute('aria-label',tr('Ukloni ','Entfernen: ','Remove ')+fullLabel(item));b.onclick=remove;return b;}
  function save(){try{localStorage.setItem(key,JSON.stringify(selected));}catch(_){}legacy.value=selected.length===1?fullLabel(selected[0]):'';renderField();}
  function renderField(){
    field.querySelector('label').textContent=tr('Marka i model (možeš izabrati više)','Marke und Modell (Mehrfachauswahl)','Make and model (multiple selection)');
    const compact=selected.slice(0,2).map(v=>(v.make==='Volkswagen'?'VW':v.make)+' '+modelLabel(v.make,v.model)).join(', ');
    trigger.querySelector('span').textContent=selected.length?compact+(selected.length>2?' +'+(selected.length-2):''):tr('Izaberi marku i model','Marke und Modell wählen','Choose make and model');
    trigger.title=selected.map(fullLabel).join(', ');
    trigger.setAttribute('aria-label',field.querySelector('label').textContent+(selected.length?': '+trigger.title:''));
    summary.replaceChildren();
  }
  function renderDraft(){
    q('.vehicle-draft-summary').replaceChildren(...draft.map(item=>chip(item,()=>{draft=draft.filter(v=>id(v)!==id(item));renderModels();renderMakes();renderDraft();})));
    q('[data-apply]').textContent=tr('Primeni izbor','Auswahl übernehmen','Apply selection')+(draft.length?' ('+draft.length+')':'');
  }
  function renderMakes(){
    makeList.replaceChildren();
    for(const make of makeKeys().filter(v=>norm(v).includes(norm(makeQuery.value))||(v==='Volkswagen'&&norm(makeQuery.value)==='vw'))){
      const b=document.createElement('button');b.type='button';b.textContent=make;const count=draft.filter(v=>v.make===make).length;
      if(count){const badge=document.createElement('span');badge.textContent=count;b.append(badge);}b.setAttribute('aria-pressed',String(make===activeMake));
      b.onclick=()=>{activeMake=make;modelQuery.value='';q('[data-custom-make]').value=make;dialog.dataset.panel='models';renderMakes();renderModels();modelQuery.focus();};makeList.append(b);
    }
    if(!makeList.children.length){const p=document.createElement('p');p.textContent=tr('Nema marke na listi. Dodaj je ispod.','Marke nicht gefunden. Unten hinzufügen.','Make not listed. Add it below.');makeList.append(p);}
  }
  function renderModels(){
    q('.vehicle-model-heading h4').textContent=activeMake||tr('Izaberi marku','Marke wählen','Choose a make');modelQuery.disabled=!activeMake;modelList.replaceChildren();if(!activeMake)return;
    const models=[...new Set([...(catalog[activeMake]||[]),...draft.filter(v=>v.make===activeMake).map(v=>v.model)])];
    for(const model of models.filter(v=>norm(modelLabel(activeMake,v)).includes(norm(modelQuery.value)))){
      const item={make:activeMake,model},label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');input.type='checkbox';input.checked=draft.some(v=>id(v)===id(item));text.textContent=modelLabel(activeMake,model);
      input.onchange=()=>{draft=draft.filter(v=>id(v)!==id(item));if(input.checked)draft.push(item);renderMakes();renderDraft();};label.append(input,text);modelList.append(label);
    }
    if(!modelList.children.length){const p=document.createElement('p');p.textContent=tr('Nema modela na listi. Dodaj ga ispod.','Modell nicht gefunden. Unten hinzufügen.','Model not listed. Add it below.');modelList.append(p);}
  }
  function translate(){
    dialogHint.textContent=tr('Označi modele, pa primeni izbor.','Modelle markieren, dann Auswahl übernehmen.','Select models, then apply your selection.');
    renderField();q('h3').textContent=tr('Izaberi automobile','Fahrzeuge wählen','Choose vehicles');q('[data-close]').setAttribute('aria-label',tr('Zatvori bez izmena','Ohne Änderungen schließen','Close without changes'));
    q('.vehicle-makes>label').textContent=tr('Marka','Marke','Make');makeQuery.placeholder=tr('Pretraži marke','Marken suchen','Search makes');
    q('label[for="vehicleModelQuery"]').textContent=tr('Pretraži modele','Modelle suchen','Search models');modelQuery.placeholder=tr('Pretraži modele','Modelle suchen','Search models');
    q('[data-back]').setAttribute('aria-label',tr('Nazad na marke','Zurück zu Marken','Back to makes'));
    q('.vehicle-custom>summary').textContent=tr('Nema tvog modela? Dodaj ga','Modell fehlt? Hinzufügen','Model missing? Add it');q('[data-custom-make]').previousElementSibling.textContent=tr('Marka','Marke','Make');q('[data-custom-model]').previousElementSibling.textContent=tr('Model ili verzija','Modell oder Variante','Model or variant');q('[data-add]').textContent=tr('Dodaj u izbor','Zur Auswahl hinzufügen','Add to selection');q('[data-cancel]').textContent=tr('Otkaži','Abbrechen','Cancel');renderMakes();renderModels();renderDraft();
  }
  trigger.onclick=()=>{draft=selected.map(v=>({...v}));activeMake=draft[0]?.make||'';makeQuery.value='';modelQuery.value='';q('.vehicle-custom').open=false;q('.vehicle-custom p').textContent='';q('[data-custom-make]').value=activeMake;q('[data-custom-model]').value='';dialog.dataset.panel=activeMake?'models':'makes';translate();dialog.showModal();trigger.setAttribute('aria-expanded','true');(activeMake?modelQuery:makeQuery).focus();};
  q('[data-close]').onclick=q('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus();});
  q('[data-apply]').onclick=()=>{selected=draft.map(v=>({...v}));save();dialog.close();};q('[data-back]').onclick=()=>{dialog.dataset.panel='makes';makeQuery.focus();};makeQuery.oninput=renderMakes;modelQuery.oninput=renderModels;
  q('[data-add]').onclick=()=>{
    let make=q('[data-custom-make]').value.trim(),model=q('[data-custom-model]').value.trim();if(!make||!model){q('.vehicle-custom p').textContent=tr('Upiši marku i model.','Marke und Modell eingeben.','Enter make and model.');return;}
    make=makeKeys().find(v=>norm(v)===norm(make)||(v==='Volkswagen'&&norm(make)==='vw'))||make;model=(catalog[make]||[]).find(v=>norm(v)===norm(model)||norm(modelLabel(make,v))===norm(model))||model;
    const item={make,model};if(!draft.some(v=>id(v)===id(item)))draft.push(item);activeMake=make;modelQuery.value='';makeQuery.value='';dialog.dataset.panel='models';q('.vehicle-custom p').textContent=tr('Dodato u izbor.','Zur Auswahl hinzugefügt.','Added to selection.');renderMakes();renderModels();renderDraft();
  };
  window.SCCompanyModelSelection=()=>selected.map(fullLabel);
  // Offline preview only: never launch a live request from fixture data.
  if(offline)form.addEventListener('submit',event=>{
    event.preventDefault();event.stopImmediatePropagation();const result=form.querySelector('[data-company-search-result]');result.setAttribute('translate','no');
    if(!selected.length){result.textContent=tr('Izaberi bar jedan model.','Mindestens ein Modell wählen.','Choose at least one model.');trigger.focus();return;}
    try{const values=Object.fromEntries([...form.querySelectorAll('[name]:not(:disabled)')].map(el=>[el.name,el.value]));const budget=companySelectedSearchBudget();const filters=selected.map(item=>{const {vehicleType,...criteria}=companyManualCriteria({...values,model:fullLabel(item)});return criteria;});localStorage.setItem('swiscars.local.model-search-draft.v2',JSON.stringify({models:selected,budget,filters,createdAt:new Date().toISOString()}));result.textContent=tr('Lokalni izbor je sačuvan. KI nije povezana; pretraga nije pokrenuta.','Lokale Auswahl gespeichert. KI ist nicht verbunden; keine Suche gestartet.','Local selection saved. AI is not connected; no search was started.');}catch(error){result.textContent=error.message;}
  },true);
  form.addEventListener('reset',()=>queueMicrotask(()=>{selected=[];save();}));window.addEventListener('evidencija-language-changed',translate);translate();save();window.EV?.apply();
})();
