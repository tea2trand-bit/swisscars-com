/* The existing topic select remains the submitted Netlify Forms field. */
(() => {
 'use strict';
 const select=document.getElementById('gc-topic');
 if(!select||document.getElementById('gc-topic-trigger'))return;
 const label=select.closest('label'),form=select.form;
 const trigger=document.createElement('button');trigger.type='button';trigger.id='gc-topic-trigger';trigger.className='contact-topic-trigger';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','contact-topic-dialog');
 select.classList.add('contact-topic-native');select.setAttribute('aria-hidden','true');select.tabIndex=-1;label.htmlFor=trigger.id;label.append(trigger);
 const dialog=document.createElement('dialog');dialog.id='contact-topic-dialog';dialog.className='contact-topic-dialog';dialog.setAttribute('aria-labelledby','contact-topic-title');
 dialog.innerHTML='<header><h3 id="contact-topic-title"></h3><button type="button" class="contact-topic-close">×</button></header><div class="contact-topic-options"></div>';
 document.body.append(dialog);
 const lang=()=>document.documentElement.lang||'sr';
 function render(){
  const title=label.querySelector('span')?.textContent||'Tema';trigger.textContent=select.selectedOptions[0]?.textContent||'';trigger.setAttribute('aria-label',title+': '+trigger.textContent);dialog.querySelector('h3').textContent=title;
  dialog.querySelector('.contact-topic-close').setAttribute('aria-label',({sr:'Zatvori',de:'Schließen',en:'Close'})[lang()]||'Zatvori');
  const options=dialog.querySelector('.contact-topic-options');options.replaceChildren();
  for(const option of [...select.options].filter(o=>o.value&&!o.disabled)){
   const button=document.createElement('button');button.type='button';button.textContent=option.textContent;button.setAttribute('aria-pressed',String(select.value===option.value));
   button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));trigger.removeAttribute('aria-invalid');render();dialog.close();};options.append(button);
  }
 }
 function open(){render();if(!dialog.open)dialog.showModal();trigger.setAttribute('aria-expanded','true');(dialog.querySelector('[aria-pressed="true"]')||dialog.querySelector('.contact-topic-options button')).focus();}
 trigger.onclick=open;dialog.querySelector('.contact-topic-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus();});select.addEventListener('change',render);
 select.addEventListener('invalid',event=>{event.preventDefault();trigger.setAttribute('aria-invalid','true');open();});form.addEventListener('reset',()=>queueMicrotask(render));
 const observer=new MutationObserver(render);observer.observe(select,{childList:true,subtree:true,characterData:true});observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});render();
})();
