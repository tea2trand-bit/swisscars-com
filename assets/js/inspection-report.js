/* Quick team inspection form and client report. No network calls. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const groups=[
    ['documents','Dokumentacija','Saobraćajna, VIN, dostupna servisna istorija i MFK.'],
    ['body','Karoserija','Tragovi popravke, rđa, ogrebotine i udubljenja.'],
    ['interior','Enterijer i oprema','Sedišta, presvlake, vidljiva oštećenja i isprobana oprema.'],
    ['engine','Motor i menjač','Rad motora, vidljiva curenja i rad menjača.'],
    ['running','Kočnice, trap i probna vožnja','Ono što je stvarno provereno na mestu ili u probnoj vožnji.'],
    ['tyres','Gume i felne','Stanje šare, habanje, oštećenja i kompleti uz vozilo.']
  ];
  const states={unseen:'Nije provereno',ok:'Bez uočenih problema',attention:'Potrebna dodatna provera',defect:'Uočen nedostatak'};
  const sets={unknown:'Nije evidentirano',summer:'Letnje',winter:'Zimske',both:'Letnje i zimske'};
  const verdicts={da:'Preporučujemo kupovinu',oprez:'Kupovina uz dodatnu proveru',ne:'Ne preporučujemo kupovinu'};
  function mount(root){
    if(!root||root.dataset.irMounted)return;
    root.dataset.irMounted='1';root.classList.add('ir-form');
    root.innerHTML=`<h4>Kratak nalaz sa pregleda</h4><p class="ir-hint">Izaberite ocene. Napomenu dodajte samo kada je potrebna, a nedostatke fotografišite. Neprovereno ostaje posebno označeno.</p><details><summary>VIN, kilometraža i datum (po potrebi)</summary><div class="ir-fields"><label>VIN<input data-ir-field="vin" maxlength="30"></label><label>Kilometraža na satu, km<input data-ir-field="km" type="number" min="0" max="3000000" step="1"></label><label>Datum pregleda<input data-ir-field="date" type="date"></label></div></details>${groups.map(([id,title,hint])=>`<section class="ir-group"><label class="ir-check"><strong>${esc(title)}</strong><select data-ir-check="${id}">${Object.entries(states).map(([value,text])=>`<option value="${value}">${esc(text)}</option>`).join('')}</select></label><p class="ir-hint">${esc(hint)}</p>${id==='tyres'?`<div class="ir-fields"><label>Koje gume se predaju<select data-ir-field="sets">${Object.entries(sets).map(([value,text])=>`<option value="${value}">${esc(text)}</option>`).join('')}</select></label><label>Ukupno felni uz vozilo<select data-ir-field="count"><option value="">Nije evidentirano</option><option value="4">4 felne</option><option value="8">8 felni</option><option value="other">Drugi broj — napomena</option></select></label></div>`:''}<details class="ir-note"><summary>Napomena (po potrebi)</summary><textarea data-ir-group="${id}" rows="2" maxlength="2000" placeholder="Kratko opišite nalaz ili šta nije provereno"></textarea></details></section>`).join('')}<label><strong>Završna preporuka</strong><select data-ir-overall required><option value="">Izaberite preporuku</option>${Object.entries(verdicts).map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}</select></label>`;
    root.querySelectorAll('[data-ir-check]').forEach(el=>el.onchange=()=>{if(['defect','attention'].includes(el.value))el.closest('.ir-group').querySelector('.ir-note').open=true;});
  }
  function read(root){
    const overall=root.querySelector('[data-ir-overall]');if(!overall.reportValidity())return null;
    const data={version:2,overall:overall.value,vehicle:{},checks:{},notes:{},tyres:{}};
    for(const el of root.querySelectorAll('[data-ir-field]')){
      if(!el.checkValidity()){const details=el.closest('details');if(details)details.open=true;el.reportValidity();return null;}
      const value=el.value.trim();if(!value)continue;const key=el.dataset.irField;
      (['sets','count'].includes(key)?data.tyres:data.vehicle)[key]=el.type==='number'?Number(value):value;
    }
    root.querySelectorAll('[data-ir-check]').forEach(el=>data.checks[el.dataset.irCheck]=el.value);
    root.querySelectorAll('[data-ir-group]').forEach(el=>{if(el.value.trim())data.notes[el.dataset.irGroup]=el.value.trim();});
    return data;
  }
  function render(data){
    if(!data||data.version!==2)return '';
    const v=data.vehicle||{},checks=data.checks||{},notes=data.notes||{},tyres=data.tyres||{};
    const meta=[['vin','VIN'],['km','Kilometraža na satu'],['date','Datum pregleda'],['by','Pregled obavio']].filter(([key])=>v[key]!=null&&v[key]!=='');
    const value=(key,x)=>key==='km'&&Number.isFinite(Number(x))?Number(x).toLocaleString('sr-Latn-RS')+' km':key==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(x)?new Date(x+'T12:00:00').toLocaleDateString('sr-Latn-RS'):x;
    return `<section class="ir-report"><h3>Nalaz sa pregleda vozila</h3><p class="ir-hint">Zatečeno stanje i uočeni nalazi. Sve što nije provereno ostaje označeno.</p>${meta.length?`<dl class="ir-meta">${meta.map(([key,label])=>`<div><dt>${esc(label)}</dt><dd>${esc(value(key,v[key]))}</dd></div>`).join('')}</dl>`:''}<div class="ir-groups">${groups.map(([id,title])=>{const state=Object.hasOwn(states,checks[id])?checks[id]:'unseen';return `<section class="ir-group"><h4>${esc(title)}</h4><span class="ir-state ir-${state}">${esc(states[state])}</span>${notes[id]?`<p class="ir-findings">${esc(notes[id])}</p>`:''}${id==='tyres'?`<dl class="ir-tyre-summary"><div class="ir-result"><dt>Gume uz vozilo</dt><dd>${esc(sets[tyres.sets]||sets.unknown)}</dd></div><div class="ir-result"><dt>Ukupno felni</dt><dd>${esc(tyres.count==='other'?'Drugi broj — napomena':tyres.count??'Nije evidentirano')}</dd></div></dl>`:''}</section>`;}).join('')}</div>${verdicts[data.overall]?`<p class="ir-findings"><strong>Završna preporuka:</strong> ${esc(verdicts[data.overall])}</p>`:''}</section>`;
  }
  window.SCInspectionReport={mount,read,render,verdicts};
})();
