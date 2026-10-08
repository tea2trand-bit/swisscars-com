(function(root){'use strict';
const VERSION='swiscars-partner-registration-v1';
const ROLES=['local_transport','international_transport','transport_both'];
const CANTONS='AG AI AR BE BL BS FR GE GL GR JU LU NE NW OW SG SH SO SZ TG TI UR VD VS ZG ZH'.split(' ');
const FIELDS=['full_name','phone','company_name','city','postal_code','street_address','country_code','coverage_cantons','coverage_regions','coverage_countries','routes'];
function profile(input,withRole=true){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Proveri podatke profila.');
 for(const k of Object.keys(input))if(!FIELDS.includes(k)&&!(withRole&&k==='role'))throw Error('Nedozvoljeno polje profila.');
 const out={};if(withRole){if(!ROLES.includes(input.role))throw Error('Izaberi vrstu prevoza.');out.role=input.role;}
 for(const k of ['full_name','phone','company_name','city','postal_code','street_address','country_code']){const v=input[k]??'';if(typeof v!=='string')throw Error('Proveri kontakt.');out[k]=v.trim();}
 if(!out.full_name||out.full_name.length>120||!out.city||out.city.length>120||!/^\+?[0-9 ()/.-]{6,40}$/.test(out.phone)||!/^[A-Z]{2}$/.test(out.country_code)||out.company_name.length>160||out.postal_code.length>200||out.street_address.length>200)throw Error('Upiši ime, telefon, grad i državu.');
 for(const k of ['coverage_cantons','coverage_regions','coverage_countries','routes']){if(!Array.isArray(input[k])||input[k].length>30||input[k].some(x=>typeof x!=='string'||!x.trim()||x.length>120))throw Error('Proveri područje rada.');out[k]=[...new Set(input[k].map(x=>x.trim()))];}
 if(out.coverage_cantons.some(x=>!CANTONS.includes(x))||out.coverage_countries.some(x=>!/^[A-Z]{2}$/.test(x)))throw Error('Proveri oznake kantona i država.');
 if(withRole&&['local_transport','transport_both'].includes(out.role)&&!out.coverage_cantons.length&&!out.coverage_regions.length)throw Error('Izaberi kanton ili upiši region lokalnog prevoza.');
 if(withRole&&['international_transport','transport_both'].includes(out.role)&&(!out.coverage_countries.length||!out.routes.length))throw Error('Izaberi države i upiši bar jednu relaciju.');
 return out;
}
function createApi(sb,{redirectTo,allowedRedirectOrigins=[]}={}){
 if(!sb?.auth||!sb?.rpc)throw Error('Prijava nije povezana.');
 if(redirectTo){const u=new URL(redirectTo);if(u.protocol!=='https:'||!allowedRedirectOrigins.includes(u.origin))throw Error('Nedozvoljena povratna adresa.');}
 async function rpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data;}
 async function identity(){const {data,error}=await sb.auth.getUser();if(error||!data?.user||data.user.is_anonymous)throw Error('Prijavite se svojim nalogom.');return data.user;}
 async function status(){const user=await identity();if(!user.email_confirmed_at)return {state:'email_pending',email:user.email};const result=await rpc('sc_partner_registration_status');return {...result,email:user.email,canComplete:ROLES.includes(user.user_metadata?.partner_registration?.profile?.role),state:result.profile?ROLES.includes(result.profile.role)?result.profile.status:'other_role':'profile_missing'};}
 return {
  async register(email,password,details){const p=profile(details);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error('Proveri email.');if(typeof password!=='string'||password.length<12)throw Error('Lozinka mora imati najmanje 12 znakova.');const {data,error}=await sb.auth.signUp({email:email.trim().toLowerCase(),password,options:{...(redirectTo?{emailRedirectTo:redirectTo}:{}),data:{partner_registration:{version:VERSION,profile:p}}}});if(error)throw error;return {state:'email_pending',sessionAvailable:!!data?.session,message:'Ako je registracija prihvaćena, na email stiže potvrda. Ako već imate nalog, prijavite se.'};},
  async signIn(email,password){const {error}=await sb.auth.signInWithPassword({email:email.trim().toLowerCase(),password});if(error)throw error;return status();},
  status,
  async completeEnrollment(details){const user=await identity();if(!user.email_confirmed_at)throw Error('Prvo potvrdite email.');const s=await status();if(s.state==='other_role')throw Error('Nalog ima drugu ulogu. Obratite se SWISCARS timu.');const requested=details||user.user_metadata?.partner_registration?.profile;const p=profile(requested);return rpc('sc_partner_enroll',{p_profile:p});},
  async save(details,version){const s=await status();if(!s.profile||s.state==='other_role'||s.state==='suspended')throw Error('Profil nije dostupan za izmenu.');const p=profile({...details,role:s.profile.role});delete p.role;if(!Number.isInteger(version)||version<1)throw Error('Ponovo učitajte profil.');return rpc('sc_partner_update_profile',{p_profile:p,p_expected_version:version});},
  async resend(email){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error('Proveri email.');const {error}=await sb.auth.resend({type:'signup',email:email.trim().toLowerCase(),options:{emailRedirectTo:redirectTo}});if(error)throw error;},
  async recover(){const {data,error}=await sb.auth.getSession();if(error)throw error;return data.session?status():{state:'signed_out'};},
  async signOut(){const {error}=await sb.auth.signOut({scope:'local'});if(error)throw error;},
  onSessionChange(callback){const {data}=sb.auth.onAuthStateChange((event,session)=>{callback(event,!!session);});return ()=>data.subscription.unsubscribe();}
 };
}
const api={VERSION,ROLES,CANTONS,FIELDS,profile,createApi};if(typeof module!=='undefined')module.exports=api;else root.SCTransport=api;
})(globalThis);
