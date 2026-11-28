'use strict';
// Shared corpus evidence checks only. No legacy ledger, UI, API or registration fixture.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');let passed=0;
function test(name,fn){try{fn();passed++;}catch(e){e.message=name+': '+e.message;throw e;}}
function sourceScanFixture(term,byTab){
 const h={relatedSheets:{},writes:[],fetches:0};
 for(const tab of ['GM','RW','RS']){
  const headers=tab==='GM'?['de','data']:['de','Oper','Aufzug','Szene','page','whom'];
  const defaults={data:'M-1-1-1-all&',Oper:'synthetic-work',Aufzug:1,Szene:1,page:1,whom:''};
  const data=[headers,...(byTab[tab]||[]).map(v=>{const r=typeof v==='string'?{de:v}:v;return headers.map(k=>r[k]!==undefined?r[k]:defaults[k]!==undefined?defaults[k]:'');})];
  h.relatedSheets[tab]={data,getName:()=>tab,getSheetId:()=>({GM:101,RW:102,RS:103}[tab]),getLastRow:()=>data.length,getLastColumn:()=>headers.length,
   getRange:(r,c,n=1,w=1)=>({getFormulas:()=>Array.from({length:n},()=>Array(w).fill('')),getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>data[r+i-1]?.[c+j-1]??'')),getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>String(data[r+i-1]?.[c+j-1]??'')))})};
 }
 const book={getSheetByName:name=>h.relatedSheets[name]};
 h.c=vm.createContext({console,SpreadsheetApp:{getActiveSpreadsheet:()=>book},rowCompletionError_:message=>new Error(message),rowCompletionHash_:value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')});
 for(const name of ['sheet_column_layout.js','dictionary_candidate_workflow.js','maintenance_workbench.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',name),'utf8'),h.c,{filename:name});
 h.source=()=>h.c.maintenanceNotesSource_(book,term);return h;
}
test('Aufzug base forms remain discoverable after genitives in any corpus and row order',()=>{
 for(const tab of ['GM','RW','RS'])for(const originals of [
  ['Aufzuges','Aufzugs','Ein Aufzug beginnt.'],['Ein Aufzug beginnt.','Aufzuges','Aufzugs'],['Aufzugs','Unrelated word.','Aufzuges','Ein Aufzug beginnt.']
 ]){
  const h=sourceScanFixture('Aufzug',{[tab]:originals}),before=JSON.stringify(h.relatedSheets[tab].data),plan=h.source(),p=plan.proof[0];
  assert.equal(plan.de,'Aufzug');assert.equal(plan.proof.length,1);assert.equal(p.tab,tab);assert.equal(p.number,originals.indexOf('Ein Aufzug beginnt.')+2);assert.equal(p.german,'Ein Aufzug beginnt.');
  assert.equal(p.hash,h.c.rowCompletionHash_(h.c.namedSheetRead_(h.relatedSheets[tab],p.fields,p.number,1).values[0]));
  assert.equal(JSON.stringify(h.relatedSheets[tab].data),before);assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
 }
});
test('source evidence prefers each available base row and keeps evidenced inflected-only corpora',()=>{
 const h=sourceScanFixture('Aufzug',{RS:['Aufzuges','Der Aufzug.'],RW:['Aufzugs'],GM:['Aufzuges','Aufzug.']}),p=h.source();
 assert.equal(p.source,'[RS: Oper], [RW: Oper], [GM]');assert.equal(p.de,'Aufzug');
 assert.deepEqual([...p.proof].map(r=>[r.tab,r.number]),[['RS',3],['RW',2],['GM',3]]);
 h.c.maintenanceNotesVerifySource_(h.c.SpreadsheetApp.getActiveSpreadsheet(),p);assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
});
test('other words, phrases and requested case retain base-form matching after inflections',()=>{
 for(const [word,suffix,base]of [['Saite','Saiten','G-Saite'],['Bogen','Bogens','mit Bogen'],['Märchen','Märchens','ein Märchen'],['sehr ruhig','sehr ruhigen','sehr ruhig spielen']]){
  const h=sourceScanFixture(word,{RS:[suffix,base]}),p=h.source();assert.equal(p.de,word);assert.equal(p.proof[0].number,3);assert.equal(p.proof[0].german,base);
 }
 const h=sourceScanFixture('Aufzug',{RS:['Aufzuges','AUFZUG','Aufzug']}),p=h.source();assert.equal(p.de,'Aufzug');assert.equal(p.proof[0].number,4);
});
test('suffixes without a witnessed base form stop before generation or registration',()=>{
 const h=sourceScanFixture('Aufzug',{RS:['Aufzuges'],RW:['Aufzugs'],GM:['Aufzuges']});
 assert.throws(()=>h.source(),/形そのもの/);assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
});
test('partial compounds, other words, digits and adjacent Unicode letters never supply a base form',()=>{
 for(const word of ['Bühnenaufzug','Aufzugsmusik','Aufzug1','1Aufzug','éAufzug','Aufzugé','Aufzug\u0301','Seite']){
  const h=sourceScanFixture('Aufzug',{RS:[word]});assert.throws(()=>h.source(),/確認できません|特定できません/);assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
 }
 const h=sourceScanFixture('Saite',{GM:['Seite','Saitenspiel']});assert.throws(()=>h.source(),/特定できません/);
});
test('a real base in another tab never admits partial or unrelated words as extra sources',()=>{
 for(const word of ['Bühnenaufzug','Aufzugsmusik','Aufzug1','1Aufzug','éAufzug','Aufzugé','Aufzug\u0301','Seite']){
  const h=sourceScanFixture('Aufzug',{RS:[word],RW:['Aufzug']}),p=h.source();
  assert.equal(p.source,'[RW: Oper]');assert.equal(p.proof.length,1);assert.equal(p.proof[0].tab,'RW');assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
 }
});
test('the last eligible base at the existing 6000-row bound is found without guessing from earlier inflections',()=>{
 const originals=Array(5999).fill('Aufzuges');originals.push('Aufzug');
 const h=sourceScanFixture('Aufzug',{RS:originals}),p=h.source();assert.equal(p.de,'Aufzug');assert.equal(p.proof[0].number,6001);assert.equal(p.proof[0].german,'Aufzug');assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
});

