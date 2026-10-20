/* Local demonstration only. Never included in the production release. */
(() => {
  if(!window.SCProposalRecord?.id)return;
  const storageKey='swiscars.proposal-draft:'+window.SCProposalRecord.id;
  const form = document.getElementById('contact-form');
  if (form) {
    const notice = document.createElement('p');
    notice.className = 'local-inquiry-notice';
    notice.textContent = 'Lokalna proba — upit se prikazuje samo ovde, bez slanja poruke.';
    document.querySelector('.simple-heading').append(notice);
    const submit = form.querySelector('[type="submit"]');
    submit.removeAttribute('data-i18n');
    submit.textContent = 'Prikaži upit na lokalnoj kartici';
    window.addEventListener('submit', event => {
      if (event.target !== form) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const read = key => String(data.get(key) || '').trim();
      const record = {localPreview: true, createdAt: Date.now()};
      for (const key of ['brand','model','budget','yearFrom','fuel','gearbox','body','drive','color','mileage','when','notes','name','city','phone','email']) record[key] = read(key);
      record.equip = data.getAll('equip').map(String);
      localStorage.setItem(storageKey, JSON.stringify(record));
      location.assign('/predlog-kartice/?proba=upit');
    }, true);
  }
  let record={...window.SCProposalRecord,localPreview:true};
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved?.localProposal)record.localProposal=saved.localProposal;}catch{}
  document.body.classList.remove('awaiting-request');
  const text = (id, value) => { document.getElementById(id).textContent = value; };
  const money = Number(record.budget.replace(/[\s.]/g, '').replace(',', '.'));
  const vehicle = [record.brand, record.model].filter(Boolean).join(' ');
  const mileageLimit=Number(String(record.mileage||'').replace(/[^0-9]/g,''));
  const criteria = [vehicle, record.yearFrom ? 'od ' + record.yearFrom + '.' : '', mileageLimit?'do '+mileageLimit.toLocaleString('sr-RS')+' km':record.mileage, record.fuel, record.gearbox,record.color?'boja: '+record.color:'',Array.isArray(record.equip)&&record.equip.length?'oprema: '+record.equip.join(', '):'', Number.isFinite(money) ? 'budžet do ' + money.toLocaleString('sr-RS') + ' €' : ''].filter(Boolean);
  document.body.classList.add('from-inquiry');
  document.querySelector('.job-card').setAttribute('aria-label', 'Upit ' + record.name);
  document.querySelector('.customer strong').textContent = record.name;
  document.querySelector('.request-line strong').textContent = criteria.join(' · ');
  const requestLine=document.querySelector('.request-line');requestLine.classList.add('identity-request-line');
  document.querySelector('.vehicle').append(requestLine);
  document.querySelector('.vehicle-top').hidden=true;
  text('service-name', 'Pronalazak auta');
  text('vehicle-title', vehicle);
  text('location', '');
  document.querySelector('.vehicle-label').textContent = 'Željeno vozilo:';
  document.querySelector('.price').hidden = true;
  document.getElementById('ad').hidden = true;
  text('current-task', 'Čekanje ponuda vozila');
  text('checks-toggle', 'Dodaj predlog vozila →');
  document.querySelector('.simulation').textContent = 'Potraga u toku. Pripremite predlog iz oglasa, proverite podatke i obračun pre slanja.';
  const currentLabel = document.querySelector('.next .label');
  currentLabel.textContent = 'Sledeći korak';
  const clientDecisionNotice=document.createElement('span');clientDecisionNotice.className='team-client-decision';clientDecisionNotice.hidden=true;currentLabel.before(clientDecisionNotice);
  const stepButtons = document.querySelectorAll('.flow button');
  stepButtons[1].textContent = 'Potraga u toku';
  const details = document.getElementById('checks');
  details.replaceChildren();
  const note = document.createElement('p');
  note.className = 'demo-note';
  note.textContent = 'Nacrt nije poslat klijentu.';
  const offerHeading = document.createElement('h3');
  offerHeading.textContent = 'Dodaj predlog vozila';
  const offerNote = document.createElement('p');
  offerNote.className = 'demo-note';
  offerNote.textContent = 'Nalepi link oglasa. Link ostaje timu; klijent dobija SWISCARS predlog bez izvornog oglasa.';
  const offerForm = document.createElement('form');
  offerForm.className = 'local-offer-form';
  offerForm.innerHTML = '<div class="local-link-entry"><label>Interni link oglasa<input name="url" type="url" required autocomplete="off"></label><button class="secondary" type="button" data-read-listing>Učitaj oglas</button><p class="demo-note" role="status" data-read-result>Podržani su javni oglasi sa Comparis i AutoScout24. Link se ne prikazuje klijentu.</p></div><details class="local-loaded-fields"><summary>Proveri podatke vozila</summary><div class="local-offer-fields"><label>Naziv vozila<input name="title" required></label><label>Godište<input name="year" type="number" min="1900" max="2100" required></label><label>Kilometraža<input name="mileage" type="number" min="0" required></label><label>Cena auta, CHF<input name="price" type="number" min="0.01" step="0.01" required></label><label>Mesto vozila<input name="place" required></label></div></details><div class="local-offer-actions"><button class="secondary" type="button" data-client-preview>Prikaz za klijenta</button><button class="primary" type="button" data-save-offer>Sačuvaj nacrt</button></div><p role="status" class="demo-note" data-save-result></p>';
  const readButton = offerForm.querySelector('[data-read-listing]');
  const publishButton=document.createElement('button');publishButton.type='button';publishButton.className='primary';publishButton.textContent='Pošalji predlog klijentu';publishButton.disabled=true;
  offerForm.querySelector('.local-offer-actions').append(publishButton);
  offerForm.addEventListener('input',()=>{currentQuote=null;publishButton.disabled=true;});
  publishButton.onclick=()=>{
    if(!offerForm.reportValidity()||!currentQuote||currentQuote.adChf!==Number(offerForm.elements.price.value))return;
    publishButton.disabled=true;
    parent.postMessage({type:'swiscars-proposal-publish',fields:Object.fromEntries(new FormData(offerForm)),equipment:listingEquipment,photos:listingPhotos,quote:currentQuote},location.origin);
  };
  window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='swiscars-proposal-published')return;offerForm.querySelector('[data-save-result]').textContent=event.data.ok?'Predlog je objavljen na linku klijenta.':event.data.error||'Predlog nije sačuvan.';publishButton.disabled=!!event.data.ok;});

  let currentQuote=null;
  let listingPhotos=[];
  let listingEquipment={optional:[],standard:[],extra:[],complete:false};
  let listingDetailsRead=false,listingDescriptionComplete=null;
  const detailNames=['color','interiorColor','fuel','transmission','drive','body','power','accident','mfk','mfkDate','description'];
  const detailLabels={color:'Boja spolja — iz oglasa',interiorColor:'Boja unutrašnjosti',fuel:'Gorivo',transmission:'Menjač',drive:'Pogon',body:'Karoserija',power:'Snaga',accident:'Havarisano vozilo — navod prodavca (Ja / Nein)',mfk:'Ab MFK — navod prodavca (Ja / Nein)',mfkDate:'Datum poslednjeg MFK',description:'Opis prodavca — original'};
  for(const name of detailNames){const label=document.createElement('label'),input=document.createElement(name==='description'?'textarea':'input');label.textContent=detailLabels[name];input.name=name;if(name==='description')input.rows=4;label.append(input);offerForm.querySelector('.local-offer-fields').append(label);}
  const equipmentLabel=document.createElement('label'),equipmentInput=document.createElement('textarea');equipmentLabel.className='local-equipment-input';equipmentLabel.textContent='Oprema — original iz oglasa, jedna stavka po redu';equipmentInput.name='equipmentText';equipmentInput.rows=6;equipmentLabel.append(equipmentInput);offerForm.querySelector('.local-offer-fields').append(equipmentLabel);
  equipmentInput.addEventListener('input',()=>{listingEquipment={optional:[],standard:[],extra:equipmentInput.value.split('\n').map(s=>s.trim()).filter(Boolean),complete:false};});
  let manualMode=false;
  const loadedFields=offerForm.querySelector('.local-loaded-fields');
  const offerActions=offerForm.querySelector('.local-offer-actions');
  loadedFields.hidden=true;
  offerActions.hidden=true;
  const manualLabel=document.createElement('label');
  manualLabel.className='local-manual-option';
  const manualToggle=document.createElement('input');manualToggle.type='checkbox';
  const manualText=document.createElement('span');manualText.textContent='Vozilo nije na oglasu — ručni unos';
  manualLabel.append(manualToggle,manualText);
  offerForm.querySelector('.local-link-entry').after(manualLabel);
  manualToggle.addEventListener('change',()=>{
    manualMode=manualToggle.checked;
    clearLoadedVehicle();
    offerForm.elements.url.required=!manualMode;
    offerForm.querySelector('.local-link-entry').hidden=manualMode;
    loadedFields.hidden=!manualMode;loadedFields.open=manualMode;
    loadedFields.querySelector('summary').textContent=manualMode?'Podaci vozila — ručni unos':'Učitani podaci vozila';
    offerActions.hidden=!manualMode;
  });
  const readStatus = offerForm.querySelector('[data-read-result]');
  function setListingStatus(kind, title, message) {
    readStatus.className='listing-import-status listing-import-status--'+kind;
    readStatus.setAttribute('role',kind==='error'?'alert':'status');
    readStatus.setAttribute('aria-live',kind==='error'?'assertive':'polite');
    readStatus.replaceChildren();
    const heading=document.createElement('strong'),body=document.createElement('span');
    heading.textContent=title;body.textContent=message;
    readStatus.append(heading,body);
  }
  setListingStatus('info','Uvoz oglasa','Unesi AutoScout24 link. Za ovo dugme potreban je uključen SWISCARS čitač u ovom Chrome-u. Podatke iz oglasa proveri pre čuvanja. Link ostaje samo timu.');
  function clearLoadedVehicle() {
    for (const name of ['title','year','mileage','price','place',...detailNames,'equipmentText']) offerForm.elements[name].value='';
    listingPhotos=[];
    listingEquipment={optional:[],standard:[],extra:[],complete:false};
    listingDetailsRead=false;listingDescriptionComplete=null;
    offerForm.querySelector('[data-save-result]').textContent='';
  }
  function beginNewImport() {
    const saved=details.querySelector('.local-offer-saved');
    if(saved)saved.hidden=true;
    offerHeading.textContent='Uvoz novog oglasa';
    document.querySelector('.simulation').textContent='Provera novog linka. Novi podaci još nisu učitani; klijentu ništa nije poslato.';
    text('current-task','Priprema novog predloga');
    text('checks-toggle','Uvoz oglasa →');
    clientDecisionNotice.hidden=true;
    stepButtons[1].textContent='Potraga u toku';
    stepButtons.forEach((button,index)=>{const li=button.closest('li');li.className=index===0?'done':index===1?'current':'';button.disabled=index!==1;li.removeAttribute('aria-current');if(index===1)li.setAttribute('aria-current','step');});
    nextVerification.hidden=true;
  }
  offerForm.elements.url.addEventListener('input', () => {
    beginNewImport();
    clearLoadedVehicle();
    loadedFields.hidden=true;offerActions.hidden=true;
    setListingStatus('info','Novi link je unet','Klikni „Učitaj oglas“. Podaci prethodnog oglasa nisu preneti u ovaj unos.');
  });
  const tryAnother = document.createElement('button');
  tryAnother.type='button';tryAnother.className='secondary';tryAnother.textContent='Isprobaj drugi link';tryAnother.hidden=true;
  offerForm.querySelector('.local-offer-actions').append(tryAnother);
  tryAnother.addEventListener('click', () => {
    beginNewImport();
    offerNote.textContent='Link oglasa unosi se u „Interni link oglasa“, a za vozilo bez oglasa bira se „Vozilo nije na oglasu — ručni unos“.';
    manualMode=false;manualToggle.checked=false;manualLabel.hidden=false;offerActions.hidden=true;
    offerForm.elements.url.required=true;
    clearLoadedVehicle();offerForm.elements.url.value='';
    offerForm.querySelector('.local-link-entry').hidden=false;
    offerForm.querySelector('.local-loaded-fields').hidden=true;
    offerForm.querySelector('.local-loaded-fields').open=false;
    offerForm.querySelector('[data-save-offer]').hidden=false;
    tryAnother.hidden=true;
    setListingStatus('info','Spremno za novi link','Nalepi javni link pa klikni „Učitaj oglas“. Postojeći sačuvani predlog ostaje nepromenjen.');
    offerForm.elements.url.focus();
  });
  const reasons={
    extension_missing:'SWISCARS čitač nije povezan sa ovom karticom. Otvori je u običnom Chrome-u sa uključenom ekstenzijom „SWISCARS čitač oglasa (lokalno)”, pa osveži stranicu. Podaci i fotografije nisu učitani.',
    extension_disconnected:'Veza sa SWISCARS čitačem je prekinuta (ekstenzija je isključena ili ponovo učitana). Pokušaj ponovo.',
    tab_closed:'Kartica oglasa je zatvorena pre kraja čitanja. Podaci i fotografije nisu učitani.',
    invalid_url:'Link nije ispravan AutoScout24 oglas (/de/d/…). Podaci nisu učitani.',
    unsupported_source:'Uvoz sa ovog sajta još nije podržan. Podaci i fotografije nisu učitani.',
    cloud_not_configured:'Veza sa Browser Use nalogom još nije podešena na lokalnom serveru. Podaci i fotografije nisu učitani.',
    bridge_auth:'Netlify veza još nema potvrđen pristup cloud čitaču. Podaci i fotografije nisu učitani.',
    bridge_not_configured:'Adresa Netlify čitača nije pravilno podešena. Podaci i fotografije nisu učitani.',
    source_blocked:'Izvor je prikazao proveru pristupa koja se nije sama završila, pa je čitanje zaustavljeno (provera se ne rešava automatski). Podaci i fotografije nisu učitani.',
    detail_parser_not_ready:'Cloud veza postoji, ali uvoz pojedinačnog oglasa sa ovog izvora još nije pripremljen.',
    reader_busy:'Drugi oglas se trenutno učitava. Sačekaj njegov završetak pre novog pokušaja.',
    browser_cleanup_failed:'Cloud browser nije potvrdio zatvaranje. Nova čitanja treba zaustaviti dok se ne proveri sesija.',
    invalid_snapshot:'Snimak strane iz brauzera nije prepoznat. Otvori oglas ponovo i klikni obeleživač još jednom.',
    reader_offline:'Lokalni čitač (port 4194) nije pokrenut. Pokreni „node listing-reader.mjs“ pa ponovi.',
    local_browser_not_found:'Na ovom računaru nije pronađen Chrome ni Edge. Podesi LOCAL_CHROME_PATH za lokalni čitač.',
    local_browser_exited:'Lokalni brauzer se zatvorio pre čitanja oglasa. Pokušaj ponovo.',
    navigation_failed:'Oglas nije mogao da se otvori (mreža ili pogrešan link). Podaci i fotografije nisu učitani.',
    unexpected_redirect:'Oglas je preusmeren na drugu adresu. Podaci nisu učitani.',
    access_check_timeout:'Provera izvora nije završena u roku od 3 minuta, pa je čitanje zatvoreno. Podaci i fotografije nisu učitani. Klikni ponovo „Učitaj oglas“ i potvrdi proveru u prozoru čitača.',
    cancelled:'Čitanje je prekinuto. Podaci i fotografije nisu učitani.',
    browser_disconnected:'Prozor čitača je zatvoren pre kraja čitanja. Podaci i fotografije nisu učitani.'
  };
  const names = {title:'naziv',year:'godište',mileage:'kilometraža',price:'cena',place:'mesto',photos:'fotografije',...detailLabels};
  function applyListingResult(result, mode) {
    // Only approved photo hosts; the same allowlist as the reader.
    listingPhotos=(result.fields.photos||[]).filter(value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='mapl-assets.b-cdn.net'||u.hostname.endsWith('.autoscout24.ch'));}catch{return false;}});
    for (const [key,value] of Object.entries(result.fields)) if (offerForm.elements[key]&&typeof value!=='object') offerForm.elements[key].value = value ?? '';
    listingEquipment=result.fields.equipment||{optional:[],standard:[],extra:[],complete:false};
    listingDetailsRead=result.fields.detailsRead===true;
    listingDescriptionComplete=result.fields.descriptionComplete===true;
    equipmentInput.value=['optional','standard','extra'].flatMap(key=>listingEquipment[key]||[]).join('\n');
    document.querySelector('.simulation').textContent='Oglas je učitan. Proveri podatke i obračun; klijentu ništa nije poslato.';
    text('current-task','Provera učitanih podataka');
    const maxMileage = Number(String(record.mileage).replace(/[^0-9]/g,''));
    const mismatch = maxMileage > 0 && result.fields.mileage > maxMileage;
    const how = mode==='browser_capture' ? 'Učitano iz tvog brauzera (snimak otvorene strane oglasa). ' : mode==='extension' ? 'Učitano dugmetom preko SWISCARS čitača u ovom brauzeru. ' : mode==='local_browser' ? 'Učitano dugmetom: lokalni brauzer je otvorio oglas. ' : 'Učitano automatskim čitačem. ';
    setListingStatus('success','Podaci oglasa su učitani', how + listingPhotos.length + ' fotografija. Proveri pre čuvanja.' + (result.missing.length ? ' Nedostaje: ' + result.missing.map(key=>names[key]||key).join(', ') + '.' : '') + (mismatch ? ' Odstupanje: oglas ima ' + Number(result.fields.mileage).toLocaleString('sr-RS') + ' km, a zahtev je do ' + maxMileage.toLocaleString('sr-RS') + ' km.' : ''));
    loadedFields.hidden=false;offerActions.hidden=false;
    loadedFields.querySelector('summary').textContent='Učitani podaci vozila';
    offerForm.querySelector('.local-loaded-fields').open = true;
  }
  function showListingError(error) {
    setListingStatus('error',error.message==='extension_missing'?'SWISCARS čitač nije povezan':error.message==='cloud_not_configured'?'Cloud čitač nije povezan':'Greška pri učitavanju oglasa',reasons[error.message]||'Automatsko preuzimanje nije uspelo. To ne znači da oglas ne postoji ili da se ne otvara u brauzeru. Podaci i fotografije nisu učitani.');
    if(error.message==='extension_missing'){
      const link=document.createElement('a');link.href='/downloads/swiscars-citac-0.2.0.zip';link.textContent='Preuzmi čitač 0.2.0 za glavni sajt';link.download='swiscars-citac-0.2.0.zip';readStatus.append(link);
    }
  }
  readButton.addEventListener('click', async () => {
    const input = offerForm.elements.url;
    if (!input.reportValidity()) return;
    beginNewImport();
    readButton.disabled = true;
    loadedFields.hidden=true;offerActions.hidden=true;
    // The button reads through the SWISCARS reader extension in this (normal) browser:
    // it opens the link in a normal tab, reads the page after normal loading and returns
    // it here; the local reader only parses it. No demo data, no separate manual transfer.
    if(!window.SCReaderExtension?.available()){showListingError(Error('extension_missing'));readButton.disabled=false;return;}
    setListingStatus('loading','Učitavanje oglasa…','Oglas se otvara u novoj kartici ovog brauzera i zatvara se posle čitanja.');
    const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Prekini čitanje';
    cancel.onclick=()=>{cancel.disabled=true;window.SCReaderExtension.cancel();};
    try {
      const snapshot=await window.SCReaderExtension.read(input.value.trim(),{onStage:stage=>{
        if(stage==='access_check'){
          setListingStatus('warning','Potrebna je tvoja potvrda u otvorenoj kartici','AutoScout traži ljudsku proveru. U kartici oglasa koja je sada otvorena potvrdi je sam; čitanje čeka do 3 minuta i nastavlja se samo od sebe. Ne zatvaraj tu karticu.');
          readStatus.append(cancel);
        }else if(stage==='access_check_cleared'){
          setListingStatus('loading','Provera je završena','Isto čitanje se nastavlja: preuzimam podatke i fotografije oglasa…');
        }
      }});
      const fields=window.SCListingSnapshotParser.readCapturedListing(snapshot);
      const result={ok:true,fields,missing:Object.entries(fields).filter(([,v])=>v===null||v==='').map(([k])=>k)};
      applyListingResult(result, 'extension');
    } catch (error) { showListingError(error); }
    finally { readButton.disabled = false; }
  });
  const clientDialog = document.createElement('dialog');
  clientDialog.className = 'local-client-dialog';
  clientDialog.innerHTML = '<p class="preview">Pregled predloga pre slanja</p><h2>SWISCARS predlog vozila</h2><div data-client-vehicle></div><p class="demo-note">Pregled pre slanja — odluku donosi klijent na svom linku.</p><button class="secondary" type="button">Zatvori</button>';
  document.body.append(clientDialog);
  clientDialog.querySelector('button').onclick = () => clientDialog.close();
  const photoDialog=document.createElement('dialog');photoDialog.className='local-photo-dialog';
  photoDialog.innerHTML='<div class="photo-dialog-top"><span data-photo-count></span><button type="button" class="secondary" data-photo-close>Zatvori fotografiju</button></div><div class="photo-viewer-frame"><img alt="Uvećana fotografija vozila" referrerpolicy="no-referrer"><button type="button" class="photo-arrow photo-arrow-left" data-photo-prev aria-label="Prethodna fotografija">‹</button><button type="button" class="photo-arrow photo-arrow-right" data-photo-next aria-label="Sledeća fotografija">›</button></div>';
  document.body.append(photoDialog);photoDialog.querySelector('[data-photo-close]').onclick=()=>photoDialog.close();
  offerForm.querySelector('[data-client-preview]').addEventListener('click', async () => {
    offerForm.querySelector('.local-loaded-fields').open = true;
    if (!offerForm.reportValidity()) return;
    const source = Object.fromEntries(new FormData(offerForm));
    // The client preview gets an explicit allowlist, never the internal source URL.
    const client = {title:source.title,year:source.year,mileage:source.mileage,price:source.price,photos:[...listingPhotos],equipment:listingEquipment};
    for(const key of detailNames)client[key]=key==='description'?window.SCListingDetails.publicDescription(source[key]):source[key];
    const root = clientDialog.querySelector('[data-client-vehicle]');
    root.replaceChildren();
    const title = document.createElement('h3'), specs = document.createElement('p');
    title.textContent = client.title;
    specs.textContent = client.year + ' · ' + Number(client.mileage).toLocaleString('sr-RS') + ' km';
    root.append(title,specs);
    const layout=document.createElement('div');layout.className='client-offer-layout';root.append(layout);
    const gallery=document.createElement('div');gallery.className='client-offer-gallery';layout.append(gallery);
    if(client.photos.length){
      let photoIndex=0;
      const imageButton=document.createElement('button');imageButton.type='button';imageButton.className='client-main-photo-button';imageButton.setAttribute('aria-label','Uvećaj fotografiju');
      const image=document.createElement('img');image.className='client-offer-main-photo';image.alt=client.title;image.src=client.photos[0];image.referrerPolicy='no-referrer';imageButton.append(image);
      const zoomLabel=document.createElement('span');zoomLabel.textContent='⤢ Uvećaj';imageButton.append(zoomLabel);gallery.append(imageButton);
      function zoomPhoto(index){photoIndex=(index+client.photos.length)%client.photos.length;photoDialog.querySelector('img').src=client.photos[photoIndex];photoDialog.querySelector('[data-photo-count]').textContent='Fotografija '+(photoIndex+1)+' od '+client.photos.length;}
      imageButton.onclick=()=>{zoomPhoto(photoIndex);photoDialog.showModal();};
      photoDialog.querySelector('[data-photo-prev]').onclick=()=>zoomPhoto(photoIndex-1);photoDialog.querySelector('[data-photo-next]').onclick=()=>zoomPhoto(photoIndex+1);
      const thumbs=document.createElement('div');thumbs.className='client-offer-thumbnails';gallery.append(thumbs);
      client.photos.forEach((url,index)=>{const button=document.createElement('button'),thumb=document.createElement('img');button.type='button';button.setAttribute('aria-label','Fotografija '+(index+1));button.setAttribute('aria-pressed',String(index===0));thumb.src=url;thumb.alt='';thumb.referrerPolicy='no-referrer';button.append(thumb);button.onclick=()=>{photoIndex=index;image.src=url;thumbs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));};thumbs.append(button);});
    }else{const missing=document.createElement('p');missing.textContent='Fotografije još nisu učitane. Predlog nije spreman za slanje.';gallery.append(missing);}
    const detailsContainer=document.createElement('div');detailsContainer.className='client-details-grid';layout.append(detailsContainer);
    const detailTools=window.SCListingDetails;
    function section(title){const s=document.createElement('section'),h=document.createElement('h3');s.className='client-vehicle-details';h.textContent=title;s.append(h);detailsContainer.append(s);return s;}
    function paragraph(parent,value,cls=''){const p=document.createElement('p');p.textContent=value;if(cls)p.className=cls;parent.append(p);return p;}
    function pair(parent,label,value){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value||'Podatak još nije preuzet';parent.append(dt,dd);}
    const specsSection=section('Podaci vozila'),specsList=document.createElement('dl');specsSection.append(specsList);
    const basicTranslations={Benzin:'Benzin',Diesel:'Dizel',Automat:'Automatik','Halbautomatisches Getriebe':'Poluautomatski menjač',Schaltgetriebe:'Manuelni menjač',Allrad:'Pogon na sva četiri točka',Vorderradantrieb:'Prednji pogon',Hinterradantrieb:'Zadnji pogon',Limousine:'Limuzina',Kombi:'Karavan'};
    for(const [label,value] of [['Spoljašnja boja',detailTools.color(client.color)],['Unutrašnjost',detailTools.color(client.interiorColor)],['Gorivo',basicTranslations[client.fuel]||client.fuel],['Menjač',basicTranslations[client.transmission]||client.transmission],['Pogon',basicTranslations[client.drive]||client.drive],['Karoserija',basicTranslations[client.body]||client.body],['Snaga',String(client.power||'').replace(/\bPS\b/g,'KS')]])pair(specsList,label,value);
    const wishesSection=section('Poređenje sa vašim željama');
    paragraph(wishesSection,'Traženo vozilo: '+vehicle+'.');
    const match=detailTools.colorMatch(record.color,client.color);
    paragraph(wishesSection,'Tražena boja: '+(record.color||'nije navedena u upitu')+'. Boja vozila: '+(detailTools.color(client.color)||'još nije preuzeta')+'.');
    if(match==='different')paragraph(wishesSection,'Boja odstupa od vaše želje.','local-offer-warning');
    else if(match==='unknown')paragraph(wishesSection,'Poklapanje boje zahteva potvrdu.');
    else if(match==='match')paragraph(wishesSection,'Boja odgovara navedenoj želji.','client-detail-match');
    if(Array.isArray(record.equip)&&record.equip.length){const ul=document.createElement('ul');for(const wish of record.equip){const li=document.createElement('li');li.textContent=wish+' — '+(detailTools.equipmentMatch(wish,listingEquipment)==='listed'?'navedeno u oglasu':'nije potvrđeno u preuzetom spisku');ul.append(li);}wishesSection.append(ul);}else paragraph(wishesSection,'Željena oprema nije navedena u upitu.');
    const conditionSection=section('Stanje vozila i tehnički pregled');
    paragraph(conditionSection,listingDetailsRead?detailTools.accident(client.accident):'Podatak o havariji još nije preuzet.',detailTools.normalize(client.accident)==='ja'?'local-offer-warning':'');
    paragraph(conditionSection,'Istorija štete nije nezavisno proverena.');
    paragraph(conditionSection,listingDetailsRead?detailTools.mfk(client.mfk,client.mfkDate):'MFK podaci još nisu preuzeti. Potrebno je novo čitanje izvornog oglasa.');
    const equipmentSection=section('Oprema navedena u oglasu');
    equipmentSection.classList.add('client-details-wide','client-equipment-section');
    paragraph(equipmentSection,'Navodi iz oglasa; prisustvo i ispravnost opreme potvrđujemo pregledom.');
    const equipmentCount=['optional','standard','extra'].reduce((n,k)=>n+(listingEquipment[k]||[]).length,0);
    if(!equipmentCount)paragraph(equipmentSection,'Spisak opreme nije preuzet. Oprema nije potvrđena.');
    else{
      if(!listingEquipment.complete)paragraph(equipmentSection,'Preuzet je skraćen spisak opreme. Dodatne stavke još nisu potvrđene.','local-offer-warning');
      const extra=listingEquipment.extra||[];if(extra.length){const ul=document.createElement('ul');ul.className='client-equipment-extras';for(const item of extra){const li=document.createElement('li');li.textContent=detailTools.equipmentLabel(item)+' ('+item+')';ul.append(li);}equipmentSection.append(ul);}
      for(const [key,title] of [['optional','Dodatna oprema'],['standard','Serijska oprema']]){if(!listingEquipment[key]?.length)continue;const h=document.createElement('h4'),ul=document.createElement('ul');h.textContent=title;for(const item of listingEquipment[key]){const li=document.createElement('li');li.textContent=detailTools.equipmentLabel(item);ul.append(li);}equipmentSection.append(h,ul);}
      const original=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Pogledaj izvorni tekst opreme (DE)';original.append(summary);for(const [key,title] of [['optional','Dodatna oprema'],['standard','Serijska oprema'],['extra','Dodatni navodi']]){if(!listingEquipment[key]?.length)continue;const h=document.createElement('h4'),ul=document.createElement('ul');h.textContent=title;for(const item of listingEquipment[key]){const li=document.createElement('li');li.textContent=item;ul.append(li);}original.append(h,ul);}equipmentSection.append(original);
    }
    const descriptionSection=section('Opis prodavca');
    descriptionSection.classList.add('client-details-wide');
    paragraph(descriptionSection,detailTools.descriptionLabel(client.description)||'Opis još nije preuzet.','client-seller-description');
    if(client.description&&detailTools.descriptionLabel(client.description)!==client.description){const original=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Pogledaj izvorni opis prodavca';original.append(summary);paragraph(original,client.description,'client-seller-description');descriptionSection.append(original);}
    if(client.description&&listingDescriptionComplete===false)paragraph(descriptionSection,'Preuzet je skraćen opis prodavca.','local-offer-warning');
    if(client.description)paragraph(descriptionSection,'Preneto iz oglasa. Navodi prodavca zahtevaju proveru.','demo-note');
    const quoteBox=document.createElement('div');quoteBox.className='client-offer-quote';layout.append(quoteBox);
    const quoteLabel=document.createElement('span'),total=document.createElement('strong'),quoteNote=document.createElement('p');
    quoteLabel.textContent='Procena do Srbije · sa paketom';total.textContent='Učitavam obračun…';quoteNote.className='demo-note';quoteBox.append(quoteLabel,total,quoteNote);
    const breakdown=document.createElement('details'),breakTitle=document.createElement('summary'),rows=document.createElement('dl');breakdown.className='client-offer-breakdown';breakTitle.textContent='Detalji obračuna';breakdown.append(breakTitle,rows);quoteBox.append(breakdown);
    const euro=n=>Number(n).toLocaleString('sr-RS',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
    const addRow=(label,value)=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;rows.append(dt,dd);};
    addRow('Cena auta u Švajcarskoj',Number(client.price).toLocaleString('sr-RS')+' CHF');
    const maxMileage = Number(String(record.mileage).replace(/[^0-9]/g,''));
    if (maxMileage > 0 && Number(client.mileage) > maxMileage) {
      const warning = document.createElement('p'); warning.className = 'local-offer-warning';
      warning.textContent = 'Odstupanje od vašeg zahteva: ' + Number(client.mileage).toLocaleString('sr-RS') + ' km umesto do ' + maxMileage.toLocaleString('sr-RS') + ' km.';
      wishesSection.append(warning);
    }
    const actions=document.createElement('div');actions.className='client-offer-decisions';
    const accept=document.createElement('button'),decline=document.createElement('button'),choiceStatus=document.createElement('p'),choiceHelp=document.createElement('p');
    accept.type=decline.type='button';accept.className='primary';decline.className='secondary';
    accept.textContent='Prihvatam predlog';decline.textContent='Ne prihvatam predlog';
    choiceStatus.className='client-choice-status';choiceStatus.setAttribute('role','status');choiceHelp.className='demo-note';choiceHelp.textContent='Prihvatanje vodi na proveru dokumenata i obračun cene pregleda.';
    actions.append(accept,decline);quoteBox.append(actions,choiceHelp,choiceStatus);
    let quoteReady=false;
    function renderChoice(){
      const value=record.localProposal?.url===source.url&&record.localProposal?.title===source.title?record.localProposal.clientDecision:null;
      quoteBox.classList.toggle('has-client-choice',!!value);
      actions.hidden=!!value;choiceHelp.hidden=true;
      accept.disabled=!quoteReady||!client.photos.length||!listingDetailsRead||value==='accepted';decline.disabled=value==='rejected';
      accept.setAttribute('aria-pressed',String(value==='accepted'));decline.setAttribute('aria-pressed',String(value==='rejected'));
      choiceStatus.hidden=!value;
      choiceStatus.dataset.choice=value||'';
      choiceStatus.textContent=value==='accepted'?'✓ Prihvaćeno':value==='rejected'?'Nije prihvaćeno':'';
    }
    function choose(value){
      record.localProposal={...source,detailsRead:listingDetailsRead,descriptionComplete:listingDescriptionComplete,equipment:listingEquipment,photos:[...client.photos],clientDecision:value,clientDecisionAt:value?Date.now():null};
      localStorage.setItem(storageKey,JSON.stringify(record));
      showLocalProposal(record.localProposal);renderChoice();
    }
    accept.onclick=()=>choose('accepted');decline.onclick=()=>choose('rejected');renderChoice();
    if(!clientDialog.open)clientDialog.showModal();
    try{
      let [prices,fx]=await Promise.all([window.SCServicePrices?.ready,window.SCFXReferenceClient?.ready]);
      if(!prices||!fx)[prices,fx]=await Promise.all([prices||window.SCServicePrices?.reload?.(),fx||window.SCFXReferenceClient?.load?.({timeoutMs:15000})]);
      const d=prices?.importDefaults;
      if(!fx)throw Error('fx_not_ready');
      if(!d||!Number.isFinite(prices.swissPackageCHF))throw Error('costs_not_ready');
      // Reuse the public calculator's defaults, including its bundled export setting.
      const costs={transport:d.transport??500,export:0,eco:d.eco??155,broker:d.broker??0,testing:d.testing??200,other:d.other??0,domestic:0,customs:null,packageChf:prices.swissPackageCHF};
      const q=window.SCListingQuote.calculate({adChf:Number(client.price)},costs,fx,{origin:false,vat:false});
      total.textContent=euro(q.total);currentQuote={total:q.total,packageChf:q.packageChf,adChf:Number(client.price)};publishButton.disabled=false;
      quoteReady=true;renderChoice();
      const c=q.quote.costs,a=q.scenario;
      for(const [label,value] of [['Vozilo preračunato u evre',q.quote.car],['Prevoz',c.transport],['Izvozna dokumenta',c.export],['Eko naknada — procena',c.eco],['Špediter — početna procena',c.broker],['Ispitivanje i takse — procena',c.testing],['Ostali troškovi — početna procena',c.other],['Carina prema kalkulatoru',a.duty],['PDV pri uvozu',a.vat],['SWISCARS paket ('+q.packageChf+' CHF)',q.serviceEur]])addRow(label,euro(value));
      addRow('Ukupno sa SWISCARS paketom',euro(q.total));
      addRow('Referentni kurs','1 CHF = '+fx.eurPerCHF.toLocaleString('sr-RS',{maximumFractionDigits:5})+' EUR · '+fx.asOf.split('-').reverse().join('.'));
      quoteNote.textContent='Sa prevozom, uvoznim dažbinama i SWISCARS paketom. Procena bez registracije.';
      const basis=document.createElement('p');basis.className='demo-note';basis.textContent='Početne procene iz našeg kalkulatora. Troškove i dokumentaciju potvrđujemo pre konačne ponude. Nisu uračunati nepotvrđeni povrat CH PDV-a ili olakšica za poreklo. Plaćeni pregled se uračunava u paket.';
      if(c.broker===0||c.other===0)basis.textContent+=' Špediter i ostali troškovi zahtevaju potvrdu ako nastanu dodatne stavke.';
      breakdown.append(basis);
    }catch(error){
      total.textContent='Obračun čeka potvrdu';
      quoteBox.dataset.quoteState=error.message;
      quoteNote.textContent=(error.message==='fx_not_ready'?'Referentni kurs trenutno nije dostupan. ':error.message==='costs_not_ready'?'Podešavanja troškova trenutno nisu dostupna. ':'Podaci obračuna zahtevaju proveru. ')+'Ukupan iznos nije izmišljen; cena auta ostaje samo u detaljima.';
      const retry=document.createElement('button');retry.type='button';retry.className='secondary';retry.textContent='Osveži obračun';retry.onclick=()=>offerForm.querySelector('[data-client-preview]').click();quoteBox.append(retry);
    }
  });
  const nextVerification=document.createElement('section');nextVerification.className='local-next-verification';nextVerification.hidden=true;
  nextVerification.innerHTML='<h3>Pre zakazivanja pregleda</h3><ol><li>Potvrdi da je vozilo dostupno.</li><li>Proveri dokumenta, dokaz porekla i mogućnost povrata CH PDV-a.</li><li>Obračunaj cenu pregleda — paušal i putni trošak.</li></ol><p class="demo-note">Poziv za uplatu sledi tek nakon potvrde cene pregleda. Izbor vozila ovde ostaje lokalna proba.</p>';
  details.append(offerHeading,offerNote,offerForm,nextVerification,note);
  function showLocalProposal(values) {
    const accepted=values.clientDecision==='accepted',rejected=values.clientDecision==='rejected',active=rejected?1:accepted?3:2;
    clientDecisionNotice.hidden=!accepted;clientDecisionNotice.textContent=accepted?'Klijent je prihvatio predlog.':'';
    document.querySelector('.simulation').textContent=accepted?'Lokalna proba — predlog prihvaćen za dalju proveru. Nije poslata poruka niti pokrenuta kupovina.':rejected?'Lokalna proba — predlog odbijen. Potraga se nastavlja prema početnom zahtevu.':'Nacrt je pripremljen; klijentu još nije poslat.';
    stepButtons[1].textContent=rejected?'Potraga u toku':'Potraga';
    text('current-task',accepted?'Provera dokumenata':rejected?'Potraga za drugim vozilom':'Klijent bira vozilo');
    text('checks-toggle',accepted?'Proveri dokumenta →':rejected?'Dodaj drugi predlog →':'Pogledaj predlog →');
    document.querySelector('.vehicle-label').textContent=accepted?'Izabrano vozilo:':'Željeno vozilo:';
    text('vehicle-title',accepted?values.title+' · '+values.year:vehicle);
    text('location',accepted?' · '+values.place:'');
    nextVerification.hidden=!accepted;
    stepButtons.forEach((button,index) => {
      const li = button.closest('li');
      li.className = index < active ? 'done' : index === active ? 'current' : '';
      li.removeAttribute('aria-current');
      button.disabled = index !== active;
      if (index === active) li.setAttribute('aria-current','step');
    });
    let saved = details.querySelector('.local-offer-saved');
    if (!saved) { saved = document.createElement('p'); saved.className = 'local-offer-saved'; offerHeading.after(saved); }
    saved.hidden=false;
    saved.textContent = 'Nacrt · nije poslato klijentu: ' + values.title + ' · ' + values.year + ' · ' + Number(values.mileage).toLocaleString('sr-RS') + ' km · ' + Number(values.price).toLocaleString('sr-RS') + ' CHF';
    try {
      const source=new URL(values.url);
      if(source.protocol==='https:'&&['www.autoscout24.ch','autoscout24.ch','www.comparis.ch','comparis.ch'].includes(source.hostname)&&!source.username&&!source.password&&!source.port){
        const sourceLink=document.createElement('a');sourceLink.className='local-offer-source';sourceLink.href=source.href;sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';sourceLink.textContent='Otvori izvorni oglas ↗';saved.append(document.createElement('br'),sourceLink);
      }
    }catch{}
    offerHeading.textContent = 'Sačuvan nacrt';
    for(const [key,value] of Object.entries(values))if(offerForm.elements[key]&&typeof value!=='object')offerForm.elements[key].value=value;
    listingPhotos=Array.isArray(values.photos)?values.photos:[];
    listingEquipment=values.equipment||{optional:[],standard:[],extra:[],complete:false};
    listingDetailsRead=values.detailsRead===true||['color','interiorColor','fuel','transmission','power','description'].every(key=>Object.prototype.hasOwnProperty.call(values,key));
    listingDescriptionComplete=typeof values.descriptionComplete==='boolean'?values.descriptionComplete:null;
    offerForm.hidden = false;
    manualMode=values.entryMode==='manual';manualToggle.checked=manualMode;
    offerForm.elements.url.required=!manualMode;
    manualLabel.hidden=!rejected;offerActions.hidden=false;
    offerForm.querySelector('.local-link-entry').hidden=!rejected;
    offerForm.querySelector('.local-loaded-fields').hidden=true;
    offerForm.querySelector('[data-save-offer]').hidden=!rejected;publishButton.hidden=false;
    tryAnother.hidden=rejected;
    offerNote.textContent = accepted?'Klijent je u ovoj probi izabrao vozilo. Pre uplate slede provera dokumenata i obračun pregleda.':rejected?'Predlog nije prihvaćen. Dodaj drugi oglas prema istom zahtevu klijenta.':'Sledeće je izbor klijenta. Pregled i uplata još nisu na redu. Predlog nije poslat klijentu.';
    if(rejected){clearLoadedVehicle();offerForm.elements.url.value='';offerForm.querySelector('.local-loaded-fields').open=false;}
  }
  offerForm.querySelector('[data-save-offer]').addEventListener('click',() => {
    offerForm.querySelector('.local-loaded-fields').open = true;
    if (!offerForm.reportValidity()) return;
    const values = Object.fromEntries(new FormData(offerForm));
    let url;
    try { if(!manualMode)url = new URL(values.url); } catch { return; }
    if (!manualMode&&!['https:','http:'].includes(url.protocol)) {
      offerForm.querySelector('[data-save-result]').textContent = 'Unesi link oglasa koji počinje sa https:// ili http://.';
      return;
    }
    record.localProposal = {...values,detailsRead:listingDetailsRead,descriptionComplete:listingDescriptionComplete,equipment:listingEquipment,entryMode:manualMode?'manual':'link',photos:[...listingPhotos],createdAt:Date.now()};
    localStorage.setItem(storageKey,JSON.stringify(record));
    offerForm.querySelector('[data-save-result]').textContent = 'Nacrt je sačuvan u ovom brauzeru. Klijentu nije poslat predlog.';
    showLocalProposal(record.localProposal);
  });
  document.querySelectorAll('.flow li').forEach((li,index) => {
    li.className = index === 0 ? 'done' : index === 1 ? 'current' : '';
    li.removeAttribute('aria-current');
    const button = li.querySelector('button');
    button.disabled = index !== 1;
    if (index === 1) li.setAttribute('aria-current','step');
    button.addEventListener('click',event => event.stopImmediatePropagation(),true);
  });
  if (record.localProposal) showLocalProposal(record.localProposal);
  document.getElementById('contact').addEventListener('click', event => {
    event.stopImmediatePropagation();
    text('info-title',record.name);
    parent.postMessage({type:'swiscars-proposal-contact'},location.origin);
  },true);
})();
