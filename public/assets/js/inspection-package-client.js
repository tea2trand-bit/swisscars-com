(function(){
 'use strict';
 const states=new WeakMap(),texts={
 sr:{title:'SWISCARS paket',description:'Pregled, provera dokumenata i pomoć pri kupovini i uvozu.',total:'Ukupna cena paketa',paid:'Uplaćeni pregled · uračunat',remaining:'Preostalo za paket',credit:'Cena pregleda ulazi u paket. Tim dogovara sa vama nastavak i način uplate.',choose:'Želim SWISCARS paket',confirm:'Potvrdi izbor paketa',back:'Odustani',question:'Želite da nastavite sa celim SWISCARS paketom?',selected:'Izabrali ste SWISCARS paket',saved:'Vaš izbor je sačuvan i vidljiv timu.',saving:'Čuvam izbor…',failed:'Izbor nije sačuvan. Pokušajte ponovo.',changed:'Cena paketa je promenjena. Proverite novi iznos pre potvrde.'},
 de:{title:'SWISCARS Paket',description:'Fahrzeugprüfung, Dokumentenprüfung und Begleitung bei Kauf und Import.',total:'Gesamtpreis des Pakets',paid:'Bezahlte Prüfung · angerechnet',remaining:'Restbetrag für das Paket',credit:'Die Prüfung ist im Paket enthalten. Das Team bespricht die nächsten Schritte und die Zahlung mit Ihnen.',choose:'Ich möchte das SWISCARS Paket',confirm:'Paketwahl bestätigen',back:'Abbrechen',question:'Möchten Sie mit dem gesamten SWISCARS Paket fortfahren?',selected:'Sie haben das SWISCARS Paket gewählt',saved:'Ihre Wahl ist gespeichert und für das Team sichtbar.',saving:'Wahl wird gespeichert…',failed:'Ihre Wahl wurde nicht gespeichert. Bitte erneut versuchen.',changed:'Der Paketpreis hat sich geändert. Bitte prüfen Sie den neuen Betrag vor der Bestätigung.'},
 en:{title:'SWISCARS package',description:'Vehicle inspection, document checks and help with purchase and import.',total:'Total package price',paid:'Paid inspection · credited',remaining:'Remaining for the package',credit:'The inspection is included in the package. The team will agree the next steps and payment with you.',choose:'I want the SWISCARS package',confirm:'Confirm package choice',back:'Cancel',question:'Would you like to continue with the full SWISCARS package?',selected:'You chose the SWISCARS package',saved:'Your choice is saved and visible to the team.',saving:'Saving choice…',failed:'Your choice was not saved. Please try again.',changed:'The package price has changed. Check the new amount before confirming.'}
 };
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(options){
  const {host,view,token,lang,rpc,onChange}=options,t=texts[lang]||texts.sr;
  let state=states.get(host);if(!state||state.token!==token){state={token,confirm:false,busy:false,error:''};states.set(host,state);}
  const offer=view.packageOffer;host.hidden=!offer||view.status==='otkazano';if(host.hidden)return;
  const selected=view.serviceMode==='package',number=n=>Number(n).toLocaleString(({sr:'sr-Latn-RS',de:'de-CH',en:'en-GB'})[lang]||'sr-Latn-RS',{maximumFractionDigits:2})+' CHF';
  host.innerHTML='<h2>'+esc(selected?t.selected:t.title)+'</h2><p>'+esc(selected?t.saved:t.description)+'</p><dl>'+[[t.total,offer.packageChf],[t.paid,offer.inspectionCreditChf],[t.remaining,offer.remainingChf]].map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(number(value))+'</dd></div>').join('')+'</dl><p class="inspection-package-note">'+esc(t.credit)+'</p>'+(state.confirm&&!selected?'<p class="inspection-package-question">'+esc(t.question)+'</p>':'')+(selected?'':'<div class="inspection-package-actions"><button type="button" data-package-confirm'+(state.busy?' disabled':'')+'>'+esc(state.busy?t.saving:state.confirm?t.confirm:t.choose)+'</button>'+(state.confirm?'<button type="button" data-package-back'+(state.busy?' disabled':'')+'>'+esc(t.back)+'</button>':'')+'</div>')+'<p class="inspection-package-result" role="status">'+esc(state.error)+'</p>';
  const back=host.querySelector('[data-package-back]');if(back)back.onclick=()=>{if(state.busy)return;state.confirm=false;state.error='';render(options);};
  const button=host.querySelector('[data-package-confirm]');if(button)button.onclick=async()=>{
   if(state.busy)return;if(!state.confirm){state.confirm=true;state.error='';render(options);return;}
   state.busy=true;state.error='';render(options);
   try{
    const result=await rpc(options.rpcName||'sc_inspection_choose_package',{p_token:token,p_expected_price:offer.packageChf,...(options.proposalId?{p_id:options.proposalId}:{})});
    if(!result?.ok){if(result?.reason==='price_changed'&&result.offer){view.packageOffer=result.offer;state.confirm=false;state.error=t.changed;}else state.error=t.failed;}
    else if(result.view?.serviceMode==='package'&&result.view?.serviceSelectedBy==='client'){state.confirm=false;state.busy=false;onChange(result.view);return;}
    else state.error=t.failed;
   }catch{state.error=t.failed;}
   state.busy=false;render(options);
  };
 }
 window.SCInspectionPackageClient={render};
})();
