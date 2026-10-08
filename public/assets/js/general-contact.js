/* General messages use Netlify Forms only; they never create a vehicle order. */
(function(){'use strict';
 const form=document.getElementById('general-contact-form');if(!form)return;
 const submit=form.querySelector('button[type="submit"]'),status=form.querySelector('[role="status"]');
 const name=form.elements.namedItem('name'),message=form.elements.namedItem('message');
 let pending=false;
 const lang=()=>['sr','de','en'].includes(document.documentElement.lang)?document.documentElement.lang:'sr';
 const text=key=>(translations[lang()]||translations.sr)[key];
 const show=(key,error)=>{status.dataset.i18n=key;status.textContent=text(key);status.className='form-status general-contact-wide '+(error?'err':'ok');status.hidden=false;};
 [name,message].forEach(field=>field.addEventListener('input',()=>field.setCustomValidity('')));
 form.addEventListener('submit',async event=>{
   event.preventDefault();if(pending)return;
   name.setCustomValidity(name.value.trim().length>=2?'':text('gcNameError'));
   message.setCustomValidity(message.value.trim().length>=10?'':text('gcMessageError'));
   if(!form.reportValidity())return;
   const data=new FormData(form);data.set('name',name.value.trim());data.set('message',message.value.trim());data.set('language',lang());
   pending=true;submit.disabled=true;submit.dataset.i18n='gcSending';submit.textContent=text('gcSending');form.setAttribute('aria-busy','true');status.hidden=true;
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
   try{
     const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data).toString(),signal:controller.signal});
     if(!response.ok)throw Error('not_accepted');
     form.reset();show('gcSent',false);
   }catch{show('gcError',true);}
   finally{clearTimeout(timer);pending=false;submit.disabled=false;submit.dataset.i18n='gcSend';submit.textContent=text('gcSend');form.removeAttribute('aria-busy');}
 });
})();
