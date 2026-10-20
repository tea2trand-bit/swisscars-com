/* Explicit corrections to an inquiry, through the authenticated team store. */
(()=>{
 const heading=document.getElementById('teamContactName');if(!heading)return;
 const edit=document.createElement('button');edit.type='button';edit.className='b small';edit.textContent='Uredi podatke';heading.after(edit);
 const dialog=document.createElement('dialog');dialog.className='team-client-name-dialog';
 dialog.innerHTML='<form><h2>Podaci upita</h2><label>Ime i prezime<input name="clientName" required maxlength="120" autocomplete="off"></label><div data-search-fields><label>Marka<input name="requestBrand" maxlength="80"></label><label>Tačan model / verzija<input name="requestModel" maxlength="160"></label><label>Godište od<input name="requestYearFrom" type="number" min="1900" max="2100" step="1"></label><label>Godište do<input name="requestYearTo" type="number" min="1900" max="2100" step="1"></label><label>Kubikaža, cm³<input name="requestEngineCapacity" type="number" min="500" max="10000" step="1"></label><label>Ukupan budžet, €<input name="requestBudget" type="number" min="1" step="1"></label></div><div data-listing-fields><label>Link oglasa<input name="listingUrl" type="url"></label><label>Cena iz oglasa, CHF<input name="listingPrice" type="number" min="1" step="0.01"></label></div><label data-note-label>Napomena<textarea name="requestNote" rows="4" maxlength="1500"></textarea></label><div class="btns"><button class="b primary" type="submit">Sačuvaj podatke</button><button class="b" type="button" data-cancel>Odustani</button></div><p role="status"></p></form>';
 document.body.append(dialog);const form=dialog.querySelector('form');let target=null,saving=false;
 const openEditor=(kind,id)=>{
  if(!canWrite||saving)return;const record=(kind==='lead'?LEADS:INSPS).find(r=>r._id===id);if(!record)return;
  const criteria=SCInquiryCriteria.read(record),listing=kind==='lead'?SCPurchaseFlow.request(record):null;target={kind,id,listing:!!listing?.url};
  for(const [key,value] of Object.entries({clientName:record.name,requestBrand:record.brand,requestModel:record.model,requestYearFrom:criteria.yearFrom,requestYearTo:criteria.yearTo,requestEngineCapacity:criteria.engineCapacity,requestBudget:record.budget,listingUrl:listing?.url,listingPrice:listing?.listingPriceChf,requestNote:listing?.url?record.note:criteria.note})){form.elements[key].value=value??'';}
  form.querySelector('[data-search-fields]').hidden=kind!=='lead'||target.listing;form.querySelector('[data-listing-fields]').hidden=!target.listing;form.querySelector('[data-note-label]').hidden=kind!=='lead';
  form.elements.requestModel.required=kind==='lead'&&!target.listing;form.elements.listingUrl.required=target.listing;form.elements.listingPrice.required=target.listing;form.querySelector('[role="status"]').textContent='';dialog.showModal();form.elements.clientName.focus();
 };
 edit.onclick=()=>{if(teamContactState)openEditor(teamContactState.kind,teamContactState.id);};
 document.addEventListener('click',event=>{const button=event.target.closest('[data-edit-inquiry]');if(!button)return;event.preventDefault();event.stopPropagation();openEditor('lead',button.dataset.editInquiry);});
 dialog.querySelector('[data-cancel]').onclick=()=>{if(!saving)dialog.close();};
 form.onsubmit=async event=>{
  event.preventDefault();if(!target||!canWrite||saving||!form.reportValidity())return;const name=form.elements.clientName.value.trim();if(!name)return;
  saving=true;form.querySelector('[type="submit"]').disabled=true;
  try{
   const {kind,id,listing}=target,record=(kind==='lead'?LEADS:INSPS).find(r=>r._id===id);if(!record)throw Error('Upit više nije dostupan.');const patch={name};
   if(kind==='lead'){
    patch.note=form.elements.requestNote.value.trim();
    if(listing){const url=new URL(form.elements.listingUrl.value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Proverite link oglasa.');const previous=SCPurchaseFlow.request(record).url;if(previous!==url.href&&(record.proposals?.length||record.carId))throw Error('Za izabrano vozilo pošaljite drugi predlog.');const price=Number(form.elements.listingPrice.value);if(!Number.isFinite(price)||price<=0)throw Error('Proverite cenu oglasa.');patch.listingUrl=url.href;patch.listingPriceChf=price;patch.note='Upit za pomoć pri kupovini izabranog auta. Oglas: '+url.href+'\nCena iz oglasa: '+price+' CHF\n'+patch.note.replace(/^Upit za pomoć pri kupovini izabranog auta\. Oglas:.*\n?/m,'').replace(/^Cena iz oglasa:.*\n?/mg,'').trim();if(previous!==url.href)Object.assign(patch,{model:'Vozilo iz oglasa',listingVehicle:null,listingCheck:null,listingQuote:null,listingReview:null});}
    else{Object.assign(patch,{brand:form.elements.requestBrand.value.trim(),model:form.elements.requestModel.value.trim(),budget:Number(form.elements.requestBudget.value)||null,yearFrom:Number(form.elements.requestYearFrom.value)||null,yearTo:Number(form.elements.requestYearTo.value)||null,engineCapacity:Number(form.elements.requestEngineCapacity.value)||null});patch.note=SCInquiryCriteria.notes(patch);}
   }
   await db.doc((kind==='lead'?'leads/':'inspections/')+id).update(patch);Object.assign(record,patch);heading.textContent=name;dialog.close();if(typeof renderLeads==='function')renderLeads();toast('Podaci upita su sačuvani.');
  }catch(error){form.querySelector('[role="status"]').textContent=error.message||'Podaci nisu sačuvani.';}finally{saving=false;form.querySelector('[type="submit"]').disabled=false;}
 };
 const update=()=>{edit.hidden=typeof canWrite==='undefined'||!canWrite;};new MutationObserver(update).observe(heading,{childList:true});update();
})();
