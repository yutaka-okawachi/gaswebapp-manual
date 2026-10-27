'use strict';
// Deliberate pre-migration fixtures, independent of the current Sheet migration state.
// Only approved semantic IDs at their stable locations are converted, never canonical files.
const directionSpecs=[
 {id:'mahler-trill-chain',data:'M-2-5-55-dir&'},
 {id:'mahler-editorial-g2',data:'M-b1-t1-380-chor&'},
 {id:'feuersnot-desk-division',Oper:'feuersnot',Aufzug:'',Szene:'',page:320,replacement:'～ etc.'},
 {id:'salome-timpani-layout',Oper:'salome',Aufzug:'',Szene:4,page:287}
];
function legacyDirectionRows(rows){
 return rows.map(row=>{
  const spec=directionSpecs.find(s=>(s.data?row.data===s.data:['Oper','Aufzug','Szene','page'].every(k=>String(row[k]??'')===String(s[k]??'')))&&row.de.includes('[[score:'+s.id+']]'));
  if(!spec)return row;
  const token='[[score:'+spec.id+']]',copy={...row,de:row.de.replace(token,spec.replacement||'').trimEnd()};
  for(const key of ['ja','en'])if(typeof row[key]==='string')copy[key]=row[key].replace(token,'').trimEnd();
  return copy;
 });
}
function legacyNotesRows(rows){
 const token='[[score:hindemith-glockenspiel-fsharp5]]';
 return rows.map(row=>{
  if(row[2]!=='[H: KM1-1]'||!row[0].startsWith('Ein Stab aus einem Glockenspiel')||!row[0].includes(token))return row;
  const copy=[...row];copy[0]=row[0].replace(' '+token,'(の譜例)').replace(token,'(の譜例)');copy[1]=row[1].replace(token,'').trimEnd();return copy;
 });
}
module.exports={legacyDirectionRows,legacyNotesRows};

