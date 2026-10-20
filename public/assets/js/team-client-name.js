/* Explicit contact correction, using the same authenticated team store as the work card. */
(()=>{
 const heading=document.getElementById('teamContactName');if(!heading)return;
 const edit=document.createElement('button');edit.type='button';edit.className='b small';edit.textContent='Uredi ime';heading.after(edit);
 const dialog=document.createElement('dialog');dialog.className='team-client-name-dialog';
 dialog.innerHTML='<form><h2>Ime klijenta</h2><label>Ime i prezime<input name="clientName" required maxlength="120" autocomplete="off"></label><div class="btns"><button class="b primary" type="submit">Sačuvaj ime</button><button class="b" type="button" data-cancel>Odustani</button></div><p role="status"></p></form>';
 document.body.append(dialog);const form=dialog.querySelector('form');let target=null,saving=false;
 edit.onclick=()=>{if(!canWrite||!teamContactState)return;const {kind,id}=teamContactState;const record=(kind==='lead'?LEADS:INSPS).find(r=>r._id===id);if(!record)return;target={kind,id};form.elements.clientName.value=record.name||'';form.querySelector('[role="status"]').textContent='';dialog.showModal();form.elements.clientName.focus();};
 dialog.querySelector('[data-cancel]').onclick=()=>{if(!saving)dialog.close();};
 form.onsubmit=async event=>{event.preventDefault();if(!target||!canWrite||saving||!form.reportValidity())return;const name=form.elements.clientName.value.trim();if(!name)return;saving=true;form.querySelector('[type="submit"]').disabled=true;try{const {kind,id}=target;await db.doc((kind==='lead'?'leads/':'inspections/')+id).update({name});const record=(kind==='lead'?LEADS:INSPS).find(r=>r._id===id);if(record)record.name=name;heading.textContent=name;dialog.close();toast('Ime klijenta je sačuvano.');}catch(error){form.querySelector('[role="status"]').textContent=error.message||'Ime nije sačuvano.';}finally{saving=false;form.querySelector('[type="submit"]').disabled=false;}};
 const update=()=>{edit.hidden=typeof canWrite==='undefined'||!canWrite;};new MutationObserver(update).observe(heading,{childList:true});update();
})();
