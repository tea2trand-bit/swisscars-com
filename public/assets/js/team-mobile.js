/* Compact phone details while preserving the shared controls and their updates. */
(() => {
  const mobile=matchMedia('(max-width:760px)');
  // Keep the current step on the card; the full history stays in its existing details.
  const work=document.getElementById('t-narudzbine');
  const detailAnchors=new WeakMap();
  const compactWork=()=>{
    if(!work)return;
    for(const body of work.querySelectorAll('.team-lead-collapse>.team-lead-body')){
      const card=body.parentElement;
      const details=body.querySelector(':scope>details.work-details');
      const detailBody=details?.querySelector('.work-detail-body');
      const step=card.querySelector(':scope>.inquiry-summary>.iq-progress');
      if(!detailBody||!step)continue;
      for(const node of card.querySelectorAll('.sc-order-progress,.team-withdraw-control,.team-current-task')){
        const target=node.classList.contains('team-current-task')?step:detailBody;
        if(mobile.matches){
          if(node.parentElement===target)continue;
          if(!detailAnchors.has(node)){
            const original=document.createComment('mobile-work-details');
            node.before(original);
            detailAnchors.set(node,original);
          }
          target.append(node);
        }else{
          const original=detailAnchors.get(node);
          if(original?.isConnected){
            original.after(node);
            original.remove();
            detailAnchors.delete(node);
          }
        }
      }
    }
  };
  if(work){
    compactWork();
    mobile.addEventListener('change',compactWork);
    new MutationObserver(compactWork).observe(work,{childList:true,subtree:true});
  }
  const sold=document.getElementById('soldTbl');
  if(sold){
    const labels=()=>{
      const headings=[...sold.querySelectorAll('thead th')].map(el=>el.textContent.trim());
      for(const row of sold.querySelectorAll('tbody tr')) {
        [...row.cells].forEach((cell,i)=>cell.dataset.label=headings[i]||'');
      }
    };
    labels();
    new MutationObserver(labels).observe(sold.tBodies[0],{childList:true});
  }
})();
