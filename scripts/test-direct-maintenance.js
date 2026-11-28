'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/direct_maintenance.js'),'utf8');
function richBuilder(){let text='';const links=[];return {setText(v){text=v;return this;},setTextStyle(){return this;},setLinkUrl(start,end,url){links.push({start,end,url});return this;},build(){return {getText:()=>text,links};}};}
function styleBuilder(){return {setFontFamily(){return this;},setFontSize(){return this;},setItalic(){return this;},build(){return {};}};}
function fixture(){
 const rows=[],notes=[{number:2,values:{de:'groß',ja:'大きい',source:'[GM]'}},{number:3,values:{de:'mit grossem Pathos',ja:'句',source:''}}];let cell='[GM]',writes=0;
 const map={getLastRow:()=>rows.length+1,getRange:(r,c,n,w)=>({getValues:()=>r===1?[['見出し','関連語形','語形区分','用語検索','実例検索','補足']]:rows}),appendRow:r=>{rows.push(r);writes++;}};
 const sheet={getRange:()=>({getFormula:()=>'',canEdit:()=>true,isPartOfMerge:()=>false,setValue:v=>{cell=v;notes[0].values.source=v;}})};
 const book={getSheetByName:n=>n==='Notes'?sheet:map};
 const c={console,rowCompletionBook_:()=>book,notesRegistrationRead_:()=>({rows:notes}),normalizeObservedTerm:s=>String(s).toLowerCase().replace(/ß/g,'ss'),maintenanceNotesSource_:()=>({de:'Grosser',source:'[RW: Oper]',proof:[{tab:'RW',german:'mit großer Wehmut',location:'1',number:2}]}),jevCandidateHeadwords:r=>r.map((a,i)=>({headword:a[0],option:'candidate_'+i})),rowCompletionHash_:x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'),rowCompletionLock_:fn=>fn(),notesRegistrationHeader_:()=>[],notesRegistrationColumns_:()=>({source:2}),sheetLiteralValue_:x=>x,SpreadsheetApp:{flush(){},newRichTextValue:richBuilder,newTextStyle:styleBuilder},PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})}};
 vm.createContext(c);vm.runInContext(source,c);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/notes_example_provenance.js'),'utf8'),c);return {c,rows,notes,get writes(){return writes},get cell(){return cell}};
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
 sheet.getRange=(r,c)=>({getFormula:()=>'',canEdit:()=>true,isPartOfMerge:()=>false,getRichTextValue:()=>null,setRichTextValue:v=>{const row=h.notes.find(n=>n.number===r);row.values[c===1?'ja':'en']=v.getText();}});
 const entry=h.c.directMaintenanceEntry('groß');h.notes[0].number=8;
 const result=h.c.directMaintenanceEdit('groß',entry.signature,{ja:'new JA',en:'new EN'});
 assert.equal(result.row,8);assert.equal(h.notes[0].values.ja,'new JA');
 h.c.directMaintenanceEdit('groß',entry.signature,{ja:'new JA',en:'new EN'});
 assert.throws(()=>h.c.directMaintenanceEdit('groß',entry.signature,{ja:'stale',en:'stale'}),/表示後/);
 assert.equal(h.notes[0].values.ja,'new JA');
});
test('Notes text lookup and save do not depend on the word-form mapping sheet',()=>{
 const h=fixture(),book=h.c.rowCompletionBook_(),sheet=book.getSheetByName('Notes');
 h.notes[0].values.en='Old English';
 book.getSheetByName=name=>name==='Notes'?sheet:null;
 h.c.namedSheetColumns_=()=>({positions:[0,1]});
 sheet.getRange=(r,c)=>({getFormula:()=>'',canEdit:()=>true,isPartOfMerge:()=>false,getRichTextValue:()=>null,
  setRichTextValue:v=>{h.notes.find(n=>n.number===r).values[c===1?'ja':'en']=v.getText();}});
 const entry=h.c.directMaintenanceEntry('groß');
 assert.equal(h.c.directMaintenanceEdit('groß',entry.signature,{ja:'新しい本文',en:entry.en}).status,'saved');
 assert.equal(h.notes[0].values.ja,'新しい本文');
 assert.equal(h.notes[0].values.en,'Old English');
 assert.throws(()=>h.c.directMaintenanceInspect('groß'),/語形対応/);
});
test('saved Japanese edit preserves the example, existing score hyperlink, and neighboring row after sorting',()=>{
 const h=fixture(),sheet=h.c.rowCompletionBook_().getSheetByName('Notes');
 const link='https://example.test/score.pdf#page=15', label='参照譜';
 const ja='【補足】\n長い説明を書いてある．\n\n【音楽用語としての訳例】\n[GM]\nGroß.\n大きく．\n\n【参考資料】\n'+label;
 Object.assign(h.notes[0].values,{ja,en:'Keep existing English.',approval:'approved'});
 const edited=h.notes[0],neighbor=h.notes[1],untouched=JSON.stringify(neighbor.values);
 let writes=[];
 h.c.namedSheetColumns_=()=>({positions:[1,2]});
 sheet.getRange=(r,c)=>({getFormula:()=>'',canEdit:()=>true,isPartOfMerge:()=>false,getRichTextValue:()=>({
   getText:()=>ja,getRuns:()=>[{getStartIndex:()=>ja.indexOf(label),getEndIndex:()=>ja.length,getTextStyle:()=>({}),getLinkUrl:()=>link}]
 }),setRichTextValue:v=>{
   const row=h.notes.find(n=>n.number===r),field=c===2?'ja':'en';
   row.values[field]=v.getText();writes.push({r,field,links:v.links});
 }});
 const entry=h.c.directMaintenanceEntry('groß'),next=ja.replace('長い説明を書いてある','短い説明');
 edited.number=3;neighbor.number=2;
 assert.equal(h.c.directMaintenanceEdit('groß',entry.signature,{ja:next,en:entry.en}).row,3);
 assert.deepEqual(writes,[{r:3,field:'ja',links:[{start:next.indexOf(label),end:next.length,url:link}]}]);
 assert.equal(edited.values.ja,next);
 assert.equal(edited.values.en,entry.en);
 assert.equal(edited.values.source,'[GM]');
 assert.equal(edited.values.approval,'approved');
 assert.equal(JSON.stringify(neighbor.values),untouched);
});
test('existing edit adds provenance only to a changed adopted pair, leaves other language/source intact',()=>{
 const h=fixture();h.notes[0].values.ja='[RW: Oper]\nSie eilen ab.\n古い訳';h.notes[0].values.en='Keep existing English';
 const originalBook=h.c.rowCompletionBook_(),sheet=originalBook.getSheetByName('Notes');let writes=0;
 const metadata={getDataRange:()=>({getValues:()=>[['Oper','Composer','Opera_Title','Work_Number'],['liebes','Richard Wagner','恋愛禁制 (Das Liebesverbot)','WWV 38']]})};
 h.c.rowCompletionBook_=()=>({getSheetByName:n=>n==='楽譜情報'?metadata:n==='RW'?{getLastRow:()=>2}:originalBook.getSheetByName(n)});
 h.c.namedSheetRead_=()=>({values:[['Sie eilen ab.','急いで退場する．','They hurry off.','liebes']]});
 h.c.namedSheetColumns_=()=>({positions:[0,1]});
 sheet.getRange=(r,c)=>({getFormula:()=>'',canEdit:()=>true,isPartOfMerge:()=>false,getRichTextValue:()=>null,setRichTextValue:v=>{writes++;h.notes[0].values[c===1?'ja':'en']=v.getText();}});
 const entry=h.c.directMaintenanceEntry('groß'),fields={ja:'[RW: Oper]\nSie eilen ab.\n急いで退場する．',en:entry.en};
 h.c.directMaintenanceEdit('groß',entry.signature,fields);
 assert.equal(writes,1);assert.ok(h.notes[0].values.ja.endsWith('《Das Liebesverbot》 WWV 38'));assert.equal(h.notes[0].values.en,entry.en);assert.equal(h.notes[0].values.source,'[GM]');
 const saved=h.c.directMaintenanceEntry('groß');h.c.directMaintenanceEdit('groß',saved.signature,{ja:saved.ja,en:saved.en});assert.equal(writes,1);
});
