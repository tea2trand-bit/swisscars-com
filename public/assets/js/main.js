const buttons=document.querySelectorAll('[data-lang]');const navToggle=document.querySelector('.nav-toggle');const nav=document.querySelector('.nav');function applyLanguage(lang){lang=["sr","de"].includes(lang)?lang:"sr";const d=translations[lang]||translations.sr;document.documentElement.lang=lang;document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.getAttribute('data-i18n');if(d[k])el.textContent=window.SCServicePrices?SCServicePrices.format(d[k],lang):d[k]});document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{const k=el.getAttribute('data-i18n-placeholder');if(d[k])el.setAttribute('placeholder',d[k])});document.querySelectorAll('[data-i18n-list]').forEach(el=>{const k=el.getAttribute('data-i18n-list');if(Array.isArray(d[k])){el.innerHTML='';d[k].forEach(x=>{const li=document.createElement('li');li.textContent=x;el.appendChild(li)})}});buttons.forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));localStorage.setItem('swiscars-lang',lang)}buttons.forEach(b=>b.addEventListener('click',()=>applyLanguage(b.dataset.lang)));navToggle.addEventListener('click',()=>{nav.classList.toggle('open');navToggle.setAttribute('aria-expanded',nav.classList.contains('open'))});document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');navToggle.setAttribute('aria-expanded','false')}));applyLanguage(localStorage.getItem('swiscars-lang')||'sr');document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',function(e){const id=this.getAttribute('href').slice(1);const target=document.getElementById(id);if(target){e.preventDefault();const top=target.getBoundingClientRect().top+window.pageYOffset-80;window.scrollTo({top:top,behavior:'smooth'})}}));
const SC_URL='https://qghrrnqsvsrcwdhgufkv.supabase.co',SC_KEY='sb_publishable_ouwn1r_BvZS9nWyg3vJHAQ_ApUagfSP';
// Keep the current section visible while scrolling, including keyboard and hash navigation.
(function () {
  const links=[...document.querySelectorAll('.nav a, .header-cta')].filter(a=>!a.closest('.nav-requests-list'));
  const onHome=location.pathname==='/'||location.pathname==='/index.html';
  const targets=onHome?[...new Set(links.map(a=>new URL(a.href,location.href).hash).filter(Boolean))].map(hash=>document.getElementById(hash.slice(1))).filter(Boolean):[];
  function mark(id) {
    for(const a of links){const u=new URL(a.href,location.href),same=u.pathname===location.pathname||onHome&&u.pathname==='/';
      const active=same&&(onHome?u.hash==='#'+id:!u.hash||a.getAttribute('data-i18n')==='navInsp'&&u.hash==='#kalkulator-pregleda');
      if(active)a.setAttribute('aria-current',onHome?'location':'page');else a.removeAttribute('aria-current');}
  }
  function update(){let current=targets[0]?.id;const line=(document.querySelector('.site-header')?.getBoundingClientRect().bottom||80)+40;
    for(const el of targets)if(el.getBoundingClientRect().top<=line)current=el.id;
    mark(current);}
  let frame;
  if(onHome){addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});},{passive:true});addEventListener('resize',update);addEventListener('hashchange',update);update();}
  else mark(null);
})();
// Shared required contact validation for search and inspection requests.
window.SCContactValidation=Object.freeze({
  validFullName(value){if(typeof value!=='string')return false;const words=value.trim().split(/\s+/);return words.length>=2&&words.every(word=>/\p{L}/u.test(word));},
  validPhone(value){if(typeof value!=='string')return false;const phone=value.trim();if(!/^\+?[0-9][0-9\s().\/-]*$/.test(phone))return false;const digits=phone.replace(/\D/g,'').replace(/^00/,'');return digits.length>=7&&digits.length<=15;}
});
const contactForm=document.getElementById('contact-form');if(contactForm){
const status=contactForm.querySelector('.form-status');const submitBtn=contactForm.querySelector('button[type="submit"]');
const nameField=contactForm.querySelector('[name="name"]'),phoneField=contactForm.querySelector('[name="phone"]');
const contactMessages=()=>localStorage.getItem('swiscars-lang')==='de'?{name:'Bitte geben Sie Ihren Vor- und Nachnamen ein.',phone:'Bitte geben Sie eine gültige Telefonnummer mit 7 bis 15 Ziffern ein.'}:{name:'Unesite ime i prezime.',phone:'Unesite ispravan broj telefona sa 7 do 15 cifara.'};
function setContactValidity(field,valid,message){if(!field)return;field.setCustomValidity(valid?'':message);if(valid)field.removeAttribute('aria-invalid');else field.setAttribute('aria-invalid','true');}
function checkContact(){const messages=contactMessages(),nameOK=!!nameField&&window.SCContactValidation.validFullName(nameField.value),phoneOK=!!phoneField&&window.SCContactValidation.validPhone(phoneField.value);setContactValidity(nameField,nameOK,messages.name);setContactValidity(phoneField,phoneOK,messages.phone);return{nameOK,phoneOK,messages};}
[nameField,phoneField].filter(Boolean).forEach(field=>field.addEventListener('input',checkContact));
contactForm.addEventListener('submit',async function(e){e.preventDefault();const lang=localStorage.getItem('swiscars-lang')||'sr';const d=translations[lang]||translations.sr;
const checked=checkContact();if(!checked.nameOK||!checked.phoneOK){const invalid=checked.nameOK?phoneField:nameField;if(status){status.hidden=false;status.className='form-status err';status.textContent=checked.nameOK?checked.messages.phone:checked.messages.name;}if(invalid){invalid.focus();invalid.reportValidity();}return;}
if(!contactForm.reportValidity())return;
const sendLabel=submitBtn?submitBtn.textContent:'';if(submitBtn){submitBtn.disabled=true;submitBtn.textContent=d.formSending||'...'}const fd=new FormData(contactForm);fd.set('name',nameField.value.trim().replace(/\s+/g,' '));fd.set('phone',phoneField.value.trim());const v=k=>(fd.get(k)||'').toString();
const primary=await fetch(SC_URL+'/rest/v1/rpc/sc_submit_order',{method:'POST',headers:{apikey:SC_KEY,'Content-Type':'application/json'},body:JSON.stringify({p:{name:v('name'),phone:v('phone'),email:v('email'),city:v('city'),budget:v('budget'),brand:v('brand'),model:v('model'),yearFrom:v('yearFrom'),fuel:v('fuel'),gearbox:v('gearbox'),body:v('body'),drive:v('drive'),color:v('color'),mileage:v('mileage'),when:v('when'),equip:fd.getAll('equip').map(String),notes:v('notes'),website:v('bot-field'),lang}})}).then(async r=>{const body=await r.json().catch(()=>null);return{rejected:r.status>=400&&r.status<500,result:r.ok?body:null,reason:body&&typeof body.message==='string'?body.message:''};}).catch(()=>({rejected:false,result:null,reason:''}));
const res=primary.result;
const okN=!primary.rejected&&await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fd).toString()}).then(r=>r.ok).catch(()=>false);
if(status){status.hidden=false}
if(res&&res.token){const link='https://swiscars.com/upit/#'+res.token;fetch(SC_URL+'/functions/v1/order-mail',{method:'POST',headers:{apikey:SC_KEY,'Content-Type':'application/json'},body:JSON.stringify({token:res.token})}).catch(()=>{});
  if(status){status.className='form-status ok';status.innerHTML='';const p1=document.createElement('span');p1.textContent=(d.formSuccessTrack||d.formSuccess)+' ';const a=document.createElement('a');a.href=link;a.textContent=d.formTrackLink||link;a.style.textDecoration='underline';status.appendChild(p1);status.appendChild(a);
    const p2=document.createElement('p');p2.style.margin='10px 0 0';p2.textContent=d.formSaveHint||'';status.appendChild(p2);
    const row=document.createElement('p');row.style.cssText='margin:6px 0 0;display:flex;flex-wrap:wrap;gap:8px';
    const wa=document.createElement('a');wa.href='https://wa.me/?text='+encodeURIComponent((d.formWaText||'')+' '+link);wa.target='_blank';wa.rel='noopener';wa.className='btn btn-outline';wa.textContent=d.formWa||'WhatsApp';
    const cp=document.createElement('button');cp.type='button';cp.className='btn btn-outline';cp.textContent=d.formCopy||'Copy';cp.onclick=()=>{(navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(()=>{cp.textContent=d.formCopied||'OK'}).catch(()=>{window.prompt('',link)})};
    row.appendChild(wa);row.appendChild(cp);status.appendChild(row);
    if(window.scSaveUpit)window.scSaveUpit(res.token,{model:v('model'),created:Date.now()})}contactForm.reset()}
else if(!primary.rejected&&(okN||(res&&res.ok))){if(status){status.className='form-status ok';status.textContent=d.formSuccess}contactForm.reset()}
else if(status){status.className='form-status err';const rejectedField=primary.rejected&&(primary.reason==='full_name'?nameField:primary.reason==='phone'?phoneField:null);const message=rejectedField?(primary.reason==='full_name'?contactMessages().name:contactMessages().phone):primary.rejected?(lang==='de'?'Ihre Anfrage wurde nicht angenommen. Prüfen Sie Ihre Angaben und versuchen Sie es erneut.':'Upit nije prihvaćen. Proverite podatke i pokušajte ponovo.'):d.formError;status.textContent=message;if(rejectedField){setContactValidity(rejectedField,false,message);rejectedField.focus();rejectedField.reportValidity();}}
if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=sendLabel}})}

