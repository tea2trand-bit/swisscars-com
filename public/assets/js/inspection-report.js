/* Team checklist and customer report. Images stay with the relevant finding. */
(()=>{
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const groups=[
  ['documents','Dokumentacija','Saobraćajna, VIN, servisna istorija i MFK.'],
  ['body','Karoserija','Popravke, rđa, ogrebotine i udubljenja.'],
  ['interior','Enterijer i oprema','Sedišta, presvlake i isprobana oprema.'],
  ['engine','Motor','Rad motora i vidljiva curenja.'],
  ['gearbox','Menjač','Promene brzina i ponašanje u vožnji.'],
  ['running','Kočnice, trap i probna vožnja','Ono što je provereno na mestu ili u probnoj vožnji.'],
  ['tyres','Gume i felne','Šara, habanje, oštećenja i kompleti uz vozilo.']
 ];
 const presets={documents:['Dokumentacija uredna','Nedostaje dokument'],body:['Bez vidljivih oštećenja','Oštećenje / rđa'],interior:['Oprema isprobana','Oštećenje enterijera'],engine:['Motor radi mirno','Bez vidljivih curenja'],gearbox:['Menjač ne trza','Promene brzina uredne'],running:['Kočnice uredne','Bez lupanja u trapu','Probna vožnja obavljena'],tyres:['Gume uredne','Felne bez oštećenja']};
 const states={unseen:'Nije provereno',ok:'Bez uočenih problema',attention:'Potrebna dodatna provera',defect:'Uočen nedostatak'};
 const shortStates={unseen:'Neprovereno',ok:'U redu',attention:'Proveriti',defect:'Nedostatak'};
 const sets={unknown:'Nije evidentirano',summer:'Letnje',winter:'Zimske',both:'Letnje i zimske'};
 const verdicts={da:'Preporučujemo kupovinu',oprez:'Kupovina uz dodatnu proveru',ne:'Ne preporučujemo kupovinu'};
 function refresh(root){
  root.querySelectorAll('[data-ir-check]').forEach(el=>{const group=el.closest('.ir-group');group.querySelectorAll('[data-ir-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.irChoice===el.value)));const lines=group.querySelector('[data-ir-group]').value.split('\n');group.querySelectorAll('[data-ir-preset]').forEach(b=>b.setAttribute('aria-pressed',String(lines.includes(b.dataset.irPreset))));});
 }
 function mount(root,options={}){
  if(!root||root.dataset.irMounted)return;
  root.dataset.irMounted='1';root.classList.add('ir-form');if(options.field)root.classList.add('ir-field-form');
  root.innerHTML=`<h4>Kratak nalaz sa pregleda</h4><p class="ir-hint">Izaberite ocene i fotografišite nalaz. Neprovereno ostaje posebno označeno.</p><details><summary>VIN, kilometraža i datum (po potrebi)</summary><div class="ir-fields"><label>VIN<input data-ir-field="vin" maxlength="30"></label><label>Kilometraža na satu, km<input data-ir-field="km" type="number" min="0" max="3000000" step="1"></label><label>Datum pregleda<input data-ir-field="date" type="date"></label></div></details>${groups.map(([id,title,hint])=>`<section class="ir-group" data-ir-section="${id}"><label class="ir-check"><strong>${esc(title)}</strong><select data-ir-check="${id}" ${options.field?'hidden':''}>${Object.entries(states).map(([value,text])=>`<option value="${value}">${esc(text)}</option>`).join('')}</select></label>${options.field?`<div class="ir-choices">${Object.entries(shortStates).map(([value,text])=>`<button class="b" type="button" data-ir-choice="${value}" aria-label="${esc(title)}: ${text}" aria-pressed="${value==='unseen'}">${text}</button>`).join('')}</div><div class="ir-presets">${presets[id].map(text=>`<button class="b" type="button" data-ir-preset="${text}" aria-pressed="false">${text}</button>`).join('')}</div>`:''}<p class="ir-hint">${esc(hint)}</p>${id==='tyres'?`<details class="ir-tyre-options"><summary>Kompleti guma i felni</summary><div class="ir-fields"><label>Koje gume se predaju<select data-ir-field="sets">${Object.entries(sets).map(([value,text])=>`<option value="${value}">${esc(text)}</option>`).join('')}</select></label><label>Ukupno felni uz vozilo<select data-ir-field="count"><option value="">Nije evidentirano</option><option value="4">4 felne</option><option value="8">8 felni</option><option value="other">Drugi broj — napomena</option></select></label></div></details>`:''}<details class="ir-note"><summary>Napomena (po potrebi)</summary><textarea data-ir-group="${id}" rows="2" maxlength="2000" placeholder="Kratko opišite nalaz ili šta nije provereno"></textarea></details>${options.field?`<div class="ir-photo-controls"><button class="b" type="button" data-ir-camera="${id}" aria-label="Slikaj: ${esc(title)}">+ Slika</button><button class="b" type="button" data-ir-gallery="${id}" aria-label="Dodaj iz galerije: ${esc(title)}">Galerija</button><input type="file" data-ir-camera-input="${id}" accept="image/*" capture="environment" multiple hidden><input type="file" data-ir-gallery-input="${id}" accept="image/*" multiple hidden><small data-ir-photo-count="${id}"></small></div><div class="ir-photos ir-editor-photos" data-ir-photos="${id}"></div>`:''}</section>`).join('')}<label><strong>Završna preporuka</strong><select data-ir-overall required><option value="">Izaberite preporuku</option>${Object.entries(verdicts).map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}</select></label>`;
  root.querySelectorAll('[data-ir-check]').forEach(el=>el.onchange=()=>{if(['defect','attention'].includes(el.value))el.closest('.ir-group').querySelector('.ir-note').open=true;refresh(root);});
  root.querySelectorAll('[data-ir-choice]').forEach(b=>b.onclick=()=>{const select=b.closest('.ir-group').querySelector('[data-ir-check]');select.value=b.dataset.irChoice;select.dispatchEvent(new Event('change'));});
  root.querySelectorAll('[data-ir-preset]').forEach(b=>b.onclick=()=>{const group=b.closest('.ir-group'),note=group.querySelector('[data-ir-group]'),text=b.dataset.irPreset,lines=note.value.split('\n').filter(Boolean),has=lines.includes(text);note.value=(has?lines.filter(x=>x!==text):[...lines,text]).join('\n');group.querySelector('.ir-note').open=true;const select=group.querySelector('[data-ir-check]');if(!has){select.value=/Nedostaje|Oštećenje/.test(text)?'defect':'ok';}refresh(root);});
  root.querySelectorAll('[data-ir-group]').forEach(el=>el.addEventListener('input',()=>refresh(root)));
 }
 function groupPhotos(data,id){return Array.isArray(data?.photos?.[id])?data.photos[id].filter(x=>typeof x==='string'&&x):[];}
 function unassignedPhotos(data,photos){const assigned=new Set(groups.flatMap(([id])=>groupPhotos(data,id)));return (photos||[]).filter(x=>!assigned.has(x));}
 function read(root){
  const overall=root.querySelector('[data-ir-overall]');if(!overall.reportValidity())return null;
  const data={version:3,overall:overall.value,vehicle:{},checks:{},notes:{},tyres:{},photos:{}};
  for(const el of root.querySelectorAll('[data-ir-field]')){if(!el.checkValidity()){el.closest('details')?.setAttribute('open','');el.reportValidity();return null;}const value=el.value.trim();if(!value)continue;const key=el.dataset.irField;(['sets','count'].includes(key)?data.tyres:data.vehicle)[key]=el.type==='number'?Number(value):value;}
  root.querySelectorAll('[data-ir-check]').forEach(el=>data.checks[el.dataset.irCheck]=el.value);
  root.querySelectorAll('[data-ir-group]').forEach(el=>{if(el.value.trim())data.notes[el.dataset.irGroup]=el.value.trim();});
  root.querySelectorAll('[data-ir-photos]').forEach(el=>{const ids=JSON.parse(el.dataset.photoIds||'[]');if(ids.length)data.photos[el.dataset.irPhotos]=ids;});
  return data;
 }
 function render(data,language,options={}){
  if(!data||![2,3].includes(data.version))return '';
  const v=data.vehicle||{},checks=data.checks||{},notes=data.notes||{},tyres=data.tyres||{};
  const photoUrl=options.photoUrl||window.SC?.photoUrl||(id=>/^https?:/.test(id)?id:'https://qghrrnqsvsrcwdhgufkv.supabase.co/storage/v1/object/public/sc-photos/'+String(id).split('/').map(encodeURIComponent).join('/'));
  const meta=[['vin','VIN'],['km','Kilometraža na satu'],['date','Datum pregleda'],['by','Pregled obavio']].filter(([key])=>v[key]!=null&&v[key]!=='');
  const value=(key,x)=>key==='km'&&Number.isFinite(Number(x))?Number(x).toLocaleString('sr-Latn-RS')+' km':key==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(x)?new Date(x+'T12:00:00').toLocaleDateString('sr-Latn-RS'):x;
  return `<section class="ir-report"><h3>Nalaz sa pregleda vozila</h3><p class="ir-hint">Zatečeno stanje i uočeni nalazi. Sve što nije provereno ostaje označeno.</p>${meta.length?`<dl class="ir-meta">${meta.map(([key,label])=>`<div><dt>${esc(label)}</dt><dd>${esc(value(key,v[key]))}</dd></div>`).join('')}</dl>`:''}<div class="ir-groups">${groups.filter(([id])=>data.version===3||id!=='gearbox').map(([id,groupTitle])=>{const title=data.version===2&&id==='engine'?'Motor i menjač':groupTitle,state=Object.hasOwn(states,checks[id])?checks[id]:'unseen',photos=groupPhotos(data,id);return `<section class="ir-group" data-ir-result="${id}"><h4>${esc(title)}</h4><span class="ir-state ir-${state}">${esc(states[state])}</span>${notes[id]?`<p class="ir-findings">${esc(notes[id])}</p>`:''}${id==='tyres'?`<dl class="ir-tyre-summary"><div class="ir-result"><dt>Gume uz vozilo</dt><dd>${esc(sets[tyres.sets]||sets.unknown)}</dd></div><div class="ir-result"><dt>Ukupno felni</dt><dd>${esc(tyres.count==='other'?'Drugi broj — napomena':tyres.count??'Nije evidentirano')}</dd></div></dl>`:''}${photos.length?`<div class="ir-photos">${photos.map((id,i)=>`<a href="${esc(photoUrl(id))}" target="_blank" rel="noopener"><img src="${esc(photoUrl(id))}" alt="${esc(title)} · slika ${i+1}" loading="lazy"></a>`).join('')}</div>`:''}</section>`;}).join('')}</div>${verdicts[data.overall]?`<p class="ir-findings"><strong>Završna preporuka:</strong> ${esc(verdicts[data.overall])}</p>`:''}</section>`;
 }
 window.SCInspectionReport={mount,refresh,read,render,verdicts,groups,groupPhotos,unassignedPhotos};
})();
