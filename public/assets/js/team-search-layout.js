/* Keep the existing search engine and forms; separate their visible responsibilities. */
(() => {
  const root=document.getElementById('t-ai');
  const title=document.getElementById('findTitle');
  const criteria=title?.closest('.sheet');
  if(!root||!criteria)return;
  criteria.id='teamSearchCriteria';
  const heading=title.closest('.company-search-heading');
  heading.classList.add('search-page-head');
  const intro=document.createElement('p');
  intro.textContent='Zadaj uslove, prati pretragu i uporedi vozila.';
  heading.append(intro);
  root.insertBefore(heading,criteria);
  const status=document.createElement('section');
  status.id='teamSearchStatus';status.className='sheet';
  status.setAttribute('aria-label','Status pretrage');
  const statusHeading=document.createElement('h3');statusHeading.textContent='Status pretrage';
  status.append(statusHeading);
  for(const id of ['runInfo','companyAutomaticStatus','runProg','companyProgressCounterPicker']){
    const node=document.getElementById(id);if(node)status.append(node);
  }
  const results=document.createElement('section');results.id='teamSearchResults';results.className='sheet';
  let node=document.getElementById('companyBudgetPlan');
  while(node){const next=node.nextSibling;results.append(node);node=next;}
  const portals=criteria.querySelector('.company-search-portals');
  if(portals)results.append(portals);
  criteria.after(status,results);
  const updateStatus=()=>{
    const info=document.getElementById('runInfo');
    if(info&&!info.textContent.trim())info.textContent='Pretraga još nije pokrenuta.';
  };
  updateStatus();
  for(const button of root.querySelectorAll('[data-company-search-view]'))button.addEventListener('click',updateStatus);
})();
