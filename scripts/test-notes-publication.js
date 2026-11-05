'use strict';
// Current Sheets are authoritative. Synthetic services only; no API or production writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createRequire}=require('node:module'),root=path.resolve(__dirname,'..');
const utilities={DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,text)=>[...crypto.createHash('sha256').update(text).digest()]};
const c=vm.createContext({Utilities:utilities});vm.runInContext(fs.readFileSync(path.join(root,'src/notes_registration.js'),'utf8'),c);
let passed=0;const test=(name,fn)=>{try{fn();passed++;}catch(e){e.message=name+': '+e.message;throw e;}};
const clone=x=>JSON.parse(JSON.stringify(x));
test('current Notes rows ignore old publication states, missing IDs, duplicate IDs and blank sources',()=>{
 const header=['source','maintenance_observation_id','ja','publication_state','de','maintenance_id','en','publication_state'];
 for(const state of ['','draft','writing','unknown','approved:obsolete']){
  const rows=c.notesSheetRows_([header,['','','現在の本文．',state,'Saite','duplicate','Current body.',state],['[GM]','','別の本文．',state,'Bogen','duplicate','Another body.',state]]);
  assert.equal(rows.length,2);assert.equal(rows[0].values.de,'Saite');assert.equal(rows[0].values.source,'');assert.deepEqual(Object.keys(rows[0]).sort(),['number','values']);
 }
 assert.throws(()=>c.notesSheetRows_([['de','de','ja','source'],['a','b','日','']]),/重複/);
 assert.equal(c.notesSheetRows_([['de','ja','source'],['Saite','弦．','']])[0].values.en,'');
 assert(!fs.existsSync(path.join(root,'src/notes_publication_baseline.js')));
});
test('registration hashes preserve exact text; retry metadata has no approval state',()=>{
 const values={de:'Saite',ja:'弦\n説明',en:'String.',source:'[GM]'};
 assert.equal(c.notesRegistrationHash_(values),crypto.createHash('sha256').update(JSON.stringify(Object.values(values))).digest('hex'));
 assert.notEqual(c.notesRegistrationHash_(values),c.notesRegistrationHash_({...values,ja:'弦\r\n説明'}));
 const rows=[['de','ja','en','source'],['Saite','弦','String','']],writes=[];
 const sheet={getName:()=> 'Notes',getLastColumn:()=>rows[0].length,getLastRow:()=>rows.length,getMaxColumns:()=>100,
  getDataRange:()=>({getValues:()=>clone(rows)}),getRange:(r,col,n=1,w=1)=>({getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>rows[r+i-1]?.[col+j-1]??'')),canEdit:()=>true,isPartOfMerge:()=>false,setValues(data){writes.push(data);for(let i=0;i<n;i++)for(let j=0;j<w;j++)rows[r+i-1][col+j-1]=data[i][j];}})};
 const before=JSON.stringify(rows);assert.equal(c.notesRegistrationRead_(sheet).rows[0].entryId,'');assert.equal(JSON.stringify(rows),before);assert.equal(writes.length,0);
 assert.equal(c.notesRegistrationEnsureColumns_(sheet).appended.length,2);assert(!rows[0].includes('publication_state'));
 const count=writes.length;c.notesRegistrationEnsureColumns_(sheet);assert.equal(writes.length,count);
 assert.throws(()=>c.notesRegistrationCell_(sheet,2,'publication_state'));
});
const fixture=path.join(__dirname,'test-bilingual-sync.js'),prefix=fs.readFileSync(fixture,'utf8').split('const legacy=')[0];
const synthetic=vm.runInNewContext(prefix+';({c,tables});',{require:createRequire(fixture),__dirname,console});
const gas=synthetic.c,tables=synthetic.tables;gas.Utilities=utilities;
const originalBook=gas.SpreadsheetApp.openById();
gas.SpreadsheetApp.openById=()=>({getSheetByName(name){const s=originalBook.getSheetByName(name);return s&&{...s,getName:()=>name,getLastRow:()=>tables[name].length};}});
gas.PropertiesService={getScriptProperties:()=>({getProperty:()=> 'synthetic'})};
vm.runInContext(fs.readFileSync(path.join(root,'src/dashboard_analytics.js'),'utf8'),gas);
tables.Notes[0].push('maintenance_id','publication_state','maintenance_observation_id');
tables.Notes.push(['','','','','']);
tables.Notes.push(['Saite','弦．','String.','[GM]','PRIVATE_OLD','','writing','RETRY_ID_NOT_PUBLIC']);
tables.Notes.push(['OhneQuelle','出典未記入の既存本文．','Existing body without source.','','PRIVATE_OLD','duplicate','unknown','RETRY_ID_NOT_PUBLIC']);
tables['語形対応'].push(['Saite','Saiten','複数形','対象','対象','']);
const capture=()=>clone(gas.exportAllDataToJson({requestId:'sheet-source-fixture',includeEnglish:true}));
test('Sheet rows reach both languages, HTML, search indexes, aliases and dashboard regardless of old flags',()=>{
 const s=capture(),notes=s.files['mahler-search-app/data/dic_notes.json'];
 assert.equal(Object.keys(s.files).length,58);assert.equal(notes.length,3);assert.deepEqual(notes.find(r=>r[0]==='Saite'),['Saite','弦．','[GM]']);
 assert.equal(s.englishSource.tabs.Notes.length,3);assert.equal(s.englishSource.tabs.Notes.find(r=>r.de==='Saite').__row,4);
 assert.equal(s.englishSource.termMappings.length,2);assert.equal(s.files['mahler-search-app/data/dic_terms_index.json'].saiten.id,'term-saite');
 assert(gas.generateDicHtmlFromSpreadsheet().includes('term-saite'));assert(gas.generateDicHtmlFromSpreadsheet().includes('OhneQuelle'));
 assert.equal(gas.readDashboardTranslationMap().saite,'弦．');assert.equal(gas.readDashboardTranslationMap('en').saite,'String.');
 const prepared=require('./sync/bilingual').prepare(s,s.requestId);
 assert.equal(prepared.english['en/mahler-search-app/data/dic_notes.json'].length,3);
 assert(prepared.english['en/mahler-search-app/dic.html'].includes('term-saite'));
 assert.equal(prepared.english['en/mahler-search-app/data/dic_terms_index.json'].saiten.id,'term-saite');
 assert(!/PRIVATE_OLD|maintenance_id|publication_state|RETRY_ID_NOT_PUBLIC/.test(JSON.stringify(s)+JSON.stringify(prepared.english)));
});
test('direct edits immediately become the next snapshot with no approval or metadata writes',()=>{
 const row=tables.Notes[3];row[1]+=' 手動編集．';row[2]+=' Edited directly.';row[3]='';row[5]='duplicate';row[6]='';
 const before=JSON.stringify(tables),s=capture();assert.equal(s.files['mahler-search-app/data/dic_notes.json'].find(r=>r[0]==='Saite')[1],row[1]);
 assert.equal(s.englishSource.tabs.Notes.find(r=>r.de==='Saite').en,row[2]);assert.equal(gas.readDashboardTranslationMap().saite,row[1]);assert.equal(JSON.stringify(tables),before);
});
test('missing mapping targets remain validation errors rather than silently dropping auxiliary data',()=>{
 tables['語形対応'].push(['MissingHeading','missing-form','別綴り','対象','対象','']);assert.throws(capture);tables['語形対応'].pop();
});
console.log('Notes sheet source: '+passed+' scenarios passed; no allowlist/approval dependency, blank-source compatibility, current JA/EN/HTML/index/alias/dashboard values and complete-registration-only retry IDs. No live writes.');
