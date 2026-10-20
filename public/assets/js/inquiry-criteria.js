/* Search preferences originate in the submitted inquiry, never in an inferred listing. */
(function(root){
 'use strict';
 const number=value=>value==null||String(value).trim()===''?null:Number(value);
 const clean=note=>String(note||'').replace(/^Godište do:\s*\d{4}\.?\s*\n?/mg,'').replace(/^Kubikaža:\s*\d+\s*cm3\s*\n?/mg,'').trim();
 function read(record={}){
  const note=String(record.notes??record.note??'');
  return {yearFrom:number(record.yearFrom),yearTo:number(record.yearTo??note.match(/^Godište do:\s*(\d{4})\.?\s*$/m)?.[1]),engineCapacity:number(record.engineCapacity??note.match(/^Kubikaža:\s*(\d+)\s*cm3\s*$/m)?.[1]),note:clean(note)};
 }
 function notes(record){
  const values=read(record),{yearFrom,yearTo,engineCapacity}=values;
  for(const year of [yearFrom,yearTo])if(year!=null&&(!Number.isInteger(year)||year<1900||year>2100))throw Error('Proverite godište.');
  if(yearFrom!=null&&yearTo!=null&&yearTo<yearFrom)throw Error('Godište do mora biti isto ili novije od godišta od.');
  if(engineCapacity!=null&&(!Number.isInteger(engineCapacity)||engineCapacity<500||engineCapacity>10000))throw Error('Unesite kubikažu u cm³, npr. 2000.');
  return [yearTo!=null?'Godište do: '+yearTo:'',engineCapacity!=null?'Kubikaža: '+engineCapacity+' cm3':'',values.note].filter(Boolean).join('\n');
 }
 const api={read,notes,clean};if(typeof module==='object'&&module.exports)module.exports=api;else root.SCInquiryCriteria=api;
})(typeof window==='undefined'?this:window);
