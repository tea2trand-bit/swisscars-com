(function(root){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const boolean=value=>typeof value==='boolean'?value:null;
 function equipmentPatch(value,by,at=Date.now()){
  if(typeof value!=='string'||value.length>600)throw Error('Oprema može imati najviše 600 znakova.');
  return {vehicleExtras:value.trim(),checksUpdatedAt:at,checksUpdatedBy:by};
 }
 function render(data){
  const key=escape(data.key);
  const checks=[
   {field:'available',label:'Auto je dostupan',value:boolean(data.available)},
   {field:'originProofVerified',label:'EUR.1 / dokaz porekla',value:boolean(data.origin)},
   {field:'chVatRefundVerified',label:'Povrat CH PDV-a',value:boolean(data.vat)}
  ];
  const rows=checks.map(check=>{
   const editable=!!data.editable&&(check.field!=='available'||data.canAvailability);
   const answer=editable?'<span class="team-vehicle-answers">'+[true,false].map(value=>{
    const attr=check.field==='available'?(value?'data-pavok':'data-pavno')+'="'+key+'"':'data-proposal-check="'+key+'" data-check-field="'+check.field+'" data-check-value="'+value+'"';
    return '<button class="b small" type="button" '+attr+' aria-label="'+escape(check.label)+': '+(value?'Da':'Ne')+'" aria-pressed="'+(check.value===value)+'">'+(value?'Da':'Ne')+'</button>';
   }).join('')+'</span>':'<span class="team-vehicle-readonly">'+(check.value===null?'—':check.value?'Da':'Ne')+'</span>';
   return '<div class="team-vehicle-check-row"><span class="team-vehicle-check-label"><strong>'+check.label+'</strong>'+(check.value===null?'<small>Nije provereno</small>':'')+'</span>'+answer+'</div>';
  }).join('');
  const extras=escape(data.extras||'');
  const equipment=data.editable?'<label class="team-vehicle-equipment">Oprema uz auto<textarea rows="2" maxlength="600" data-vehicle-equipment="'+key+'" placeholder="Letnji/zimski točkovi, drugi ključ…">'+extras+'</textarea></label><div class="team-vehicle-equipment-actions"><button class="b small" type="button" data-vehicle-equipment-save="'+key+'">Sačuvaj opremu</button></div>':extras?'<p class="team-vehicle-equipment-summary"><strong>Oprema uz auto</strong><span>'+extras+'</span></p>':'';
  return '<section class="team-vehicle-checks" aria-label="Podaci auta"><h4>Podaci auta</h4><div class="team-vehicle-check-rows">'+rows+'</div>'+equipment+'</section>';
 }
 const api={render,equipmentPatch};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SCVehiclePrecheck=api;
})(typeof window==='undefined'?this:window);
