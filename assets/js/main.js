const buttons=document.querySelectorAll('[data-lang]');const navToggle=document.querySelector('.nav-toggle');const nav=document.querySelector('.nav');function applyLanguage(lang){const d=translations[lang]||translations.sr;document.documentElement.lang=lang;document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.getAttribute('data-i18n');if(d[k])el.textContent=d[k]});document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{const k=el.getAttribute('data-i18n-placeholder');if(d[k])el.setAttribute('placeholder',d[k])});document.querySelectorAll('[data-i18n-list]').forEach(el=>{const k=el.getAttribute('data-i18n-list');if(Array.isArray(d[k])){el.innerHTML='';d[k].forEach(x=>{const li=document.createElement('li');li.textContent=x;el.appendChild(li)})}});buttons.forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));localStorage.setItem('swiscars-lang',lang)}buttons.forEach(b=>b.addEventListener('click',()=>applyLanguage(b.dataset.lang)));navToggle.addEventListener('click',()=>{nav.classList.toggle('open');navToggle.setAttribute('aria-expanded',nav.classList.contains('open'))});document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');navToggle.setAttribute('aria-expanded','false')}));applyLanguage(localStorage.getItem('swiscars-lang')||'sr');document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',function(e){const id=this.getAttribute('href').slice(1);const target=document.getElementById(id);if(target){e.preventDefault();const top=target.getBoundingClientRect().top+window.pageYOffset-80;window.scrollTo({top:top,behavior:'smooth'})}}));
const SC_URL='https://qghrrnqsvsrcwdhgufkv.supabase.co',SC_KEY='sb_publishable_ouwn1r_BvZS9nWyg3vJHAQ_ApUagfSP';
const contactForm=document.getElementById('contact-form');if(contactForm){const status=contactForm.querySelector('.form-status');const submitBtn=contactForm.querySelector('button[type="submit"]');contactForm.addEventListener('submit',async function(e){e.preventDefault();const lang=localStorage.getItem('swiscars-lang')||'sr';const d=translations[lang]||translations.sr;const sendLabel=submitBtn?submitBtn.textContent:'';if(submitBtn){submitBtn.disabled=true;submitBtn.textContent=d.formSending||'...'}const fd=new FormData(contactForm);const v=k=>(fd.get(k)||'').toString();
const netlify=fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fd).toString()}).then(r=>r.ok).catch(()=>false);
const ours=fetch(SC_URL+'/rest/v1/rpc/sc_submit_order',{method:'POST',headers:{apikey:SC_KEY,'Content-Type':'application/json'},body:JSON.stringify({p:{name:v('name'),phone:v('phone'),email:v('email'),city:v('city'),budget:v('budget'),brand:v('brand'),model:v('model'),yearFrom:v('yearFrom'),fuel:v('fuel'),gearbox:v('gearbox'),body:v('body'),drive:v('drive'),color:v('color'),mileage:v('mileage'),when:v('when'),equip:fd.getAll('equip').map(String),notes:v('notes'),website:v('bot-field'),lang}})}).then(async r=>r.ok?r.json():null).catch(()=>null);
const [okN,res]=await Promise.all([netlify,ours]);
if(status){status.hidden=false}
if(res&&res.token){const link='https://swiscars.com/upit/#'+res.token;fetch(SC_URL+'/functions/v1/order-mail',{method:'POST',headers:{apikey:SC_KEY,'Content-Type':'application/json'},body:JSON.stringify({token:res.token})}).catch(()=>{});
  if(status){status.className='form-status ok';status.innerHTML='';const p1=document.createElement('span');p1.textContent=(d.formSuccessTrack||d.formSuccess)+' ';const a=document.createElement('a');a.href=link;a.textContent=d.formTrackLink||link;a.style.textDecoration='underline';status.appendChild(p1);status.appendChild(a);
    const p2=document.createElement('p');p2.style.margin='10px 0 0';p2.textContent=d.formSaveHint||'';status.appendChild(p2);
    const row=document.createElement('p');row.style.cssText='margin:6px 0 0;display:flex;flex-wrap:wrap;gap:8px';
    const wa=document.createElement('a');wa.href='https://wa.me/?text='+encodeURIComponent((d.formWaText||'')+' '+link);wa.target='_blank';wa.rel='noopener';wa.className='btn btn-outline';wa.textContent=d.formWa||'WhatsApp';
    const cp=document.createElement('button');cp.type='button';cp.className='btn btn-outline';cp.textContent=d.formCopy||'Copy';cp.onclick=()=>{(navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(()=>{cp.textContent=d.formCopied||'OK'}).catch(()=>{window.prompt('',link)})};
    row.appendChild(wa);row.appendChild(cp);status.appendChild(row);
    if(window.scSaveUpit)window.scSaveUpit(res.token,{model:v('model'),created:Date.now()})}contactForm.reset()}
else if(okN||(res&&res.ok)){if(status){status.className='form-status ok';status.textContent=d.formSuccess}contactForm.reset()}
else if(status){status.className='form-status err';status.textContent=d.formError}
if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=sendLabel}})}

