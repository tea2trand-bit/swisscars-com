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
  const api={labels,stage,markup};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.SCOrderProgress=api;
})(typeof window==='undefined'?this:window);
