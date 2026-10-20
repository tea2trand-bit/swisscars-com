// Only presentation controls for vehicle specifications/equipment are touched.
// No contact, consent, login or human-verification controls are operated.
export function expandListingDetails(){
  const names=new Set(['Ausstattungen','Masse, Gewicht & Erscheinungsbild','Alle optionale Ausstattung anzeigen','Alle serienmässige Ausstattung anzeigen','Fahrzeugbeschreibung','Motorfahrzeugkontrolle (MFK)','Garantie und Rückgabe']);
  let count=0;
  for(const button of document.querySelectorAll('button[aria-expanded="false"]')){
    if(names.has(button.innerText.trim())||(button.getAttribute?.('aria-controls')==='expandable-remarks'&&button.closest?.('#expandable-description')&&button.innerText.trim()==='Mehr anzeigen')){button.click();count++;}
  }
  return count;
}
