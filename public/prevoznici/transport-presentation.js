(function(){
 const intro=document.getElementById('transportIntro'),nav=document.getElementById('entryNav');
 // Mark presentation text for the existing partner translation runtime.
 const walker=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_TEXT),nodes=[];
 while(walker.nextNode()){const n=walker.currentNode;if(n.textContent.trim()&&!n.parentElement.closest('script,style,[data-partner-text],option'))nodes.push(n);}
 nodes.forEach(n=>{const s=document.createElement('span');s.dataset.partnerText=n.textContent.trim();s.textContent=n.textContent;n.replaceWith(s);});
 document.querySelectorAll('option').forEach(o=>o.dataset.partnerText=o.textContent);

})();
