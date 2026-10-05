(function (root) {
  'use strict';
  const labels=['Primljeno','Tražimo','Kapara i pregled','Kupljeno','Transport','Carina','Priprema','Predato'];
  const carStages={pregledan:3,kupljen:3,transport:4,carinjen:5,garaza:6,prodaja:6,prodat:7};
  function stage(d,car=d.car){
    if(d.status==='odustao')return -1;
    if(d.status==='predato'||d.status==='kupio')return 7;
    if(car&&carStages[car.status]!=null)return carStages[car.status];
    if(d.status==='kupljeno')return 3;
    if((d.proposals||[]).some(p=>p.choice==='buy'))return 3;
    if(d.status==='ponudjeno'||(d.proposals||[]).some(p=>!p.answer||['zanima','zelim'].includes(p.answer)))return 2;
    if(d.status==='trazimo'||d.aiAt||d.aiCheckedAt)return 1;
    return 0;
  }
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function markup(current,names=labels,terms={done:'Završeno',now:'U toku',next:'Sledeće',later:'Nije započeto'}){
    return names.map((label,i)=>{
      const state=current<0?'':i<current?'done':i===current?'now':i===current+1?'next':'';
      const status=state==='done'?terms.done:state==='now'?terms.now:state==='next'?terms.next:terms.later;
      return `<li class="${state}"${state==='now'?' aria-current="step"':''} aria-label="${i+1}. ${esc(label)} — ${esc(status)}"><span class="step-number">${i+1}</span><span>${esc(label)}</span>${state==='done'?'<span class="step-state" aria-hidden="true">✓</span>':state==='now'||state==='next'?`<span class="step-state" aria-hidden="true">${esc(status)}</span>`:''}</li>`;
    }).join('');
  }
  function dateValue(value){
    if(value==null||value===''||typeof value==='boolean')return null;
    if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){
      const date=new Date(value+'T12:00:00Z');
      return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?date:null;
    }
    const numeric=typeof value==='number'||/^\d+(?:\.\d+)?$/.test(String(value));
    if(numeric&&Number(value)<=0)return null;
    const date=new Date(numeric?Number(value):value);
    return Number.isFinite(date.getTime())?date:null;
  }
  function latestDate(...values){return values.map(dateValue).filter(Boolean).sort((a,b)=>b-a)[0]||null;}
  function dates(d,car=d.car,p=null){
    const sd=d.statusDates||{},cd=car?.statusDates||{},pd=p?.changeDates||{};
    return [
      dateValue(d.created),
      latestDate(sd.trazimo,d.aiAt,d.aiCheckedAt,p?.at),
      latestDate(p?.answeredAt,p?.availAt,pd.answer,pd.avail,pd.chVatRefundVerified,pd.originProofVerified),
      latestDate(p?.inspectionPaidAt,p?.inspAt,pd.inspectionPaid,pd.inspectionScheduled,pd.plannedAt,pd.inspectionReviewed,pd.inspAt),
      latestDate(p?.depositPaidAt,pd.depositPaidAt),
      latestDate(sd.kupljeno,cd.kupljen,car?.boughtDate),
      dateValue(cd.transport),
      dateValue(cd.carinjen),
      latestDate(cd.garaza,cd.prodaja),
      latestDate(sd.predato,sd.kupio,cd.prodat,car?.soldDate)
    ];
  }
  function dateMarkup(value,state,lang='sr'){
    const date=dateValue(value);
    if(!date&&!['done','now','pending'].includes(state))return '';
    const locale=lang==='de'?'de-CH':lang==='en'?'en-GB':'sr-Latn-RS';
    const unknown=lang==='de'?'Datum nicht erfasst':lang==='en'?'Date not recorded':'Datum nije zabeležen';
    if(!date)return '<small class="step-date step-date-unknown">'+unknown+'</small>';
    const label=lang==='de'?'Zuletzt erfasst':lang==='en'?'Last recorded':'Poslednja zabeležena promena';
    const title=label+': '+date.toLocaleString(locale,{timeZone:'Europe/Belgrade'});
    return '<time class="step-date" datetime="'+date.toISOString()+'" title="'+esc(title)+'">'+esc(date.toLocaleDateString(locale,{timeZone:'Europe/Belgrade'}))+'</time>';
  }

  const api={labels,stage,markup,dates,dateMarkup,dateValue};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.SCOrderProgress=api;
})(typeof window==='undefined'?this:window);