test('invalid locations and oversized first matches do not hide later eligible base forms',()=>{
 for(const tab of ['RS','RW','GM']){
  const invalid=tab==='GM'?[{de:'Aufzug',data:''},{de:'Aufzug',data:'不明'}]:[{de:'Aufzug',Oper:''},{de:'Aufzug',page:'?'}];
  invalid.push({de:'Aufzug '+ 'x'.repeat(6001)});invalid.push(tab==='GM'?{de:'Aufzug',data:'x'.repeat(241)}:{de:'Aufzug',whom:'x'.repeat(241)});
  const h=sourceScanFixture('Aufzug',{[tab]:[...invalid,{de:'Der Aufzug.',page:0}]}),p=h.source();assert.equal(p.proof[0].number,invalid.length+2);assert.equal(p.de,'Aufzug');
 }
});
test('all eligible spellings are checked for ambiguity and source-size limits are preserved',()=>{
 const h=sourceScanFixture('Märchen',{RS:['Märchens','Märchen','Maerchen']});assert.throws(()=>h.source(),/原綴りが複数/);
 const limited=sourceScanFixture('Aufzug',{RS:['Aufzug']});limited.relatedSheets.RS.getLastRow=()=>6002;assert.throws(()=>limited.source(),/上限/);assert.equal(limited.fetches,0);assert.equal(limited.writes.length,0);
});

test('RW/RS skips missing work or page and accepts page zero',()=>{
 for(const tab of ['RW','RS']){
 const h=sourceScanFixture('Saite',{[tab]:[{de:'Saite',Oper:''},{de:'Saite',page:''},{de:'Saite',page:0}]}),p=h.source();assert.equal(p.proof[0].number,4);
 }
});
test('Source verification follows sorting but rejects modified evidence and tab replacement',()=>{
 const h=sourceScanFixture('Aufzug',{RS:['Aufzug','Other']}),p=h.source(),s=h.relatedSheets.RS,book=h.c.SpreadsheetApp.getActiveSpreadsheet();
 [s.data[1],s.data[2]]=[s.data[2],s.data[1]];
 h.c.maintenanceNotesVerifySource_(book,p);assert.equal(p.proof[0].number,3);
 s.data[2][0]='Changed';assert.throws(()=>h.c.maintenanceNotesVerifySource_(book,p));
 s.getSheetId=()=>999;assert.throws(()=>h.c.maintenanceNotesVerifySource_(book,p));
 assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
});
test('Decisions excerpts preserve distinct attested spellings and stay local unless requested',()=>{
 const long='vorher '.repeat(40)+'jemand tritt herein. '+'nachher '.repeat(40);
 const h=sourceScanFixture('tritt',{RS:[long,'Der Tritt ist hörbar.'],GM:['Er tritt vor.']});
 assert.equal(h.source().decisionEvidence,undefined);
 const p=h.c.maintenanceNotesSource_(h.c.SpreadsheetApp.getActiveSpreadsheet(),'tritt','alias',true);
 assert.ok(p.decisionEvidence.some(t=>t.includes('jemand tritt herein.')));
 assert.ok(p.decisionEvidence.some(t=>t.includes('Der Tritt ist hörbar.')));
 assert.ok(p.decisionEvidence.some(t=>t.includes('Er tritt vor.')));
 assert.ok(p.decisionEvidence.every(t=>t.length<=185));
 assert.equal(h.writes.length,0);
});
console.log('Shared maintenance source evidence: '+passed+' scenarios passed (read-only synthetic corpus).');
