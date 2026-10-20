import {authorized} from './_shared/cloud-reader-runtime.mjs';
import {readCloudListing} from './_shared/cloud-listing-reader.mjs';

export function createHandler({env=name=>Netlify.env.get(name),read=readCloudListing}={}){
  return async req=>{
    const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
    if(req.method!=='POST')return json({ok:false,reason:'method'},405);
    const readerToken=env('KI_READER_TOKEN'),browserKey=env('BROWSER_USE_API_KEY');
    if(!readerToken||!browserKey)return json({ok:false,reason:'cloud_not_configured'},503);
    if(!authorized(req.headers.get('authorization'),readerToken))return json({ok:false,reason:'auth'},401);
    let body;
    try{
      const raw=await req.text();if(raw.length>8192)return json({ok:false,reason:'body_too_large'},413);
      body=JSON.parse(raw);
    }catch{return json({ok:false,reason:'body'},400);}
    if(!body||Array.isArray(body)||typeof body.url!=='string'||Object.keys(body).some(key=>key!=='url'))return json({ok:false,reason:'body'},400);
    try{
      const fields=await read(body.url,browserKey);
      const missing=Object.entries(fields).filter(([,v])=>v===null||v===''||(Array.isArray(v)&&!v.length)).map(([key])=>key);
      return json({ok:true,fields,missing});
    }catch(error){
      const reason=['invalid_url','source_blocked','detail_parser_not_ready','source_unavailable','browser_cleanup_failed','cloud_not_configured'].includes(error.message)?error.message:'source_unavailable';
      return json({ok:false,reason},reason==='invalid_url'?400:422);
    }
  };
}
export default createHandler();
export const config={path:'/api/read-listing'};
