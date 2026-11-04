'use strict';
// Synthetic edit events and property/cache services only. No live Sheet, triggers or API.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'scripts/test-row-completion.js'),'utf8'),box={exports:{}};
vm.runInNewContext(source.slice(0,source.indexOf('\nfor(const tab of Object.keys(schemas))'))+'\nmodule.exports={harness};',
 {require,module:box,exports:box.exports,__dirname,console,Buffer},{filename:'notes-guard-services-fixture.js'});
let passed=0;function test(name,fn){try{fn();passed++;}catch(e){e.message=name+': '+e.message;throw e;}}
function harness(){
 const h=box.exports.harness('Notes'),book=h.c.SpreadsheetApp.getActiveSpreadsheet(),cache=new Map();h.toasts=[];
 book.toast=(message,title,seconds)=>h.toasts.push({message,title,seconds});
 h.c.CacheService={getScriptCache:()=>({get:key=>{const x=cache.get(key);return x&&x.until>h.now?x.value:null;},put:(key,value,seconds)=>cache.set(key,{value,until:h.now+seconds*1000})})};
 h.append=(de='')=>{const n=h.rows.length+1;h.rows.push(h.headers.map(()=>''));h.formulas.push(h.headers.map(()=>''));h.put('de',de,n);return n;};
 h.event=(first,rows=1,{column=h.headers.indexOf('de')+1,width=1,oldValue,triggerUid}={})=>({source:book,oldValue,triggerUid,
  range:{getSheet:()=>h.sheet,getRow:()=>first,getNumRows:()=>rows,getColumn:()=>column,getNumColumns:()=>width}});
 h.edit=(number,de,oldValue)=>{h.put('de',de,number);h.c.onEdit(h.event(number,1,{oldValue}));};
 h.registry=()=>h.c.notesEntryGuardRead_(h.c.notesEntryGuardContext_(book)).state;
 return h;
}
test('manual new heading warns once, keeps every cell and makes no API or credential reads',()=>{
 const h=harness(),n=h.append('NEW_PRIVATE_HEADING'),before=JSON.stringify(h.rows);h.c.onEdit(h.event(n));
 assert.equal(h.toasts.length,1);assert(!h.toasts[0].message.includes('NEW_PRIVATE_HEADING'));assert.equal(JSON.stringify(h.rows),before);assert.equal(h.writes.length,0);assert.equal(h.fetches,0);assert.equal(h.keyReads,0);
 assert.equal(h.registry().rows[n-2][1],1);h.select(n);assert.equal(h.preview().rows[0].status,'blocked');assert(h.c.rowCompletionState().job.rows[0].message.includes('登録メニュー'));
});
test('simple plus installable trigger wake-ups deduplicate irrespective of auth/trigger identity',()=>{
 const h=harness(),n=h.append('manual new term'),event=h.event(n);h.c.onEdit({...event,authMode:'LIMITED'});h.c.onEdit({...event,authMode:'FULL',triggerUid:'synthetic-installed'});
 assert.equal(h.toasts.length,1);h.now+=61000;h.c.onEdit({...event,triggerUid:'another-installed'});assert.equal(h.toasts.length,1);
});
test('ordinary edits and renames of existing rows are never classified as a new item',()=>{
 const h=harness();h.edit(2,'Renamed existing heading','Leise');assert.equal(h.toasts.length,0);assert.equal(h.registry().rows[0][1],2);
 h.c.onEdit(h.event(2,1,{column:h.headers.indexOf('ja')+1,oldValue:'before'}));assert.equal(h.toasts.length,0);
 h.put('de','Bulk renamed existing one',3);h.put('de','Bulk renamed existing two',4);h.c.onEdit(h.event(3,2));assert.equal(h.toasts.length,0);
});
test('multiple-row paste distinguishes existing rows from newly occupied blank rows',()=>{
 const h=harness(),first=h.append('first manual'),second=h.append('second manual'),third=h.append('third manual');
 h.c.onEdit(h.event(first,3,{column:1,width:h.headers.length}));assert.equal(h.toasts.length,1);assert(h.toasts[0].message.includes(String(first)));assert(h.toasts[0].message.includes(String(third)));
 assert([first,second,third].every(n=>h.registry().rows[n-2][1]===1));assert.equal(h.writes.length,0);
});
test('new row inserted inside the old data range warns, while shifted existing rows remain trusted',()=>{
 const h=harness();h.rows.splice(1,0,h.headers.map(()=>''));h.formulas.splice(1,0,h.headers.map(()=>''));h.put('de','Inserted new heading',2);
 h.c.onEdit(h.event(2));assert.equal(h.toasts.length,1);assert.equal(h.registry().rows[0][1],1);assert.equal(h.registry().rows[1][1],2);
});
test('cut/move of an existing heading is distinguished from a copied duplicate new row',()=>{
 const h=harness(),n=h.append();h.put('de','',2);h.put('de','Leise',n);h.c.onEdit(h.event(n));assert.equal(h.toasts.length,0);assert.equal(h.registry().rows[n-2][1],2);
 const h2=harness(),n2=h2.append('Leise');h2.c.onEdit(h2.event(n2));assert.equal(h2.toasts.length,1);
});
test('clearing and refilling only the heading remains an existing edit',()=>{
 const h=harness();h.edit(2,'','Leise');assert.equal(h.toasts.length,0);h.edit(2,'A corrected existing heading');assert.equal(h.toasts.length,0);assert.equal(h.value('de'),'A corrected existing heading');assert.equal(h.registry().rows[0][1],2);assert(h.c.notesEntryGuardExisting_(h.c.SpreadsheetApp.getActiveSpreadsheet(),h.sheet,2));
});
test('a canonical menu registration can remember its row without trusting unrelated manual rows',()=>{
 const h=harness(),manual=h.append('Unrelated manual'),official=h.append('Legitimate new Notes');
 assert(h.c.notesEntryGuardRemember_(h.c.SpreadsheetApp.getActiveSpreadsheet(),official,false));
 h.c.onEdit(h.event(official));assert.equal(h.toasts.length,0);h.c.onEdit(h.event(manual));assert.equal(h.toasts.length,1);
 assert.equal(h.registry().rows[official-2][1],2);assert.equal(h.registry().rows[manual-2][1],1);
});
test('protected cells are never written, and formula/format/note metadata is preserved',()=>{
 const h=harness(),n=h.append('Manual heading in editable part');h.editable=false;h.merged=true;const before=JSON.stringify({rows:h.rows,formulas:h.formulas,notes:h.notes,validation:h.validation});
 h.c.onEdit(h.event(n));assert.equal(h.toasts.length,1);assert.equal(JSON.stringify({rows:h.rows,formulas:h.formulas,notes:h.notes,validation:h.validation}),before);assert.equal(h.writes.length,0);
});
test('header edits, other tabs, unrelated columns and unconfigured workbooks do nothing',()=>{
 const h=harness();h.c.onEdit(h.event(1));h.c.onEdit(h.event(2,1,{column:h.headers.indexOf('en')+1}));
 h.c.onEdit({source:h.c.SpreadsheetApp.getActiveSpreadsheet(),range:{getSheet:()=>({getName:()=> 'GM'})}});
 h.script.set('SPREADSHEET_ID','different-book');h.c.onEdit(h.event(h.append('manual')));assert.equal(h.toasts.length,0);assert.equal(h.writes.length,0);
});
test('missing registry never warns or blocks editing an existing item',()=>{
 const h=harness();for(const key of [...h.script.keys()])if(key.startsWith('notes-entry-guard-v1:'))h.script.delete(key);
 h.edit(2,'Ordinary edit before initialization','Leise');assert.equal(h.toasts.length,0);assert.equal(h.writes.length,0);assert.notEqual(h.preview().rows[0].status,'blocked');
});
test('guard stores only hashes/states and never overwrites private completion drafts or configuration',()=>{
 const h=harness(),job=h.preview(),n=h.append('Unique private phrase');const model=h.script.get('OPENAI_DRAFT_MODEL');h.c.onEdit(h.event(n));
 assert.equal(h.c.rowCompletionState().job.id,job.id);assert.equal(h.script.get('OPENAI_DRAFT_MODEL'),model);
 const records=[...h.script].filter(([key])=>key.startsWith('notes-entry-guard-v1:')).map(([,v])=>v).join('');
 assert(!records.includes('Unique private phrase'));assert(!records.includes('synthetic-not-a-real-key'));assert.equal(h.fetches,0);
});
test('missing events, unavailable services and lock contention never mutate cells or create triggers',()=>{
 const h=harness();h.c.onEdit();h.c.onEdit({});h.locks=true;h.c.onEdit(h.event(h.append('new')));h.locks=false;assert.equal(h.toasts.length,0);assert.equal(h.writes.length,0);
 const code=fs.readFileSync(path.join(root,'src/notes_entry_guard.js'),'utf8');assert(!/UrlFetchApp|MailApp|ScriptApp|setValue|setValues|clearContent|setNote|setProtected/.test(code));
});
test('clearing every content cell removes the entry; a later new heading warns and stays untouched',()=>{
 const h=harness();for(const name of h.headers)h.put(name,'',2);h.c.onEdit(h.event(2,1,{column:1,width:h.headers.length}));assert.equal(h.toasts.length,0);assert.equal(h.registry().rows[0],null);
 h.edit(2,'Different newly added item');assert.equal(h.toasts.length,1);assert.equal(h.value('de'),'Different newly added item');assert.equal(h.writes.length,0);
});
test('body edits while the heading is temporarily blank retain the existing entry',()=>{
 const h=harness();h.edit(2,'','Leise');h.put('ja','User edits the original body',2);h.c.onEdit(h.event(2,1,{column:h.headers.indexOf('ja')+1}));h.edit(2,'Corrected original');
 assert.equal(h.toasts.length,0);assert.equal(h.registry().rows[0][1],2);assert.equal(h.writes.length,0);
});
test('multi-column replacement of existing entries is editing, including both bodies and heading',()=>{
 const h=harness();for(const n of [2,3]){h.put('de','Changed existing '+n,n);h.put('ja','Changed Japanese '+n,n);h.put('en','Changed English '+n,n);}
 h.c.onEdit(h.event(2,2,{column:1,width:h.headers.length}));assert.equal(h.toasts.length,0);assert.equal(h.registry().rows[0][1],2);assert.equal(h.registry().rows[1][1],2);assert.equal(h.writes.length,0);
});
test('paste spanning existing and appended rows warns only for new rows',()=>{
 const h=harness(),oldLast=h.rows.length;h.put('de','Edited last existing',oldLast);const a=h.append('New pasted a'),b=h.append('New pasted b');
 h.c.onEdit(h.event(oldLast,3,{column:1,width:h.headers.length}));assert.equal(h.toasts.length,1);assert(h.toasts[0].message.includes(a+'・'+b));assert.equal(h.registry().rows[oldLast-2][1],2);assert.equal(h.writes.length,0);
});
test('sorting all rows including duplicate headings preserves existing classifications',()=>{
 const h=harness(),paired=h.rows.slice(1).map((r,i)=>({r,f:h.formulas[i+1]})).sort((a,b)=>String(b.r[0]).localeCompare(String(a.r[0])));
 h.rows.splice(1,h.rows.length-1,...paired.map(x=>x.r));h.formulas.splice(1,h.formulas.length-1,...paired.map(x=>x.f));h.c.onEdit(h.event(2,paired.length,{column:1,width:h.headers.length}));
 assert.equal(h.toasts.length,0);assert(h.registry().rows.every(r=>!r||r[1]===2));assert.equal(h.writes.length,0);
});
test('an unobserved sort followed by an existing single-cell rename uses oldValue',()=>{
 const h=harness(),n=h.rows.length;[h.rows[1],h.rows[n-1]]=[h.rows[n-1],h.rows[1]];[h.formulas[1],h.formulas[n-1]]=[h.formulas[n-1],h.formulas[1]];
 const old=h.value('de',2);h.put('source','[GM]',2);h.edit(2,'Renamed after sorting',old);assert.equal(h.toasts.length,0);assert.equal(h.registry().rows[0][1],2);assert(h.c.notesEntryGuardExisting_(h.c.SpreadsheetApp.getActiveSpreadsheet(),h.sheet,2));
});
test('a blank-heading existing item can move before its heading is restored',()=>{
 const h=harness();h.put('ja','Unique existing body retained while moving',2);h.c.onEdit(h.event(2,1,{column:h.headers.indexOf('ja')+1}));h.edit(2,'','Leise');
 const row=h.rows.splice(1,1)[0],formula=h.formulas.splice(1,1)[0];h.rows.push(row);h.formulas.push(formula);const n=h.rows.length;h.edit(n,'Restored moved existing heading');
 assert.equal(h.toasts.length,0);assert.equal(h.registry().rows[n-2][1],2);assert.equal(h.writes.length,0);
});
function addManagementIds(h){h.headers.push('maintenance_id');h.formulas[0].push('');h.notes.push('keep-note');h.validation.push('keep-validation');for(let i=1;i<h.rows.length;i++){h.rows[i].push('entry-'+i);h.formulas[i].push('');}h.c.onEdit(h.event(2,h.rows.length-1,{column:h.headers.length}));}
test('management identity survives move plus replacement of every ordinary content field',()=>{
 const h=harness();addManagementIds(h);const row=h.rows.splice(1,1)[0],formula=h.formulas.splice(1,1)[0];h.rows.push(row);h.formulas.push(formula);const n=h.rows.length;
 for(const field of ['de','ja','en','source','ja_old'])h.put(field,'Edited '+field,n);h.c.onEdit(h.event(n,1,{column:1,width:h.headers.length}));
 assert.equal(h.toasts.length,0);assert.equal(h.registry().rows[n-2][1],2);assert.equal(h.value('maintenance_id',n),'entry-1');assert.equal(h.writes.length,0);
});
test('a copied entire row including its ID is a new copy, not a moved entry',()=>{
 const h=harness();addManagementIds(h);h.rows.push(h.rows[1].slice());h.formulas.push(h.formulas[1].slice());const n=h.rows.length;h.c.onEdit(h.event(n,1,{column:1,width:h.headers.length}));
 assert.equal(h.toasts.length,1);assert.equal(h.registry().rows[n-2][1],1);assert.equal(h.registry().rows[0][1],2);assert.equal(h.writes.length,0);
});
test('body-first manual new entry warns only when its heading is added',()=>{
 const h=harness(),n=h.append();h.put('ja','A body for an unregistered new item',n);h.c.onEdit(h.event(n,1,{column:h.headers.indexOf('ja')+1}));assert.equal(h.toasts.length,0);
 h.edit(n,'New heading after body');assert.equal(h.toasts.length,1);assert.equal(h.registry().rows[n-2][1],1);assert.equal(h.writes.length,0);
});
test('legacy hash-only snapshots upgrade without promoting previously warned manual entries',()=>{
 const h=harness(),n=h.append('Existing unregistered manual');h.c.onEdit(h.event(n));const context=h.c.notesEntryGuardContext_(h.c.SpreadsheetApp.getActiveSpreadsheet());
 const rows=h.rows.slice(1).map((r,i)=>[h.c.rowCompletionHash_(h.value('de',i+2).normalize('NFC')),i+2===n?1:2]);
 h.c.notesEntryGuardSave_(context,{sheetId:h.sheet.getSheetId(),rows});assert(h.c.notesEntryGuardInitialize_());assert.equal(h.registry().version,2);assert.equal(h.registry().rows[n-2][1],1);assert.equal(h.registry().rows[0][1],2);assert.equal(h.writes.length,0);
});
test('corrupt or missing advisory copies do not warn or block existing editing',()=>{
 const h=harness();for(const k of [...h.script.keys()])if(k.startsWith('notes-entry-guard-v1:'))h.script.set(k,'broken');h.edit(2,'Existing edit with unavailable advisory','Leise');
 assert.equal(h.toasts.length,0);assert.notEqual(h.preview().rows[0].status,'blocked');assert.equal(h.writes.length,0);assert.equal(h.fetches,0);
});
test('property storage remains bounded at 2500 rows with full identity fingerprints',()=>{
 const h=harness();while(h.rows.length<2501)h.append('Existing '+h.rows.length);addManagementIds(h);for(const k of [...h.script.keys()])if(k.startsWith('notes-entry-guard-v1:'))h.script.delete(k);
 assert(h.c.notesEntryGuardInitialize_());h.edit(2,'Existing large-registry correction','Leise');assert.equal(h.registry().rows.length,2500);assert.equal(h.toasts.length,0);
 const entries=[...h.script].filter(([k])=>k.startsWith('notes-entry-guard-v1:'));assert(entries.every(([,v])=>Buffer.byteLength(v,'utf8')<9000));assert(entries.reduce((n,[k,v])=>n+Buffer.byteLength(k+v,'utf8'),0)<500*1024);assert.equal(h.writes.length,0);
});
test('blank-heading move is recognized even when other existing rows share its body fingerprint',()=>{
 const h=harness();h.edit(2,'','Leise');const row=h.rows.splice(1,1)[0],formula=h.formulas.splice(1,1)[0];h.rows.push(row);h.formulas.push(formula);const n=h.rows.length;h.edit(n,'Restored duplicate-body existing');
 assert.equal(h.toasts.length,0);assert.equal(h.registry().rows[n-2][1],2);assert.equal(h.writes.length,0);
});
test('a new row reusing a moved blank entry slot cannot steal that entry identity',()=>{
 const h=harness();h.edit(2,'','Leise');const old=h.rows.splice(1,1)[0],formula=h.formulas.splice(1,1)[0];h.rows.splice(1,0,h.headers.map(()=>''));h.formulas.splice(1,0,h.headers.map(()=>''));h.rows.push(old);h.formulas.push(formula);const n=h.rows.length;
 h.put('de','New row at reused position',2);h.put('ja','Different new body',2);h.put('de','Restored moved original',n);h.c.onEdit(h.event(2,n-1,{column:1,width:h.headers.length}));
 assert.equal(h.toasts.length,1);assert.equal(h.registry().rows[0][1],1);assert.equal(h.registry().rows[n-2][1],2);assert.equal(h.writes.length,0);
});
console.log('Notes manual-entry guard: '+passed+' scenarios passed; existing edits, paste, moved rows, duplicate events, protected data, private drafts and configuration preserved. No live calls.');
