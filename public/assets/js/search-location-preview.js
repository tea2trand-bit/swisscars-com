(() => {
  'use strict';
  Object.assign(window.EV_DICT || {}, {
    'Područje': ['Suchgebiet','Search area'],
    'PLZ i radijus': ['PLZ und Umkreis','Postal code and radius'],
    'PLZ': ['PLZ','Postal code'],
    'Radijus, km': ['Umkreis, km','Radius, km'],
    'Maks. km': ['Max. km','Max. km'],
    'Izaberi radijus': ['Umkreis wählen','Choose radius'],
    'Unesi PLZ': ['PLZ eingeben','Enter postal code'],
    'Unesi km': ['km eingeben','Enter km'],
    'Bez PLZ-a: cela Švajcarska.': ['Ohne PLZ: ganze Schweiz.','No postal code: all Switzerland.'],
    'Unesi PLZ za izabrani radijus.': ['PLZ für den gewählten Umkreis eingeben.','Enter a postal code for the selected radius.']
  });
  function install() {
    const form=document.getElementById('companyManualSearch');
    const radius=form?.querySelector('[name="radiusKm"]');
    if (!radius?.closest('label')) return false;
    if (document.getElementById('companySearchArea')) return true;
    const postal=form.querySelector('[name="postalCode"]'), city=form.querySelector('[name="city"]');
    const postalField=postal.closest('label'), radiusField=radius.closest('label');
    const group=document.createElement('div'); group.className='search-area'; group.id='companySearchArea'; group.setAttribute('role','group'); group.setAttribute('aria-label','Područje');
    city.closest('label').before(group); city.closest('label').hidden=true; city.value='';
    postalField.firstChild.textContent='PLZ'; postal.placeholder='Unesi PLZ'; postal.pattern='[1-9][0-9]{3}';
    radiusField.firstChild.textContent='Radijus, km';
    const hint=document.createElement('span'); hint.className='search-area-hint';hint.id='companySearchAreaHint';hint.textContent='Bez PLZ-a: cela Švajcarska.';
    postal.setAttribute('aria-describedby',hint.id);group.append(postalField,radiusField,hint);
    let hadPostal=postal.value.trim()!=='';
    function update(event) {
      const active=postal.value.trim()!=='';
      const clear=event?.target===postal && hadPostal && !active && radius.value!=='';
      if(clear)radius.value='';
      hadPostal=active;
      postal.disabled=false;postal.required=radius.value!=='';radius.disabled=false;radius.required=active;
      hint.textContent=radius.value && !active?'Unesi PLZ za izabrani radijus.':'Bez PLZ-a: cela Švajcarska.';
      if(clear)radius.dispatchEvent(new Event('change',{bubbles:true}));
      window.EV?.apply();
    }
    postal.addEventListener('input',update);postal.addEventListener('change',update);radius.addEventListener('change',update);form.addEventListener('reset',()=>queueMicrotask(update));update();
    return true;
  }
  if(!install()) { const observer=new MutationObserver(()=>{if(install())observer.disconnect();}); observer.observe(document.getElementById('companyManualSearch'),{childList:true,subtree:true}); }
})();