const orderFormPanel = document.getElementById('order-form-panel');
if (orderFormPanel) {
  const orderFormMobile = window.matchMedia('(max-width: 760px)');
  const syncOrderForm = () => {
    if (!orderFormMobile.matches) orderFormPanel.open = true;
    else if (!orderFormPanel.querySelector('.form-status.ok')) orderFormPanel.open = location.hash === '#contact';
  };
  syncOrderForm();
  orderFormMobile.addEventListener('change', syncOrderForm);
  const openOrderForm = () => { orderFormPanel.open = true; };
  document.querySelectorAll('a[href="#contact"]').forEach(link => link.addEventListener('click', openOrderForm));
  if (location.hash === '#contact') openOrderForm();
  window.addEventListener('hashchange', () => { if (location.hash === '#contact') openOrderForm(); });
}

// Saved tracking links belong to this browser, without a customer account.
(function () {
  const key = 'sc_my_upiti', legacyKey = 'sc_my_upit', removedKey = 'sc_removed_upiti';
  const statuses = ['active','closed','finished','unknown'];
  const validToken = token => typeof token === 'string' && /^[a-f0-9]{24}$/.test(token);
  const stateOf = data => {
    if (!data || typeof data !== 'object') return 'unknown';
    if (data.status === 'odustao') return 'closed';
    if (['predato','kupio'].includes(data.status) || data.car?.status === 'prodat') return 'finished';
    return ['novo','kontakt','kontaktiran','trazimo','ponudjeno','kapara','pregled','kupljeno','transport','carina','priprema','prodaja'].includes(data.status) ? 'active' : 'unknown';
  };
  let saved = [], removed = new Set();
  const pending = new Map(), revisions = new Map();
  let refreshInFlight = null;
  const bump = token => revisions.set(token, (revisions.get(token) || 0) + 1);
  const timestamp = value => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) < 8640000000000000 ? Number(value) : 0;
  const read = (name, fallback) => { try { return JSON.parse(localStorage.getItem(name) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  function readStorage() {
    const excluded = read(removedKey, []);
    removed = new Set(Array.isArray(excluded) ? excluded.filter(validToken) : []);
    const stored = read(key, []), legacy = read(legacyKey, null);
    const entries = Array.isArray(stored) ? stored.slice() : [];
    if (legacy && validToken(legacy.t) && !entries.some(item => item?.t === legacy.t)) entries.push(legacy);
    const seen = new Set();
    saved = entries.filter(item => item && validToken(item.t) && !removed.has(item.t) && !seen.has(item.t) && seen.add(item.t)).map(item => ({
      t:item.t, model:String(item.model || '').slice(0,160), created:timestamp(item.created), at:timestamp(item.at),
      state:statuses.includes(item.state) ? item.state : 'unknown', checkedAt:timestamp(item.checkedAt)
    }));
  }
  function persist() {
    try {
      localStorage.setItem(removedKey, JSON.stringify([...removed]));
      localStorage.setItem(key, JSON.stringify(saved));
      const legacy = read(legacyKey, null);
      if (legacy && removed.has(legacy.t)) localStorage.removeItem(legacyKey);
    } catch (_) {}
  }
  function labels() {
    return ({
      sr:{locale:'sr-Latn-RS',title:'Upiti',request:'Upit',device:'Sačuvano u ovom browseru',menu:'Otvori meni',active:'Aktivan',closed:'Neaktivan — zatvoren',finished:'Neaktivan — završen',unknown:'Status nije potvrđen',checking:'Proveravamo status',remove:'Ukloni iz ovog browsera',removed:'Link je uklonjen iz ovog browsera. Upit i razgovor ostaju u evidenciji.'},
      de:{locale:'de-CH',title:'Anfragen',request:'Anfrage',device:'In diesem Browser gespeichert',menu:'Menü öffnen',active:'Aktiv',closed:'Inaktiv — geschlossen',finished:'Inaktiv — abgeschlossen',unknown:'Status nicht bestätigt',checking:'Status wird geprüft',remove:'Aus diesem Browser entfernen',removed:'Der Link wurde aus diesem Browser entfernt. Anfrage und Nachrichten bleiben erhalten.'},
      en:{locale:'en-GB',title:'Requests',request:'Request',device:'Saved in this browser',menu:'Open menu',active:'Active',closed:'Inactive — closed',finished:'Inactive — completed',unknown:'Status unconfirmed',checking:'Checking status',remove:'Remove from this browser',removed:'The link was removed from this browser. The request and conversation remain on record.'}
    })[document.documentElement.lang || 'sr'] || {locale:'sr-Latn-RS',title:'Upiti',request:'Upit',device:'Sačuvano u ovom browseru',menu:'Otvori meni',active:'Aktivan',closed:'Neaktivan — zatvoren',finished:'Neaktivan — završen',unknown:'Status nije potvrđen',checking:'Proveravamo status',remove:'Ukloni iz ovog browsera',removed:'Link je uklonjen iz ovog browsera. Upit i razgovor ostaju u evidenciji.'};
  }
  function announce(text) {
    let live = document.querySelector('.nav-request-feedback');
    if (!live) { live=document.createElement('span');live.className='nav-request-feedback';live.setAttribute('role','status');document.body.appendChild(live); }
    live.textContent = text;
  }
  function forget(token) {
    readStorage();
    const item = saved.find(entry => entry.t === token);
    if (!item || !['closed','finished'].includes(item.state)) return;
    bump(token);removed.add(token); saved = saved.filter(entry => entry.t !== token);
    pending.get(token)?.abort(); persist(); renderSaved(); announce(labels().removed);
  }
  function renderSaved() {
    const nav = document.querySelector('.nav'); if (!nav) return;
    const text = labels(), toggle = document.querySelector('.nav-toggle');
    let menu = nav.querySelector('[data-my-upit]'), badge = toggle?.querySelector('.nav-request-count');
    if (!saved.length) { menu?.remove();badge?.remove();toggle?.setAttribute('aria-label',text.menu);return; }
    if (toggle) {
      if (!badge) { badge=document.createElement('span');badge.className='nav-request-count';badge.setAttribute('aria-hidden','true');toggle.appendChild(badge); }
      badge.textContent=String(saved.length);toggle.setAttribute('aria-label',text.menu+'; '+text.title+': '+saved.length);
    }
    if (!menu) {
      menu=document.createElement('details');menu.className='nav-requests';menu.dataset.myUpit='1';
      const summary=document.createElement('summary');menu.appendChild(summary);
      const list=document.createElement('div');list.className='nav-requests-list';menu.appendChild(list);
      menu.addEventListener('toggle',()=>{if(menu.open)refreshSaved(true);});
      nav.insertBefore(menu,nav.querySelector('.nav-team-portal'));
    }
    menu.querySelector('summary').textContent=text.title+' ('+saved.length+')';
    const list=menu.querySelector('.nav-requests-list');list.replaceChildren();
    const hint=document.createElement('small');hint.textContent=text.device;list.appendChild(hint);
    const rank = state => state === 'active' ? 0 : state === 'unknown' ? 1 : 2;
    saved.slice().sort((a,b)=>rank(a.state)-rank(b.state)||(b.created||b.at)-(a.created||a.at)).forEach(item=>{
      const row=document.createElement('div');row.className='nav-request-row';
      const link=document.createElement('a');link.href='/upit/#'+item.t;
      link.addEventListener('click',()=>{nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false');});
      const title=document.createElement('strong');title.textContent=item.model || text.request;link.appendChild(title);
      if(item.created||item.at){const date=document.createElement('small');date.textContent=new Date(item.created||item.at).toLocaleString(text.locale,{day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});link.appendChild(date);}
      const status=document.createElement('span');status.className='nav-request-status is-'+item.state;status.textContent=pending.has(item.t)&&item.state==='unknown'?text.checking:text[item.state];link.appendChild(status);
      if(location.pathname.indexOf('/upit')===0&&location.hash.slice(1)===item.t)link.setAttribute('aria-current','page');
      row.appendChild(link);
      if(['closed','finished'].includes(item.state)){
        const remove=document.createElement('button');remove.type='button';remove.className='nav-request-remove';remove.textContent=text.remove;remove.setAttribute('aria-label',text.remove+': '+(item.model||text.request));
        remove.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();forget(item.t);});row.appendChild(remove);
      }
      list.appendChild(row);
    });
  }
  function refreshSaved(force=false) {
    if(refreshInFlight)return refreshInFlight;
    readStorage();
    const work=saved.filter(item=>!pending.has(item.t)&&(force||!item.checkedAt||Date.now()-item.checkedAt>60000)).map(item=>item.t);
    let next=0;
    refreshInFlight=Promise.all(Array.from({length:Math.min(3,work.length)},async()=>{
      while(next<work.length){const token=work[next++];readStorage();if(removed.has(token)||!saved.some(entry=>entry.t===token))continue;
        const revision=revisions.get(token)||0,started=Date.now(),controller=new AbortController();pending.set(token,controller);renderSaved();let timer;
        try {
          timer=setTimeout(()=>controller.abort(),8000);
          const response=await fetch(SC_URL+'/rest/v1/rpc/sc_order_view',{method:'POST',headers:{apikey:SC_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_token:token}),signal:controller.signal,cache:'no-store',credentials:'omit'});
          if(!response.ok)throw Error('status_unavailable');
          const data=await response.json();readStorage();const current=saved.find(entry=>entry.t===token);
          if(current&&!removed.has(token)&&(revisions.get(token)||0)===revision&&current.checkedAt<=started){current.state=stateOf(data);current.checkedAt=Date.now();if(typeof data?.model==='string')current.model=data.model.slice(0,160);if(timestamp(data?.created))current.created=timestamp(data.created);persist();}
        }catch(_){readStorage();const current=saved.find(entry=>entry.t===token);if(current&&!removed.has(token)&&(revisions.get(token)||0)===revision&&current.checkedAt<=started){current.state='unknown';current.checkedAt=Date.now();persist();}}
        finally{clearTimeout(timer);pending.delete(token);renderSaved();}
      }
    })).finally(()=>{refreshInFlight=null;});
    return refreshInFlight;
  }
  window.scSaveUpit = (token, info = {}, options = {}) => {
    if(!validToken(token))return;readStorage();
    const automatic=options.automatic===true||(options.automatic!==false&&location.pathname.indexOf('/upit')===0&&location.hash.slice(1)===token);
    if(removed.has(token)&&automatic)return;
    if(!automatic)removed.delete(token);
    bump(token);
    let item=saved.find(entry=>entry.t===token);
    if(!item){item={t:token,at:Date.now(),created:0,model:'',state:'unknown',checkedAt:0};saved.push(item);}
    if(info.model)item.model=String(info.model).slice(0,160);if(timestamp(info.created))item.created=timestamp(info.created);
    if(typeof info.status==='string'){item.state=stateOf(info);item.checkedAt=Date.now();}
    persist();renderSaved();
  };
  window.addEventListener('storage',event=>{if([key,legacyKey,removedKey].includes(event.key)){for(const token of pending.keys())bump(token);readStorage();renderSaved();}});
  window.addEventListener('focus',()=>refreshSaved());
  document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>setTimeout(renderSaved,0)));
  readStorage();renderSaved();refreshSaved();
})();

document.addEventListener("sc-service-prices-ready",()=>applyLanguage(document.documentElement.lang||"sr"));
