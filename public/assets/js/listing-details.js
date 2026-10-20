(function(root){
  'use strict';
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
  const colors={grau:'Siva',gray:'Siva',grey:'Siva',siva:'Siva',silber:'Srebrna',silver:'Srebrna',srebrna:'Srebrna',schwarz:'Crna',black:'Crna',crna:'Crna',weiss:'Bela',white:'Bela',bela:'Bela',bijela:'Bela',blau:'Plava',blue:'Plava',plava:'Plava',rot:'Crvena',red:'Crvena',crvena:'Crvena',grun:'Zelena',green:'Zelena',zelena:'Zelena',braun:'Braon',brown:'Braon',braon:'Braon',gelb:'Žuta',yellow:'Žuta',zuta:'Žuta',orange:'Narandžasta',beige:'Bež',violett:'Ljubičasta',purple:'Ljubičasta'};
  function color(value){const words=normalize(value).split(' '),base=words.map(w=>colors[w]).find(Boolean);return base?base+(/metallic|metalik/i.test(value)?' metalik':''):String(value||'');}
  function colorMatch(wanted,actual){
    const w=normalize(wanted),a=normalize(color(actual));
    if(!w||/^(svejedno|bilo koja|nije vazno|any)$/.test(w))return 'unspecified';
    if(!a)return 'unknown';
    if(/\b(ne|osim|bez|nicht|ohne)\b/.test(w))return 'unknown';
    const choices=String(wanted).split(/\bili\b|\bor\b|[,/;]/i).map(v=>normalize(color(v)));
    const bases=choices.map(v=>v.replace(/\bmetalik\b/g,'').trim());
    if(bases.some(v=>v===a.replace(/\bmetalik\b/g,'').trim())&&(!/metalik|metallic/.test(w)||a.includes('metalik')))return 'match';
    return bases.every(v=>Object.values(colors).some(c=>normalize(c)===v))?'different':'unknown';
  }
  function equipmentLabel(value){
    const v=String(value||'');
    const additional={
      'Entfall der Schriftzüge für die Modell-und Motorbezeichnung am Fahrzeugheck':'Bez oznaka modela i motora na zadnjem delu vozila',
      'Fleetline Paket Trendline':'Paket Fleetline za nivo opreme Trendline',
      'Assist: Geschwindigkeitsregler und -begrenzer':'Tempomat i ograničivač brzine',
      'Mittelarmlehne vorne mit':'Prednji naslon za ruku — nastavak stavke nije preuzet',
      'Klimatisierungsautomatik Climatronic':'Automatska klima Climatronic',
      'Lackierung: Uni-Lackierung':'Nemetalik boja',
      'Paket Swissline':'Paket opreme Swissline',
      'Fahrlichtautomatik':'Automatsko uključivanje svetala',
      'Leder-Multifunktionslenkrad im':'Kožni multifunkcionalni volan — nastavak stavke nije preuzet',
      'Licht: Coming-home-Funktion':'Funkcija Coming Home — svetla pri izlasku iz vozila',
      'Park Distance Control vorne und hinten':'Prednji i zadnji parking senzori',
      '2 Schlüssel mit Fernbedienung':'Dva ključa sa daljinskim upravljanjem',
      '3 Kopfstützen hinten':'Tri naslona za glavu pozadi',
      '3 Speichen-Lenkrad':'Volan sa tri kraka',
      '3-Punkt-Sicherheitsgurte auf allen Plätzen':'Sigurnosni pojasevi sa tri tačke vezivanja na svim sedištima',
      '4 Scheibenbremsen':'Disk kočnice na sva četiri točka',
      'Airbag Beifahrer deaktivierbar':'Mogućnost isključivanja vazdušnog jastuka suvozača',
      'Brillenablage':'Pregrada za naočare',
      'CZIP (Clean Zone Interior Package)':'Paket za kvalitet vazduha u kabini CZIP',
      'Aktivkohlefilter mit automatischer':'Filter sa aktivnim ugljem — nastavak stavke nije preuzet',
      'AUX-Eingang in der Mittelkonsole':'AUX priključak na centralnoj konzoli',
      'Airbag: Airbag Fahrer und Beifahrer':'Vazdušni jastuci vozača i suvozača',
      'Assist: Halteassistent':'Pomoć pri zadržavanju zaustavljenog vozila',
      'Assist: Spurwechselwarnung':'Upozorenje pri promeni saobraćajne trake',
      'Frontscheibe in Wärmeschutzverglasung':'Vetrobransko staklo sa toplotnom zaštitom',
      'Head-Up Display':'Head-up prikaz na vetrobranskom staklu',
      'Innenspiegel automatisch abblendend, rahmenlos':'Unutrašnji retrovizor bez okvira sa automatskim zatamnjivanjem',
      'Airbag: Airbag für Fahrer und Beifahrer mit Beifahrer-Airbag-Deaktivierung':'Vazdušni jastuci vozača i suvozača, uz isključivanje suvozačevog jastuka',
      'Airbag: Seitenairbags vorn mit Kopfairbagsystem':'Prednji bočni i vazdušni jastuci za glavu',
      'Antiblockiersystem (ABS)':'Sistem protiv blokiranja točkova ABS',
      'Assist: Geschwindigkeitsbegrenzungsanlage bis 250 km/h':'Ograničivač brzine do 250 km/h'
    };
    if(additional[v])return additional[v];
    const exact={'8-fach bereift':'Dva kompleta guma (8 guma); felne nisu potvrđene','Klima: 2-Zonen-Klimaautomatik':'Dvozonska automatska klima','Sitze: Vordersitze heizbar':'Grejanje prednjih sedišta','Sitze: Fondsitze aussen beheizbar':'Grejanje spoljašnjih zadnjih sedišta','Frontscheibenheizung':'Grejanje vetrobranskog stakla','Regensensor für Scheibenwischer vorne':'Senzor kiše za prednje brisače','Innenspiegel automatisch abblendbar':'Unutrašnji retrovizor sa automatskim zatamnjivanjem','Kindersitzvorrichtung ISOFIX':'ISOFIX za dečje sedište','Mittelarmlehne vorne':'Prednji naslon za ruku','Elektrische Kindersicherung':'Električna dečja brava','Allradantrieb permanent':'Stalni pogon na sva četiri točka','Elektrische Fensterheber vorne + hinten':'Električni podizači prednjih i zadnjih prozora','Aussenspiegel rechts und links beheizt':'Grejani spoljašnji retrovizori','City Safety automatische Notbremsung bis zu einer Geschwindigkeit von 50 km/h':'City Safety — automatsko kočenje do 50 km/h','6-Stufen-Automat sequentiell':'Automatski sekvencijalni menjač sa 6 stepeni','Winter Pack':'Zimski paket','Climate Comfort Pack':'Paket Climate Comfort','Versatility Pack':'Paket Versatility','Servotronic':'Servotronic upravljanje'};
    return exact[v]||v;
  }
  const features={
    klima:/klimaautomatik|klimatisierungsautomatik|klima|climate comfort/,isofix:/isofix/,navigacija:/navigation|navigationssystem|navi\b/,tempomat:/tempomat|geschwindigkeitsregel/,adaptive:/adaptive.*cruise|adaptiv.*tempomat|abstandsregel|abstandstempomat|adaptive.*geschwindigkeitsregel/,kamera:/ruckfahrkamera|360.*kamera/,parking:/parksensor|parkhilfe|park distance|einparkhilfe/,kuka:/anhangekupplung|anhangerkupplung/,grejanjeSedista:/vordersitze (heizbar|beheizbar)|sitzheizung/,panorama:/panoramadach|panorama.*dach/,koza:/lederausstattung|vollleder|polsterung.*leder/,led:/\bled.*scheinwerfer|scheinwerfer.*\bled|xenon.*scheinwerfer|scheinwerfer.*xenon/,carplay:/carplay/,android:/android auto/};
  function equipmentMatch(wanted,equipment){
    const text=normalize(wanted),items=['optional','standard','extra'].flatMap(k=>equipment?.[k]||[]).map(normalize).filter(v=>!/(^|\s)(ohne|kein|keine|nicht)(\s|$)/.test(v));
    let key=null;
    if(/klima|aircon/.test(text))key='klima';else if(/isofix/.test(text))key='isofix';else if(/navig|navi\b/.test(text))key='navigacija';else if(/tempomat|cruise/.test(text))key='tempomat';else if(/kamera|camera/.test(text))key='kamera';else if(/parking|park.*senz|parkhilfe/.test(text))key='parking';else if(/grej.*sed|grij.*sjed|sitzheizung/.test(text))key='grejanjeSedista';else if(/panoram/.test(text))key='panorama';else if(/kozn|koza|leder/.test(text))key='koza';else if(/carplay/.test(text))key='carplay';else if(/android/.test(text))key='android';else if(/\bled\b/.test(text))key='led';
    if(/adaptiv/.test(text)&&key==='tempomat')key='adaptive';
    if(/kuka/.test(text))key='kuka';
    if(/android/.test(text)&&/carplay/.test(text)&&items.some(v=>/android auto|carplay/.test(v)))return 'listed';
    return items.some(v=>{
      if(v===text)return true;
      if(!key||!features[key].test(v))return false;
      if(/\b360\b/.test(text)&&!/\b360\b/.test(v))return false;
      if(/matrix/.test(text)&&!/matrix/.test(v))return false;
      if(/dvozon|2 zon/.test(text)&&!/2 zon/.test(v))return false;
      if(/android/.test(text)&&/carplay/.test(text))return /android auto|carplay/.test(v);
      return true;
    })?'listed':'unconfirmed';
  }
  function publicDescription(value){return String(value||'').replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[kontakt ostaje timu]').replace(/(?:\+41|0041)[\d\s().-]{8,20}/g,'[telefon ostaje timu]').trim();}
  function descriptionLabel(value){
    let v=String(value||'');
    if(v==='Sehr gepflegtes Fahrzeug! frisch ab MFK & Service!')return 'Veoma očuvano vozilo; prodavac navodi sveže obavljen MFK i servis.';
    const phrases=[['Unser Angebot für Sie:','Ponuda prodavca:'],['Frische MFK','Sveže obavljen MFK'],['Frischer Service','Sveže obavljen servis'],['Sehr gepflegter Zustand','Veoma očuvano stanje'],['Garantie gegen Aufpreis möglich','Garancija je moguća uz doplatu'],['Inzahlungnahme & Finanzierung auf Anfrage','Zamena vozila i finansiranje na upit'],['Besichtigung','Razgledanje vozila']];
    for(const [source,target] of phrases)v=v.replaceAll(source,target+'\n');
    return v.trim();
  }
  function accident(value){const v=normalize(value);return v==='nein'?'Prodavac navodi: nije havarisano.':v==='ja'?'Prodavac navodi: havarisano vozilo.':'Podatak o havariji nije potvrđen iz oglasa.';}
  function mfk(value,date){const v=normalize(value);return (v==='ja'?'Prodavac navodi „Ab MFK” — sa tehničkim pregledom.':v==='nein'?'Prodavac navodi da se vozilo ne isporučuje sa novim MFK pregledom.':'MFK status nije potvrđen iz oglasa.')+(date?' Poslednji MFK: '+date+'.':' Datum MFK nije preuzet.')+' Važenje nije nezavisno potvrđeno.';}
  const api={normalize,color,colorMatch,equipmentLabel,equipmentMatch,publicDescription,descriptionLabel,accident,mfk};
  root.SCListingDetails=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
