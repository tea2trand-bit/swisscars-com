(()=>{
const allowedUrl=value=>{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='www.autoscout24.ch'||u.username||u.password||u.port||u.hash||!/^\/de\/d\/(?:[a-z0-9-]+-)?\d+\/?$/.test(u.pathname))throw Error('invalid_url');return u.href;};
const classify=s=>/just a moment|nur einen moment|sicherheitsüberprüfung|access denied|captcha|verify you are human/i.test(s.title+'\n'+s.text)?'blocked':s.heading&&/\bCHF\s*[\d’']/.test(s.text)&&/\bkm\b/.test(s.text)?'ok':'error';
// Local candidate: no deploy, database writes, mail, or customer data.

const clean=value=>String(value??'').replace(/\s+/g,' ').trim().slice(0,220);
// Never infer equipment or color from the photos, model or trim name.
function extractVehicleDetails(snapshot){
  const lines=String(snapshot.text||'').split(/\r?\n/).map(clean).filter(Boolean);
  const before=label=>{const i=lines.indexOf(label);return i>0?lines[i-1]:'';};
  const specs=snapshot.vehicleDetails||{};
  const value=(key,label)=>clean(specs[key]||before(label));
  const after=(label,start=0)=>{const i=lines.indexOf(label,start);return i>=0?lines[i+1]||'':'';};
  const equipment={optional:[],standard:[],extra:[],complete:false};
  const groups={'Optionale Ausstattung':'optional','Serienmässige Ausstattung':'standard','Extras':'extra'};
  let group=null,inEquipment=false,partial=false;
  for(const line of lines){
    if(line==='Ausstattungen'){inEquipment=true;continue;}
    if(!inEquipment)continue;
    if(/^(Energie & Emissionen|Modifikationen|Motorfahrzeugkontrolle \(MFK\)|Garantie und Rückgabe|Fahrzeugbeschreibung|Anbieter)$/.test(line))break;
    if(groups[line]){group=groups[line];continue;}
    if(/^Alle .*Ausstattung anzeigen$/.test(line)){partial=true;continue;}
    if(/^Weniger .*Ausstattung anzeigen$/.test(line)||/tatsächliche Ausstattung|Ausstattung suchen/.test(line))continue;
    if(group&&!equipment[group].includes(line)&&equipment[group].length<200)equipment[group].push(line);
  }
  equipment.complete=inEquipment&&!partial&&Object.values(equipment).some(v=>Array.isArray(v)&&v.length);
  if(snapshot.equipment){
    for(const key of ['optional','standard','extra'])equipment[key]=[...new Set((snapshot.equipment[key]||[]).map(clean).filter(Boolean))].slice(0,200);
    equipment.complete=snapshot.equipment.complete===true;
  }
  const mfkStart=lines.indexOf('Motorfahrzeugkontrolle (MFK)'),warrantyStart=lines.indexOf('Garantie und Rückgabe');
  const descriptionStart=lines.indexOf('Fahrzeugbeschreibung');
  let description='';
  if(descriptionStart>=0){
    const tail=lines.slice(descriptionStart+1),end=tail.findIndex(s=>/^(Zusatzleistungen des Händlers|Wie viel kostet die Versicherung\?|Anbieter|Unsere Partner|Weitere Fahrzeuge dieses Anbieters)$/.test(s));
    description=tail.slice(0,end<0?tail.length:end).join('\n').slice(0,12000);
  }
  const sellerDescription=typeof snapshot.description==='string'?snapshot.description.slice(0,12000):description;
  return {detailsRead:true,color:value('color','Aussen'),interiorColor:value('interiorColor','Innen'),fuel:value('fuel','Treibstoff'),transmission:value('transmission','Getriebe'),drive:value('drive','Antrieb'),body:value('body','Aufbauart'),power:value('power','Leistung'),accident:clean(specs.accident||(warrantyStart>=0?after('Unfallfahrzeug',warrantyStart):'')),mfk:clean(specs.mfk||(mfkStart>=0?after('Ab MFK',mfkStart):'')),mfkDate:clean(specs.mfkDate||after('Letzte MFK')),description:sellerDescription.replace(/\s*(Mehr|Weniger) anzeigen\s*$/,'').trim(),descriptionComplete:snapshot.descriptionComplete??!/(?:Mehr anzeigen)\s*$/.test(sellerDescription),equipment};
}
function numeric(value){
  const normalized=String(value??'').replace(/[\s'’]/g,'');
  return /^\d+(?:[.,]\d{1,2})?$/.test(normalized)?Number(normalized.replace(',','.')):null;
}
function approvedPhoto(value){
  try{
    const u=new URL(value);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
      (u.hostname==='mapl-assets.b-cdn.net'||u.hostname.endsWith('.autoscout24.ch'));
  }catch{return false;}
}
function extractCloudListing(snapshot){
  const url=new URL(allowedUrl(snapshot.url));
  if(url.hostname!=='www.autoscout24.ch')throw Error('detail_parser_not_ready');
  const text=String(snapshot.text||'');
  const title=clean(snapshot.heading);
  if(!title||/captcha|nur einen moment|access denied|sicherheitsüberprüfung/i.test(title+' '+snapshot.title))throw Error('source_blocked');
  // Only visible values with their advertised units/labels; never guess absent data.
  const priceMatch=text.match(/\bCHF\s*([0-9][\d'’\u00a0 ]*(?:[.,]\d{1,2})?)/);
  const yearMatch=text.match(/\b(?:0[1-9]|1[0-2])\.(19\d{2}|20\d{2})\s*(?:Erstzulassung\s*\/\s*Baujahr)/);
  const mileageMatch=text.match(/\b([0-9][\d'’\u00a0 ]*)\s*km\s*Kilometerstand/);
  const placeMatch=String(snapshot.place||'').match(/\b(\d{4})\s+([^\n,]+)$/);
  // Only gallery images of this listing (its numeric id in the image path); logos,
  // dealer images and other listings are dropped; duplicates by path removed.
  const listingId=url.pathname.match(/(\d+)\/?$/)?.[1];
  const seen=new Set(),photos=[];
  for(const value of snapshot.photos||[]){
    if(!approvedPhoto(value))continue;
    const u=new URL(value);
    if(u.hostname!=='listing-images.autoscout24.ch'||!listingId||!u.pathname.includes('/'+listingId+'/'))continue;
    if(seen.has(u.pathname))continue;seen.add(u.pathname);photos.push(value);
    if(photos.length>=50)break;
  }
  return {title,year:yearMatch?Number(yearMatch[1]):null,mileage:mileageMatch?numeric(mileageMatch[1]):null,price:priceMatch?numeric(priceMatch[1]):null,place:placeMatch?clean(placeMatch[1]+' '+placeMatch[2]):'',photos,...extractVehicleDetails(snapshot)};
}
// Snapshot captured in a team member's own browser on the open listing page
// (SNAPSHOT_EXPRESSION run as a bookmarklet). No cloud browser, no challenge
// handling: the page was loaded by a person. Same parser as the cloud path.
const str=(v,max)=>typeof v==='string'&&v.length<=max;
function readCapturedListing(snapshot){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw Error('invalid_snapshot');
  if(!str(snapshot.url,2048)||!str(snapshot.title??'',500)||!str(snapshot.heading??'',500)||!str(snapshot.text??'',60000)||!str(snapshot.place??'',300))throw Error('invalid_snapshot');
  if(snapshot.photos!=null&&(!Array.isArray(snapshot.photos)||snapshot.photos.length>60||snapshot.photos.some(p=>!str(p,2048))))throw Error('invalid_snapshot');
  if(snapshot.vehicleDetails!=null&&(typeof snapshot.vehicleDetails!=='object'||Array.isArray(snapshot.vehicleDetails)||Object.values(snapshot.vehicleDetails).some(v=>!str(v,300))))throw Error('invalid_snapshot');
  if(snapshot.equipment!=null){
    if(typeof snapshot.equipment!=='object'||Array.isArray(snapshot.equipment)||typeof snapshot.equipment.complete!=='boolean')throw Error('invalid_snapshot');
    for(const key of ['optional','standard','extra'])if(!Array.isArray(snapshot.equipment[key])||snapshot.equipment[key].length>200||snapshot.equipment[key].some(v=>!str(v,300)))throw Error('invalid_snapshot');
  }
  if(snapshot.description!=null&&!str(snapshot.description,12000))throw Error('invalid_snapshot');
  if(snapshot.descriptionComplete!=null&&typeof snapshot.descriptionComplete!=='boolean')throw Error('invalid_snapshot');
  const validated=new URL(allowedUrl(snapshot.url));
  if(validated.hostname!=='www.autoscout24.ch')throw Error('detail_parser_not_ready');
  const status=classify({url:snapshot.url,title:snapshot.title||'',heading:snapshot.heading||'',text:snapshot.text||'',cards:[]});
  if(status==='blocked')throw Error('source_blocked');
  if(status!=='ok')throw Error('source_unavailable');
  return extractCloudListing({...snapshot,title:snapshot.title||'',heading:snapshot.heading||'',text:snapshot.text||'',place:snapshot.place||'',photos:snapshot.photos||[]});
}

window.SCListingSnapshotParser={readCapturedListing};
})();
