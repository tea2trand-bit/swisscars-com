/* Less visual noise; preserve field names, values, validators and submission handlers. */
(()=>{
  if(location.pathname!=='/pronalazak/')return;
  const forms=[...document.querySelectorAll('#contact-form,#listing-contact-form')];
  const text={
    sr:{brand:'Izaberite marku',optional:'Dodatne želje',note:'Napomena'},
    de:{brand:'Marke auswählen',optional:'Weitere Wünsche',note:'Anmerkung'},
    en:{brand:'Choose a make',optional:'More preferences',note:'Note'}
  };
  for(const form of forms){
    form.classList.add('luxury-empty-fields');
    for(const input of form.querySelectorAll('input:not([type=hidden]),textarea')){
      input.removeAttribute('placeholder');
      input.removeAttribute('data-i18n-placeholder');
    }
    const notes=form.querySelector('[name=notes]');
    if(notes){
      let optional=form.querySelector('.simple-optional');
      if(!optional){
        optional=document.createElement('details');optional.className='simple-optional';
        const summary=document.createElement('summary');summary.dataset.luxuryOptional='';optional.append(summary);
        const actions=form.querySelector('.simple-form-step .simple-form-actions');
        if(actions)actions.before(optional);else notes.before(optional);
      }
      const label=form.querySelector(`label[for="${notes.id}"]`);
      if(label){label.removeAttribute('data-i18n');label.dataset.luxuryNote='';optional.append(label);}
      optional.append(notes);
      if(notes.value.trim())optional.open=true;
    }
    const firstOption=form.querySelector('select[name=brand] option[value=""]');
    if(firstOption){firstOption.removeAttribute('data-i18n');firstOption.dataset.luxuryEmptyBrand='';}
  }
  function translate(){
    const t=text[document.documentElement.lang]||text.sr;
    document.querySelectorAll('[data-luxury-empty-brand]').forEach(e=>{e.textContent=t.brand;});
    document.querySelectorAll('[data-luxury-optional]').forEach(e=>{e.textContent=t.optional;});
    document.querySelectorAll('[data-luxury-note]').forEach(e=>{e.textContent=t.note;});
  }
  translate();
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
