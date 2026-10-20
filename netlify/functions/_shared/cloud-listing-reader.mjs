// Local candidate: no deploy, database writes, mail, or customer data.
import {readListing as readCloudPage, allowedUrl} from './cloud-reader-runtime.mjs';

const clean=value=>String(value??'').replace(/\s+/g,' ').trim().slice(0,220);
function numeric(value){
  const normalized=String(value??'').replace(/[\s'’]/g,'');
  return /^\d+(?:[.,]\d{1,2})?$/.test(normalized)?Number(normalized.replace(',','.')):null;
}
export function approvedPhoto(value){
  try{
    const u=new URL(value);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
      (u.hostname==='mapl-assets.b-cdn.net'||u.hostname.endsWith('.autoscout24.ch'));
  }catch{return false;}
}
export function extractCloudListing(snapshot){
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
  const photos=[...new Set((snapshot.photos||[]).filter(approvedPhoto))].slice(0,50);
  return {title,year:yearMatch?Number(yearMatch[1]):null,mileage:mileageMatch?numeric(mileageMatch[1]):null,price:priceMatch?numeric(priceMatch[1]):null,place:placeMatch?clean(placeMatch[1]+' '+placeMatch[2]):'',photos};
}
export async function readCloudListing(url,key,options={}){
  const validated=new URL(allowedUrl(url));
  if(validated.hostname!=='www.autoscout24.ch')throw Error('detail_parser_not_ready');
  if(!key)throw Error('cloud_not_configured');
  const result=await readCloudPage(url,key,options);
  if(result.status==='blocked')throw Error('source_blocked');
  if(result.status!=='ok')throw Error('source_unavailable');
  return extractCloudListing(result.snapshot);
}
