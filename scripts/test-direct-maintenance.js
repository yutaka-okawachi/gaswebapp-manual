'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/direct_maintenance.js'),'utf8');
function fixture(){
 const rows=[],notes=[{number:2,values:{de:'groß',ja:'大きい',source:'[GM]'}},{number:3,values:{de:'mit grossem Pathos',ja:'句',source:''}}];let cell='[GM]',writes=0;
 const map={getLastRow:()=>rows.length+1,getRange:(r,c,n,w)=>({getValues:()=>r===1?[['見出し','関連語形','語形区分','用語検索','実例検索','補足']]:rows}),appendRow:r=>{rows.push(r);writes++;}};
 const sheet={getRange:()=>({getFormula:()=>'',canEdit:()=>true,isPartOfMerge:()=>false,setValue:v=>{cell=v;notes[0].values.source=v;}})};
 const book={getSheetByName:n=>n==='Notes'?sheet:map};
 const c={console,rowCompletionBook_:()=>book,notesRegistrationRead_:()=>({rows:notes}),normalizeObservedTerm:s=>String(s).toLowerCase().replace(/ß/g,'ss'),maintenanceNotesSource_:()=>({de:'Grosser',source:'[RW: Oper]',proof:[{tab:'RW',german:'mit großer Wehmut',location:'1',number:2}]}),jevCandidateHeadwords:r=>r.map((a,i)=>({headword:a[0],option:'candidate_'+i})),rowCompletionHash_:x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'),rowCompletionLock_:fn=>fn(),notesRegistrationHeader_:()=>[],notesRegistrationColumns_:()=>({source:2}),sheetLiteralValue_:x=>x,SpreadsheetApp:{flush(){}},PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})}};
 vm.createContext(c);vm.runInContext(source,c);return {c,rows,notes,get writes(){return writes},get cell(){return cell}};
}
test('direct inspection does not require an observation or ledger; phrase parents excluded',()=>{const h=fixture(),s=h.c.directMaintenanceInspect('Grosser');assert.equal(s.term,'Grosser');assert.equal(s.notes.length,0);assert.equal(s.candidates.length,1);assert.equal(s.candidates[0].headword,'groß');assert.equal(h.writes,0);});
test('Grosser -> groß registers once and merges checked source',()=>{const h=fixture(),p=h.c.directMaintenanceAliasPreview('Grosser','groß','INFLECTION');assert.equal(p.missing[0],'[RW: Oper]');const r=h.c.directMaintenanceAliasSave('Grosser','groß','INFLECTION',p.signature);assert.equal(r.saved,true);assert.equal(h.rows[0][0],'groß');assert.equal(h.rows[0][1],'Grosser');assert.equal(h.rows[0][3],'対象');assert.equal(h.cell,'[GM], [RW: Oper]');h.c.directMaintenanceAliasSave('Grosser','groß','INFLECTION',p.signature);assert.equal(h.writes,1);});
test('different parent and phrase parent rejected without writing',()=>{const h=fixture();assert.throws(()=>h.c.directMaintenanceAliasPreview('Grosser','mit grossem Pathos','INFLECTION'));h.rows.push(['anders','Grosser','','対象','対象','']);assert.throws(()=>h.c.directMaintenanceAliasPreview('Grosser','groß','INFLECTION'),/別見出し/);assert.equal(h.writes,0);});
test('changed source requires refreshed preview',()=>{const h=fixture(),p=h.c.directMaintenanceAliasPreview('Grosser','groß','INFLECTION');h.notes[0].values.source='[RS: Oper]';assert.throws(()=>h.c.directMaintenanceAliasSave('Grosser','groß','INFLECTION',p.signature),/表示後/);assert.equal(h.writes,0);});
test('registered Notes is returned without API and self mapping is blocked',()=>{const h=fixture();assert.equal(h.c.directMaintenanceInspect('groß').notes.length,1);assert.throws(()=>h.c.directMaintenanceAliasPreview('gross','groß','INFLECTION'),/同じ形/);assert.equal(h.writes,0);});
test('invalid input and missing API key are explicit, not silently swallowed',()=>{const h=fixture();assert.throws(()=>h.c.directMaintenanceInspect('=bad'));assert.throws(()=>h.c.directMaintenanceAdvice('Grosser'),/APIキー/);});
test('existing text edit survives sheet sorting and rejects a changed body',()=>{
 const h=fixture();h.notes[0].values.ja='old JA';h.notes[0].values.en='old EN';
 const sheet=h.c.rowCompletionBook_().getSheetByName('Notes');
 h.c.namedSheetColumns_=()=>({positions:[0,1]});
 sheet.getRange=(r,c)=>({getFormula:()=>'',canEdit:()=>true,isPartOfMerge:()=>false,setValue:v=>{const row=h.notes.find(n=>n.number===r);row.values[c===1?'ja':'en']=v;}});
 const entry=h.c.directMaintenanceEntry('groß');h.notes[0].number=8;
 const result=h.c.directMaintenanceEdit('groß',entry.signature,{ja:'new JA',en:'new EN'});
 assert.equal(result.row,8);assert.equal(h.notes[0].values.ja,'new JA');
 h.c.directMaintenanceEdit('groß',entry.signature,{ja:'new JA',en:'new EN'});
 assert.throws(()=>h.c.directMaintenanceEdit('groß',entry.signature,{ja:'stale',en:'stale'}),/表示後/);
 assert.equal(h.notes[0].values.ja,'new JA');
});
