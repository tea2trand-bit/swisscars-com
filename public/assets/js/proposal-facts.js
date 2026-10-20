(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const heading='Podaci vozila iz oglasa';
 const labels={color:'Spoljašnja boja',interiorColor:'Unutrašnjost',fuel:'Gorivo',transmission:'Menjač',drive:'Pogon',body:'Karoserija',power:'Snaga'};
 const terms={Diesel:'Dizel',Benzin:'Benzin',Automat:'Automatik','Halbautomatisches Getriebe':'Poluautomatski menjač',Schaltgetriebe:'Manuelni menjač',Vorderradantrieb:'Prednji pogon',Allrad:'Pogon na sva četiri točka',Hinterradantrieb:'Zadnji pogon',Limousine:'Limuzina',Kombi:'Karavan'};
 const specValue=(key,value)=>key==='color'||key==='interiorColor'?root.SCListingDetails.color(value):key==='power'?String(value||'').replace(/\bPS\b/g,'KS'):terms[value]||value||'';
 function describe(fields,equipment){
  const d=root.SCListingDetails,lines=[heading];
  for(const [key,label] of Object.entries(labels)){const value=key==='color'||key==='interiorColor'?d.color(fields[key]):key==='power'?String(fields[key]||'').replace(/\bPS\b/g,'KS'):terms[fields[key]]||fields[key];lines.push(label+': '+(value||'Podatak još nije preuzet'));}
  lines.push('Stanje vozila: '+d.accident(fields.accident),'MFK: '+d.mfk(fields.mfk,fields.mfkDate));
  for(const [key,label] of [['optional','Dodatna oprema'],['standard','Serijska oprema'],['extra','Dodatni navodi']])if(equipment?.[key]?.length)lines.push(label+':',...equipment[key].map(v=>'• '+d.equipmentLabel(v)));
  if(!equipment?.complete)lines.push('Spisak opreme je skraćen; dodatne stavke nisu potvrđene.');
  lines.push('Opis prodavca:',d.descriptionLabel(d.publicDescription(fields.description))||'Opis još nije preuzet.','Navodi prodavca zahtevaju proveru pregledom.');
  return lines.join('\n').slice(0,24000);
 }
 function isImported(p){return typeof p?.adNote==='string'&&p.adNote.startsWith(heading+'\n');}
 function parse(p){const text=isImported(p)?p.adNote.slice(heading.length).trim():'';const lines=text.split('\n'),facts={},remaining=[];for(const line of lines){const label=Object.values(labels).find(label=>line.startsWith(label+': '));if(label)facts[label]=line.slice(label.length+2);else remaining.push(line);}return {facts,remaining};}
 function markup(p,request){
  if(!isImported(p))return '';
  const {facts,remaining}=parse(p),d=root.SCListingDetails;
  let html='<section class="up-imported-vehicle"><h4>Podaci vozila</h4><dl>'+Object.entries(facts).map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>';
  if(request.color)html+='<p>Tražena boja: '+esc(request.color)+'. '+(d.colorMatch(request.color,facts['Spoljašnja boja'])==='different'?'Boja vozila odstupa od zahteva.':d.colorMatch(request.color,facts['Spoljašnja boja'])==='match'?'Boja odgovara navedenoj želji.':'Poklapanje zahteva proveru.')+'</p>';
  const km=Number(String(request.mileage||'').replace(/[^0-9]/g,''));if(km&&Number(p.km)>km)html+='<p class="up-import-warning">Odstupanje kilometraže: '+Number(p.km).toLocaleString('sr-RS')+' km umesto do '+km.toLocaleString('sr-RS')+' km.</p>';
  html+='<div class="up-imported-description">'+remaining.map(line=>/^(Dodatna oprema|Serijska oprema|Dodatni navodi|Opis prodavca):$/.test(line)?'<h4>'+esc(line.slice(0,-1))+'</h4>':'<p>'+esc(line)+'</p>').join('')+'</div></section>';
  return html;
 }
  root.SCProposalFacts={describe,isImported,parse,markup,specValue};
 if(typeof module==='object'&&module.exports)module.exports=root.SCProposalFacts;
})(typeof window==='object'?window:globalThis);
