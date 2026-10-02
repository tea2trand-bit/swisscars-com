/* One conversation, two views. Text is rendered with textContent, never HTML. */
(function () {
  const words = {
    sr: {title:'Razgovor o vašem upitu',hint:'Pišite ovde kako bi pitanja, dogovori i odgovori ostali uz vaš upit. Odgovor tima pojaviće se na ovoj stranici. Članovi tima vide vaše poruke u svojoj aplikaciji.',empty:'Još nema poruka. Napišite pitanje ili dopunu upita.',label:'Vaša poruka',send:'Pošaljite poruku',sending:'Šaljemo…',sent:'Poruka je sačuvana. Tim je vidi uz vaš upit.',error:'Poruka nije poslata. Tekst je sačuvan u polju; pokušajte ponovo.',loadError:'Razgovor trenutno nije dostupan. Pokušajte ponovo.',rate:'Poslali ste više poruka u kratkom roku. Sačekajte malo i pokušajte ponovo.',older:'Prikažite starije poruke',refresh:'Osvežite razgovor',client:'Klijent',you:'Vi',team:'SWISCARS tim',limit:'Do 3.000 znakova',locale:'sr-Latn-RS'},
    de: {title:'Gespräch zu Ihrer Anfrage',hint:'Schreiben Sie hier, damit Fragen, Absprachen und Antworten bei Ihrer Anfrage bleiben. Die Antwort unseres Teams erscheint hier. Unser Team sieht Ihre Nachrichten in seiner Anwendung.',empty:'Noch keine Nachrichten. Stellen Sie eine Frage oder ergänzen Sie Ihre Anfrage.',label:'Ihre Nachricht',send:'Nachricht senden',sending:'Wird gesendet…',sent:'Nachricht gespeichert. Unser Team sieht sie bei Ihrer Anfrage.',error:'Nachricht nicht gesendet. Ihr Text bleibt im Feld; versuchen Sie es erneut.',loadError:'Das Gespräch ist momentan nicht verfügbar. Bitte erneut versuchen.',rate:'Zu viele Nachrichten in kurzer Zeit. Bitte kurz warten und erneut versuchen.',older:'Ältere Nachrichten anzeigen',refresh:'Gespräch aktualisieren',client:'Kunde',you:'Sie',team:'SWISCARS Team',limit:'Bis 3.000 Zeichen',locale:'de-CH'},
    en: {title:'Conversation about your request',hint:'Write here to keep questions, agreements and replies with your request. The team’s reply will appear on this page. Our team sees your messages in its application.',empty:'No messages yet. Ask a question or add details to your request.',label:'Your message',send:'Send message',sending:'Sending…',sent:'Message saved. The team sees it with your request.',error:'Message not sent. Your text remains in the field; please try again.',loadError:'The conversation is temporarily unavailable. Please try again.',rate:'Too many messages in a short time. Wait a little and try again.',older:'Show older messages',refresh:'Refresh conversation',client:'Customer',you:'You',team:'SWISCARS team',limit:'Up to 3,000 characters',locale:'en-GB'}
  };
  const widgets = new Set();
  let nextId = 0;
  const element = (tag, cls, text) => { const e=document.createElement(tag); if(cls)e.className=cls; if(text)e.textContent=text; return e; };
  function mount(root, options) {
    if (root.scConversation) { root.scConversation.setLanguage(options.lang); return root.scConversation; }
    let lang=words[options.lang]?options.lang:'sr',busy=false,loading=false,requestId=null,pendingText='',oldest=null,hasMore=false;
    const messages=new Map(),t=()=>words[lang];
    root.classList.add('sc-conversation');
    const title=element(options.team?'h4':'h2'),hint=element('p','sc-chat-hint'),older=element('button','sc-chat-button sc-chat-older'),list=element('ol','sc-chat-list'),form=element('form','sc-chat-form'),label=element('label'),input=element('textarea'),actions=element('div','sc-chat-actions'),send=element('button','sc-chat-button'),refresh=element('button','sc-chat-button sc-chat-older'),limit=element('span','sc-chat-hint'),status=element('p','sc-chat-status');
    input.id='sc-chat-input-'+(++nextId);label.htmlFor=input.id;input.maxLength=3000;input.required=true;input.rows=3;
    send.type='submit';older.type=refresh.type='button';older.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    actions.append(send,refresh,limit);form.append(label,input,actions,status);root.append(title,hint,older,list,form);
    const say=(text,error=false)=>{status.textContent=text;status.dataset.error=String(error);};
    function paint() {
      const atBottom=list.scrollTop+list.clientHeight>=list.scrollHeight-40,scroll=list.scrollTop;
      list.replaceChildren();
      if(!messages.size)list.append(element('li','sc-chat-hint',t().empty));
      for(const m of [...messages.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1)) {
        const item=element('li','sc-chat-message'+(m.sender==='team'?' sc-chat-team':'')),meta=element('div','sc-chat-meta'),time=element('time');
        const name=m.sender==='team'?(m.author||t().team):(options.team?t().client:t().you);
        time.dateTime=m.at;time.textContent=new Date(m.at).toLocaleString(t().locale,{dateStyle:'medium',timeStyle:'short'});
        meta.append(element('strong','',name),time);item.append(meta,element('p','sc-chat-body',m.body));list.append(item);
      }
      list.scrollTop=atBottom?list.scrollHeight:scroll;older.hidden=!hasMore;
    }
    function language(value) {
      lang=words[value]?value:'sr';title.textContent=options.team?'Razgovor sa klijentom':t().title;
      hint.textContent=options.team?'Klijent vidi ove poruke na svom ličnom linku. Odgovor se čuva sa imenom člana tima i vremenom slanja.':t().hint;
      label.textContent=options.team?'Odgovor klijentu':t().label;send.textContent=busy?t().sending:t().send;
      older.textContent=t().older;refresh.textContent=t().refresh;limit.textContent=t().limit;paint();
    }
    async function load(before=null) {
      if(loading)return;loading=true;refresh.disabled=older.disabled=true;
      try {
        const result=await options.call(options.team?'sc_team_order_messages':'sc_order_messages',{...options.key,p_before:before});
        for(const m of result.messages||[])messages.set(m.id,m);
        if(before!==null||oldest===null){hasMore=!!result.hasMore;oldest=[...messages.keys()].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)[0]||null;}
        paint();if(status.dataset.error==='true')say('');
      } catch { say(t().loadError,true); }
      finally {loading=false;refresh.disabled=older.disabled=false;}
    }
    input.addEventListener('input',()=>{if(input.value.trim()!==pendingText)requestId=null;});
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(busy||!input.value.trim()||!input.reportValidity())return;
      busy=true;send.disabled=input.disabled=true;send.textContent=t().sending;say(t().sending);
      pendingText=input.value.trim();requestId=requestId||crypto.randomUUID();
      try {
        const result=await options.call(options.team?'sc_team_send_message':'sc_order_send_message',{...options.key,p_text:pendingText,p_request_id:requestId});
        if(!result?.ok)throw Error('not_saved');
        input.value='';requestId=null;say(options.team?'Odgovor je sačuvan. Klijent ga vidi na svom upitu.':t().sent);await load();options.onSent?.();
      } catch(e) {say(String(e.message).includes('rate_limited')?t().rate:t().error,true);}
      finally {busy=false;input.disabled=false;send.disabled=false;send.textContent=t().send;}
    });
    older.onclick=()=>load(oldest);refresh.onclick=()=>load();language(lang);
    const widget={refresh:()=>load(),setLanguage:language,root};root.scConversation=widget;widgets.add(widget);load();return widget;
  }
  setInterval(()=>{if(document.visibilityState==='visible')for(const widget of widgets){if(widget.root.isConnected&&widget.root.getClientRects().length)widget.refresh();else if(!widget.root.isConnected)widgets.delete(widget);}},15000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')for(const widget of widgets)if(widget.root.isConnected&&widget.root.getClientRects().length)widget.refresh();});
  window.SCConversation={mount};
})();