// Saved tracking links belong to this browser, without a customer account.
(function () {
  const key = 'sc_my_upiti', legacyKey = 'sc_my_upit';
  const valid = x => x && /^[a-f0-9]{24}$/.test(x.t || '');
  let saved = [];
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    saved = Array.isArray(stored) ? stored.filter(valid) : [];
    const legacy = JSON.parse(localStorage.getItem(legacyKey) || 'null');
    if (valid(legacy) && !saved.some(x => x.t === legacy.t)) saved.push(legacy);
  } catch (e) {}
  saved = saved.filter((x, i, all) => all.findIndex(y => y.t === x.t) === i);
  function renderSaved() {
    const nav = document.querySelector('.nav');
    if (!nav || !saved.length) return;
    const old = nav.querySelector('[data-my-upit]'); if (old) old.remove();
    const lang = document.documentElement.lang || 'sr';
    const labels = {
      sr: { title: 'Moji upiti', request: 'Upit', device: 'Sačuvano u ovom browseru', menu: 'Otvori meni' },
      de: { title: 'Meine Anfragen', request: 'Anfrage', device: 'In diesem Browser gespeichert', menu: 'Menü öffnen' },
      en: { title: 'My requests', request: 'Request', device: 'Saved in this browser', menu: 'Open menu' }
    }[lang] || { title: 'Moji upiti', request: 'Upit', device: 'Sačuvano u ovom browseru' };
    const toggle = document.querySelector('.nav-toggle');
    if (toggle) {
      let badge = toggle.querySelector('.nav-request-count');
      if (!badge) { badge = document.createElement('span'); badge.className = 'nav-request-count'; badge.setAttribute('aria-hidden', 'true'); toggle.appendChild(badge); }
      badge.textContent = saved.length;
      toggle.setAttribute('aria-label', `${labels.menu || 'Otvori meni'}; ${labels.title}: ${saved.length}`);
    }
    const menu = document.createElement('details'); menu.className = 'nav-requests'; menu.dataset.myUpit = '1';
    const summary = document.createElement('summary'); summary.textContent = `${labels.title} (${saved.length})`;
    menu.appendChild(summary);
    const list = document.createElement('div'); list.className = 'nav-requests-list';
    const hint = document.createElement('small'); hint.textContent = labels.device; list.appendChild(hint);
    saved.slice().sort((a, b) => (b.created || b.at || 0) - (a.created || a.at || 0)).forEach((item, i) => {
      const link = document.createElement('a'); link.href = '/upit/#' + item.t;
      link.textContent = item.model || `${labels.request} ${saved.length - i}`;
      if (location.pathname.indexOf('/upit') === 0 && location.hash.slice(1) === item.t) link.setAttribute('aria-current', 'page');
      list.appendChild(link);
    });
    menu.appendChild(list); nav.insertBefore(menu, nav.querySelector('.nav-team-portal'));
  }
  window.scSaveUpit = (token, info = {}) => {
    if (!/^[a-f0-9]{24}$/.test(token || '')) return;
    const previous = saved.find(x => x.t === token);
    if (previous) {
      if (info.model) previous.model = String(info.model).slice(0, 160);
      if (info.created) previous.created = Number(info.created);
    } else saved.push({ t: token, at: Date.now(), model: String(info.model || '').slice(0, 160), created: Number(info.created) || 0 });
    try { localStorage.setItem(key, JSON.stringify(saved)); localStorage.setItem(legacyKey, JSON.stringify({ t: token, at: Date.now() })); } catch (e) {}
    renderSaved();
  };
  document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', renderSaved));
  renderSaved();
})();
