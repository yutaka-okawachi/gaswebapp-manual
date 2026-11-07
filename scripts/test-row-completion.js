'use strict';
// Entirely synthetic Spreadsheet/Properties/HTTP services; no credentials, Google or paid requests.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = ['sheet_column_layout.js', 'maintenance_text_style.js', 'row_completion_notes.js', 'row_completion_review.js', 'notes_entry_guard.js', 'row_completion.js'].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
// Select production-approved examples by identity, not their current exported row position.
const styleExampleTerms = vm.runInNewContext(fs.readFileSync(path.join(root, 'src/maintenance_text_style.js'), 'utf8') + '\nMAINTENANCE_STYLE_EXAMPLE_TERMS');
let passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }
const schemas = {
  GM: ['de','de_normalized','ja','en','data','ja_old','変更履歴'],
  RW: ['Oper','Aufzug','Szene','page','whom','whom_en','de','de_normalized','ja','en','ja_old'],
  RS: ['Oper','Aufzug','Szene','page','whom','whom_en','de','de_normalized','ja','en','ja_old'],
  Notes: ['de','ja','en','source','ja_old','準備状態']
};
function harness(tab = 'GM', options = {}) {
  const h = { user: 'one', fetches: 0, writes: [], locks: false, now: 1000000, uuid: 0, keyReads: 0 };
  let headers = schemas[tab].slice(); if (options.reverse) headers.reverse();
  const rows = [headers, ...Array.from({ length: 5 }, () => headers.map(name => ({ de:'Leise', data:'M-1-1-10-v1&', Oper:'feen', page:'0', whom:'Chor', source:'[H: KM1-1]', ja_old:'保存した旧訳', 準備状態:'承認', 変更履歴:'keep' }[name] || '')))];
  const file={GM:'mahler',RW:'richard_wagner',RS:'richard_strauss',Notes:'dic_notes'}[tab];
  const adoptedJa=JSON.parse(fs.readFileSync(path.join(root,'mahler-search-app/data/'+file+'.json'),'utf8'));
  const adoptedEn=JSON.parse(fs.readFileSync(path.join(root,'en/mahler-search-app/data/'+file+'.json'),'utf8'));
  const identity=r=>tab==='Notes'?r[0]:JSON.stringify([r.de,r.data,r.Oper,r.Aufzug,r.Szene,r.page]);
  const byId=new Map(adoptedEn.map(r=>[identity(r),r]));
  if(options.reverseData) adoptedJa.reverse();
  const exampleRows=adoptedJa.slice(0,80);
  for(const term of styleExampleTerms[tab]){
    const adopted=adoptedJa.find(row=>(tab==='Notes'?row[0]:row.de)===term);
    assert(adopted,'Missing production-approved style example: '+tab+':'+term);
    if(!exampleRows.includes(adopted))exampleRows.push(adopted);
  }
  for(const a of exampleRows){
    const b=byId.get(identity(a)),v=tab==='Notes'?{de:a[0],ja:a[1],en:b?b[1]:''}:{de:a.de,ja:a.ja,en:b?b.ja:''};
    rows.push(headers.map(name=>v[name]||''));
  }
  const formulas = Array.from({ length: rows.length }, () => headers.map(() => ''));
  const notes = headers.map(() => 'keep-note'), validation = headers.map(() => 'keep-validation');
  const column = name => headers.indexOf(name);
  h.put = (name, value, row = 2) => { rows[row - 1][column(name)] = value; };
  h.value = (name, row = 2) => rows[row - 1][column(name)];
  h.formula = (name, value, row = 2) => { formulas[row - 1][column(name)] = value; };
  h.editable = true; h.merged = false;
  const range = (r,c,n=1,w=1) => ({
    getSheet:()=>sheet,getRow:()=>r,getLastRow:()=>r+n-1,getNumRows:()=>n,
    getValues:()=>Array.from({length:n},(_,i)=>(rows[r+i-1]||headers.map(()=>'' )).slice(c-1,c+w-1)),
    getDisplayValues:()=>Array.from({length:n},(_,i)=>(rows[r+i-1]||headers.map(()=>'' )).slice(c-1,c+w-1).map(v=>String(v))),
    getFormulas:()=>Array.from({length:n},(_,i)=>(formulas[r+i-1]||headers.map(()=>'' )).slice(c-1,c+w-1)),
    getFormula:()=>formulas[r-1][c-1],getValue:()=>rows[r-1][c-1],getNotes:()=>Array.from({length:n},()=>notes.slice(c-1,c+w-1)),
    canEdit:()=>h.editable,isPartOfMerge:()=>h.merged,
    setValue(value) {
      if(h.beforeWrite)h.beforeWrite(r,c,value);
      h.writes.push({row:r,column:headers[c-1],value});
      rows[r-1][c-1]=typeof value==='string'&&value.startsWith("'")?value.slice(1):value;
      if(h.afterWrite)h.afterWrite(r,c,value);
    }
  });
  const sheet = {getName:()=>tab,getSheetId:()=>20,getMaxRows:()=>rows.length,getLastRow:()=>rows.length,getLastColumn:()=>headers.length,getRange:range};
  const approvedHeader=['区分','作品','指示対象（原語）','ユーザー選択案','ユーザー判断','第1案（推奨）','第2案','第3案','推奨理由・判断が難しい点','自由修正（英訳）'];
  h.approved = [[tab,'妖精 [feen]','Chor','第1案','承認','Chorus','','','','']];
  const approvalSheet={getLastRow:()=>4+h.approved.length,getRange(r){return{getDisplayValues:()=>r===4?[approvedHeader]:h.approved.map(row=>row.slice())};}};
  let active = range(2,1);
  h.select=(r,n=1)=>{active=range(r,1,n);};
  h.relatedSheets={};
  const book={getId:()=>'synthetic-book',getActiveSheet:()=>sheet,getActiveRange:()=>active,getSheetByName:name=>name===tab?sheet:name==='指示対象英訳確認'?approvalSheet:h.relatedSheets[name]||null};
  const script = new Map([['SPREADSHEET_ID','synthetic-book'],['OPENAI_API_KEY','synthetic-not-a-real-key'],['OPENAI_DRAFT_MODEL','synthetic-model']]), users=new Map();
  function props(map, personal) { return {
    getProperty:key=>{if(key==='OPENAI_API_KEY')h.keyReads++;return map.has(key)?map.get(key):null;},
    getKeys:()=>[...map.keys()],deleteProperty:key=>map.delete(key),
    setProperty(key,value){
      if(personal&&h.failProperty&&h.failProperty(key,value))throw Error('synthetic property failure');
      assert(Buffer.byteLength(value,'utf8')<9000);map.set(key,value);return this;
    },
    setProperties(values){for(const[k,v]of Object.entries(values))this.setProperty(k,v);return this;}
  }; }
  const personal=()=>{if(!users.has(h.user))users.set(h.user,new Map());return props(users.get(h.user),true);};
  class Clock extends Date { constructor(...args){super(...(args.length?args:[h.now]));} static now(){return h.now;} }
  const c=vm.createContext({console,Date:Clock,PropertiesService:{getScriptProperties:()=>props(script,false),getUserProperties:personal},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,text)=>[...crypto.createHash('sha256').update(text).digest()],getUuid:()=>`job-${++h.uuid}`},
    LockService:{getScriptLock:()=>({tryLock(){if(h.locks)return false;h.locks=true;return true;},releaseLock(){h.locks=false;}})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>book,flush(){}},
    UrlFetchApp:{fetch(url,request){
      h.fetches++;h.lastRequest=JSON.parse(request.payload);assert.equal(url,'https://api.openai.com/v1/responses');
      if(h.onFetch)h.onFetch();
      if(h.transportFailure)throw Error('synthetic transport failure');
      const input=JSON.parse(h.lastRequest.input),fields=h.lastRequest.text.format.schema.required;
      const draft=Object.fromEntries(fields.filter(field=>!['notes_support','review_notes'].includes(field)).map(field=>[field,(tab==='Notes'&&input.profile==='dictionary'&&!input.source.ja?(field==='ja'?'【一般的な意味】\n':'【General meanings】\n'):'')+(field==='ja'?'静かに ':'Softly ')+(field==='en'&&input.source.ja?input.source.ja:input.source.de)]));
      if(fields.includes('notes_support'))draft.notes_support={english:'',italian:'',rationale:'不明な対応語は保留する．',usage_ids:[]};
      if(fields.includes('review_notes'))draft.review_notes={reason:'',questions:''};
      if(h.mutateDraft)h.mutateDraft(draft);
      return {getResponseCode:()=>h.http||200,getContentText:()=>h.badJson?'not-json':JSON.stringify({status:h.incomplete?'incomplete':'completed',output:[{content:[{type:'output_text',text:JSON.stringify(draft)}]}]})};
    }}
  });
  vm.runInContext(source,c);Object.assign(h,{c,script,users,sheet,headers,rows,formulas,notes,validation});
  if(tab==='Notes')assert.equal(c.notesEntryGuardInitialize_(),true);
  h.preview=()=>c.rowCompletionPreview().job;
  h.generate=job=>c.rowCompletionGenerate(job.id,job.rows[0].number).job;
  h.apply=job=>c.rowCompletionApply(job.id,job.rows[0].number,JSON.parse(JSON.stringify(job.rows[0].draft))).job;
  return h;
}

for(const tab of Object.keys(schemas))for(const reverse of [false,true])test(tab+' original/reordered columns '+reverse,()=>{
  const h=harness(tab,{reverse}),before=JSON.stringify({notes:h.notes,validation:h.validation,formulas:h.formulas});
  let job=h.preview();assert.equal(h.fetches,0);assert.equal(h.writes.length,0);assert.equal(job.rows[0].status,'pending');
  job=h.generate(job);assert.equal(h.fetches,1);assert.equal(h.writes.length,0);assert.equal(job.rows[0].status,tab==='Notes'?'needs_review':'draft');
  job=h.apply(job);assert.equal(job.rows[0].status,'applied');assert.ok(h.value('ja'));assert.ok(h.value('en'));
  assert.equal(h.value('ja_old'),'保存した旧訳');assert.equal(JSON.stringify({notes:h.notes,validation:h.validation,formulas:h.formulas}),before);
  assert(h.writes.every(w=>['ja','en','whom_en'].includes(w.column)));
});
test('existing Japanese is context for English and stays verbatim',()=>{
  const h=harness('Notes');h.put('ja','【一般的な意味】\n既存本文 https://example.invalid/ref#page=3');
  let job=h.generate(h.preview());assert.deepEqual(Array.from(job.rows[0].targets),['en']);job=h.apply(job);
  assert.equal(h.value('ja'),'【一般的な意味】\n既存本文 https://example.invalid/ref#page=3');assert(h.value('en').includes('既存本文'));assert.equal(h.writes.length,1);
});
test('formula empty strings, spaces, array columns, merged/protected cells stay intact',()=>{
  for(const mode of ['formula','spaces','array','protected','merged']){
    const h=harness();if(mode==='formula'){h.formula('ja','=""');h.formula('en','=""');}
    if(mode==='spaces'){h.put('ja',' ');h.put('en','\t');}
    if(mode==='array'){h.formula('ja','=ARRAYFORMULA(A2:A)',3);h.formula('en','=FILTER(A2:A,A2:A<>"")',3);}
    if(mode==='protected')h.editable=false;if(mode==='merged')h.merged=true;
    assert.equal(h.preview().rows[0].status,'blocked',mode);assert.equal(h.writes.length,0);
  }
});
test('normalization ARRAYFORMULA and review columns never touched',()=>{
  const h=harness();h.formula('de_normalized','=ARRAYFORMULA(LOWER(A2:A))');let j=h.generate(h.preview());h.apply(j);
  assert.equal(h.formulas[1][h.headers.indexOf('de_normalized')],'=ARRAYFORMULA(LOWER(A2:A))');
});
test('missing context/unknown Notes source is held without API',()=>{
  for(const [tab,key,value]of [['Notes','source',''],['Notes','source','不明'],['GM','data',''],['RW','Oper',''],['RS','page',''],['GM','de','']]){
    const h=harness(tab);h.put(key,value);assert.equal(h.preview().rows[0].status,'blocked');assert.equal(h.fetches,0);
  }
});
test('zero page is valid, blank recipient is not invented',()=>{
  const h=harness('RW');h.put('page',0);h.put('whom','');const j=h.preview();assert.equal(j.rows[0].status,'pending');assert(!j.rows[0].targets.includes('whom_en'));
});
test('only uniquely approved recipient proposal, no API needed when text exists',()=>{
  const h=harness('RW');h.put('ja','既存');h.put('en','Existing');let j=h.generate(h.preview());assert.equal(h.fetches,0);assert.equal(j.rows[0].draft.whom_en,'Chorus');j=h.apply(j);assert.equal(h.value('whom_en'),'Chorus');
});
test('unapproved, ambiguous, or missing recipient translations are held without API invention',()=>{
  for(const mode of ['hold','duplicate','missing']){const h=harness('RS');if(mode==='hold')h.approved[0][4]='保留';if(mode==='duplicate')h.approved.push(h.approved[0].slice());if(mode==='missing')h.approved=[];
    const j=h.preview();assert(!j.rows[0].targets.includes('whom_en'));assert.match(j.rows[0].whomReview.message,/新しい英訳の確認が必要/);assert.equal(h.fetches,0);
    const generated=h.generate(j);assert.equal(h.fetches,1);assert(!JSON.parse(h.lastRequest.input).requested_fields.includes('whom_en'));h.apply(generated);assert.equal(h.value('whom_en'),'');
  }
});
test('recipient cannot be edited or use changed approval',()=>{
  const h=harness('RS'),j=h.generate(h.preview());assert.throws(()=>h.c.rowCompletionApply(j.id,2,{...j.rows[0].draft,whom_en:'Invented'}),/承認済み/);
  h.approved[0][4]='保留';assert.throws(()=>h.apply(j),/承認済み/);assert.equal(h.writes.length,0);assert.equal(h.value('whom_en'),'');
});
test('column/header changes stop before API or writes',()=>{
  for(const mode of ['duplicate','rename','move']){
    const h=harness();let j;if(mode==='duplicate'){h.headers[h.headers.indexOf('en')]='ja';assert.throws(()=>h.preview(),/重複/);continue;}
    j=h.preview();if(mode==='rename')h.headers[h.headers.indexOf('ja')]='new-name';else h.headers.reverse();
    assert.throws(()=>h.generate(j),/見出し|変更/);assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
  }
});
test('source mutation and manual values after preview block generation/application',()=>{
  const h=harness();let j=h.preview();h.put('de','Changed');assert.throws(()=>h.generate(j),/変更/);assert.equal(h.fetches,0);
  h.put('de','Leise');j=h.generate(j);h.put('ja','人の編集');assert.throws(()=>h.apply(j),/変更/);assert.equal(h.value('ja'),'人の編集');assert.equal(h.writes.length,0);
});
test('overlapping generation in same user or another user makes exactly one call',()=>{
  const h=harness();const j=h.preview();h.onFetch=()=>{
    assert.throws(()=>h.generate(j),/再生成/);
    assert.throws(()=>h.c.rowCompletionFinish(j.id,true),/生成処理中/);
    h.user='two';const other=h.preview();assert.throws(()=>h.generate(other),/未確認/);h.user='one';
  };h.generate(j);assert.equal(h.fetches,1);
});
test('private drafts isolated by user; shared ledger has no plaintext or key',()=>{
  const h=harness();const j=h.generate(h.preview());h.user='two';assert.equal(h.c.rowCompletionState().job,null);assert.throws(()=>h.c.rowCompletionGenerate(j.id,2),/本人/);
  const ledger=[...h.script].filter(([k])=>k.includes('claim:'));assert.equal(ledger.length,1);assert(!JSON.stringify(ledger).includes('Leise'));assert(!JSON.stringify([...h.users.get('one')]).includes('synthetic-not-a-real-key'));
});
test('API configuration check returns boolean only and missing key makes zero calls',()=>{
  const h=harness();h.script.delete('OPENAI_API_KEY');const j=h.preview();assert.equal(h.c.rowCompletionState().apiReady,false);assert.throws(()=>h.generate(j),/未設定/);assert.equal(h.fetches,0);assert.equal(h.c.rowCompletionState().job.rows[0].status,'pending');
});
test('missing safe adopted examples stops before reservation or any API call',()=>{
  const h=harness();const j=h.preview();h.c.maintenanceStyleExamples_=()=>{throw Error('採用例がありません');};
  assert.throws(()=>h.generate(j),/採用例/);assert.equal(h.fetches,0);assert.equal(h.c.rowCompletionState().job.rows[0].status,'pending');
  assert.equal([...h.script.keys()].filter(k=>k.includes('claim:')).length,0);
});
for(const mode of ['transportFailure','badJson','incomplete','http','schema','empty','token','link'])test('invalid/unknown API '+mode+' never resends',()=>{
  const h=harness();if(mode==='http')h.http=429;else if(['schema','empty','token','link'].includes(mode))h.mutateDraft=d=>{if(mode==='schema')d.extra='x';if(mode==='empty')d.ja='';if(mode==='token')d.ja+=' [[score:invented]]';if(mode==='link')d.en+=' https://invented.invalid/';};else h[mode]=true;
  const j=h.generate(h.preview());assert.equal(j.rows[0].status,['empty','token','link'].includes(mode)?'needs_review':'uncertain');assert.throws(()=>h.generate(j),/再生成/);assert.equal(h.fetches,1);assert.equal(h.writes.length,0);
});
test('a format-invalid but bounded draft can be edited without another paid call',()=>{
  const h=harness();h.mutateDraft=d=>{d.ja='訳：余分な前置き';};let j=h.generate(h.preview());assert.equal(j.rows[0].status,'needs_review');assert.equal(h.writes.length,0);
  assert.throws(()=>h.apply(j),/見出し/);j=h.c.rowCompletionApply(j.id,2,{ja:'静かに',en:'Softly'}).job;assert.equal(j.rows[0].status,'applied');assert.equal(h.fetches,1);
});
test('score tokens, URLs, literal HTML and reference markers survive both languages and edits',()=>{
  const h=harness();h.put('de','Leise [[score:real-example]] <a href="https://example.invalid/a#page=2">link</a> [H: KM1-1]');
  let j=h.generate(h.preview());assert.equal(j.rows[0].status,'draft');const bad={...j.rows[0].draft,en:'Lost tokens'};
  assert.throws(()=>h.c.rowCompletionApply(j.id,2,bad),/トークン/);j=h.apply(j);assert.equal(j.rows[0].status,'applied');
});
test('formula injection is written as literal text',()=>{
  const h=harness();const j=h.generate(h.preview());h.c.rowCompletionApply(j.id,2,{ja:'=not_a_formula',en:'-literal translation'});
  assert.equal(h.value('ja'),'=not_a_formula');assert.equal(h.writes[0].value,"'=not_a_formula");assert.equal(h.formulas[1][h.headers.indexOf('ja')],'');
});
test('partial sheet write and ambiguous write timeout resume without another API call',()=>{
  for(const when of ['before','after']){
    const h=harness(),j=h.generate(h.preview());let once=true;
    h[when==='before'?'beforeWrite':'afterWrite']=(r,c)=>{if(once&&h.headers[c-1]===(when==='before'?'en':'ja')){once=false;throw Error('synthetic timeout');}};
    let partial=h.apply(j);assert.equal(partial.rows[0].status,'partial');assert(h.value('ja'));
    partial=h.c.rowCompletionApply(j.id,2,{}).job;assert.equal(partial.rows[0].status,'applied');assert.equal(h.fetches,1);assert.equal(h.writes.filter(w=>w.column==='ja').length,1);
  }
});
test('private save failure after API retains reservation and never regenerates',()=>{
  const h=harness(),j=h.preview();h.onFetch=()=>{h.failProperty=(key)=>key.endsWith(':meta');};
  assert.throws(()=>h.generate(j),/property failure/);h.failProperty=null;
  assert.equal(h.c.rowCompletionState().job.rows[0].status,'generating');assert.throws(()=>h.generate(j),/再生成/);assert.equal(h.fetches,1);
});
test('write result survives property-store failure and is reconciled from durable intent',()=>{
  const h=harness(),j=h.generate(h.preview());h.afterWrite=()=>{h.failProperty=key=>key.endsWith(':meta');};
  assert.throws(()=>h.apply(j),/property failure/);h.failProperty=null;h.afterWrite=null;
  const recovered=h.c.rowCompletionApply(j.id,2,{}).job;assert.equal(recovered.rows[0].status,'applied');assert.equal(h.fetches,1);assert.equal(h.writes.filter(w=>w.column==='ja').length,1);
});
test('unknown jobs require explicit checked finish and a safe wait before new work',()=>{
  const h=harness();h.transportFailure=true;let j=h.generate(h.preview());assert.throws(()=>h.c.rowCompletionFinish(j.id,false),/利用状況/);
  j=h.c.rowCompletionFinish(j.id,true).job;assert.equal(j.closed,true);assert.equal([...h.script.keys()].filter(k=>k.includes('claim:')).length,0);
});
test('selection limits, storage bounds and safe target source',()=>{
  const h=harness();h.select(1);assert.throws(()=>h.preview(),/本文/);h.select(2,6);assert.throws(()=>h.preview(),/1～5/);
  h.select(2);h.script.set('SPREADSHEET_ID','different-book');assert.throws(()=>h.preview(),/登録済み/);
});
test('multiple selected rows generate separately and a new job retains unfinished results',()=>{
  const h=harness();h.select(2,2);let j=h.preview();assert.equal(j.rows.length,2);
  j=h.c.rowCompletionGenerate(j.id,3).job;assert.equal(h.fetches,1);assert.equal(j.rows[0].status,'pending');assert.equal(j.rows[1].status,'draft');
  h.select(4);assert.equal(h.preview().id,j.id);
  j=h.c.rowCompletionApply(j.id,3,JSON.parse(JSON.stringify(j.rows[1].draft))).job;assert.equal(j.rows[1].status,'applied');
  assert.equal(h.value('ja',2),'');assert(h.value('ja',3));
});
test('storage capacity is checked before any paid call',()=>{
  const h=harness();h.select(2,3);assert.throws(()=>h.preview(),/選択行を減ら/);assert.equal(h.fetches,0);
  const one=harness();one.put('de','x'.repeat(6001));assert.equal(one.preview().rows[0].status,'blocked');assert.equal(one.fetches,0);
});
test('record chunks respect property limits for non-ASCII text',()=>{
  const h=harness();h.put('de','音'.repeat(4000));const j=h.generate(h.preview());assert.equal(j.rows[0].status,'draft');
  for(const value of h.users.get('one').values())assert(Buffer.byteLength(value,'utf8')<9000);
});
test('user lock contention does not create reservations or call APIs',()=>{
  const h=harness();const j=h.preview();h.locks=true;assert.throws(()=>h.generate(j),/ほかの更新/);assert.equal(h.fetches,0);h.locks=false;
  assert.equal([...h.script.keys()].filter(k=>k.includes('claim:')).length,0);
});
test('in-flight records cannot be closed early; stale ones require explicit verification',()=>{
  const h=harness(),j=h.preview();h.onFetch=()=>{h.failProperty=key=>key.endsWith(':meta');};
  assert.throws(()=>h.generate(j),/property failure/);h.failProperty=null;
  assert.throws(()=>h.c.rowCompletionFinish(j.id,true),/生成処理中/);h.now+=7*60*1000;
  assert.throws(()=>h.c.rowCompletionFinish(j.id,false),/利用状況/);assert.equal(h.c.rowCompletionFinish(j.id,true).job.closed,true);
});
function notesWithPublishedUsages(sourceValue='[GM], [RS: Oper], [RW: Oper]') {
  const h=harness('Notes');h.put('de','Saite');h.put('source',sourceValue);
  for(const tab of ['GM','RW','RS']){
    const file={GM:'mahler',RW:'richard_wagner',RS:'richard_strauss'}[tab],names=schemas[tab].slice().reverse();
    const ja=JSON.parse(fs.readFileSync(path.join(root,'mahler-search-app/data/'+file+'.json'),'utf8'));
    const en=JSON.parse(fs.readFileSync(path.join(root,'en/mahler-search-app/data/'+file+'.json'),'utf8'));
    const identity=r=>JSON.stringify([r.de,r.data,r.Oper,r.Aufzug,r.Szene,r.page]);
    const byId=new Map(en.map(r=>[identity(r),r]));
    const rows=[names,...ja.map(a=>{const b=byId.get(identity(a)),v={...a,en:b?b.ja:''};return names.map(name=>v[name]===undefined?'':v[name]);})];
    h.relatedSheets[tab]={getName:()=>tab,getLastRow:()=>rows.length,getLastColumn:()=>names.length,getRange(r,c,n=1,w=1){return{
      getValues:()=>rows.slice(r-1,r-1+n).map(a=>a.slice(c-1,c-1+w)),getDisplayValues:()=>rows.slice(r-1,r-1+n).map(a=>a.slice(c-1,c-1+w)),getFormulas:()=>Array.from({length:n},()=>Array(w).fill(''))
    };}};
  }
  h.mutateDraft=draft=>{
    draft.ja='【英】string／【伊】corda\n\n【一般的な意味】\n① 楽器に張り，振動させて音を出す弦．\n② ラケットに張るガット．\n\n【音楽用語としての訳例】\n「弦」，「G線」，「開放弦」．';
    draft.en='Italian: corda\n\n【General meanings】\n① A vibrating string of a musical instrument.\n② A racket string.\n\n【Musical translation examples】\nA string; the G string; open strings.';
    const examples=JSON.parse(h.lastRequest.input).domain_context.usage_examples;
    draft.notes_support={english:'string',italian:'corda',rationale:'弦・調弦・開放弦の語義は入力実例と対応する．英伊対応そのものは語彙知識による未承認案なので確認する．',usage_ids:examples.map(e=>e.id)};
  };
  return h;
}
test('new Saite Notes uses real adopted multilingual usages across permitted tabs and retains proposals privately',()=>{
  const h=notesWithPublishedUsages();let j=h.preview();const snapshot=JSON.stringify(j.rows[0].snapshot);
  assert.equal(h.fetches,0);assert.equal(h.writes.length,0);j=h.generate(j);
  const input=JSON.parse(h.lastRequest.input),examples=input.domain_context.usage_examples;
  assert.equal(input.domain_context.new_dictionary,true);assert.equal(examples.length,6);
  assert.deepEqual([...new Set(examples.map(e=>e.tab))].sort(),['GM','RS','RW']);
  assert(examples.some(e=>e.de.includes('leeren Saiten')));assert(examples.some(e=>e.de.includes('doppelten Saiten')));
  assert(examples.every(e=>e.de&&e.ja&&e.en&&e.original_document_fetched===false));
  assert.equal(j.rows[0].status,'needs_review');assert.equal(j.rows[0].notesSupport.italian,'corda');assert.equal(h.writes.length,0);
  assert.equal(JSON.stringify(j.rows[0].snapshot),snapshot);assert(!JSON.stringify([...h.script]).includes('corda'));
  assert.equal(h.lastRequest.text.format.schema.properties.notes_support.additionalProperties,false);
  j=h.apply(j);assert.equal(j.rows[0].status,'applied');assert.equal(j.rows[0].notesSupport.humanReviewed,true);
  assert(h.value('ja').startsWith('【英】string／【伊】corda'));assert(h.value('en').startsWith('Italian: corda'));
  assert.equal(h.value('de'),'Saite');assert.equal(h.value('source'),'[GM], [RS: Oper], [RW: Oper]');assert.equal(h.fetches,1);
});
test('new Notes preserves evidenced original/translation pairs in both languages without adding introductions',()=>{
  const h=notesWithPublishedUsages(),mutate=h.mutateDraft;let expected;
  h.mutateDraft=d=>{
    mutate(d);const input=JSON.parse(h.lastRequest.input),examples=input.domain_context.usage_examples;
    const selected=['RW','RS'].map(tab=>examples.find(e=>e.tab===tab));assert(selected.every(Boolean));
    const body=field=>selected.map(e=>'['+e.tab+': Oper]\n'+e.de+'\n'+e[field]).join('\n\n');
    d.ja='【英】string／【伊】corda\n\n【一般的な意味】\n① 弦．\n\n【音楽用語としての訳例】\n'+body('ja');
    d.en='Italian: corda\n\n【General meanings】\n① A string.\n\n【Musical translation examples】\n'+body('en');
    d.notes_support.usage_ids=selected.map(e=>e.id);expected={ja:d.ja,en:d.en,examples};
  };
  let j=h.generate(h.preview());const input=JSON.parse(h.lastRequest.input),rules=input.format_rules.join('\n');
  assert(rules.includes('原文使用例とその訳だけ'));assert(rules.includes('説明的な導入文は付けない'));assert(rules.includes('日本語・英語とも同じ方針'));
  assert(rules.includes('説明を一律に削らない'));assert(rules.includes('根拠を作り足さない'));assert(rules.includes('自動改稿しない'));
  assert(h.lastRequest.instructions.includes('原文使用例と文脈に合う訳を対で示す'));
  assert.equal(j.rows[0].draft.ja,expected.ja);assert.equal(j.rows[0].draft.en,expected.en);assert.equal(h.writes.length,0);
  assert.equal(input.domain_context.source_document_fetched,false);
  assert.deepEqual(JSON.parse(JSON.stringify(j.rows[0].notesSupport.examples)),expected.examples);
  j=h.apply(j);assert.equal(j.rows[0].status,'applied');assert.equal(h.fetches,1);
  assert.equal(h.value('ja'),expected.ja);assert.equal(h.value('en'),expected.en);
});

test('existing Notes explanations and their complete English translation remain intact',()=>{
  const h=harness('Notes'),ja='【一般的な意味】\n① 弓．\n\n【音楽用語としての訳例】\n弓の配分はフレーズ全体を考えて行う．',
    en='【General meanings】\n① A bow.\n\n【Musical translation examples】\nDistribute the bow with the entire phrase in mind.';
  h.put('ja',ja);h.mutateDraft=d=>{d.en=en;};
  let j=h.generate(h.preview());const input=JSON.parse(h.lastRequest.input);
  assert.equal(input.domain_context.new_dictionary,false);assert.equal(input.source.ja,ja);
  assert.deepEqual([...input.requested_fields],['en']);assert.equal(j.rows[0].draft.en,en);
  j=h.apply(j);assert.equal(j.rows[0].status,'applied');assert.equal(h.value('ja'),ja);assert.equal(h.value('en'),en);
});

test('Notes usage matching is bounded and source-specific, covers plural/compound but not Seite',()=>{
  const h=notesWithPublishedUsages('[RS: Oper]');h.generate(h.preview());const input=JSON.parse(h.lastRequest.input);
  assert(input.domain_context.usage_examples.every(e=>e.tab==='RS'));assert.equal(input.domain_context.usage_scan.length,1);
  const match=h.c.rowCompletionNotesMatch_('Saite');for(const word of ['Saite','Saiten','G-Saite','leeren Saiten'])assert(match.test(word));
  for(const word of ['Seite','Saitenspiel','anderesaite'])assert(!match.test(word));assert.equal(h.c.rowCompletionNotesMatch_('.*'),null);
  assert(JSON.stringify(input.domain_context.usage_examples).length<=6500);
});
test('new Notes requires musical section when actual usages were supplied; editable draft survives failure',()=>{
  const h=notesWithPublishedUsages(),mutate=h.mutateDraft;h.mutateDraft=d=>{mutate(d);d.ja=d.ja.split('【音楽用語としての訳例】')[0].trim();};
  let j=h.generate(h.preview());assert.equal(j.rows[0].status,'needs_review');assert(j.rows[0].notesSupport.examples.length);
  assert.throws(()=>h.apply(j),/音楽用語/);assert.equal(h.writes.length,0);
  j.rows[0].draft.ja+='\n\n【音楽用語としての訳例】\n「弦」，「開放弦」．';j=h.apply(j);assert.equal(j.rows[0].status,'applied');assert.equal(h.fetches,1);
});
test('English must retain Italian proposal and Japanese must retain declared counterparts',()=>{
  for(const field of ['ja','en']){
    const h=notesWithPublishedUsages(),mutate=h.mutateDraft;
    h.mutateDraft=d=>{mutate(d);d[field]=d[field].split('\n\n').slice(1).join('\n\n');};
    const j=h.generate(h.preview());assert.equal(j.rows[0].status,'needs_review');
    assert(j.rows[0].message.includes('確認'));assert.equal(h.writes.length,0);
    if(field==='en')assert.throws(()=>h.apply(j),/Italian:/);
  }
});
test('explicit human review may correct new counterparts consistently; inconsistent Italian never writes',()=>{
  const h=notesWithPublishedUsages();let j=h.generate(h.preview());
  j.rows[0].draft.ja=j.rows[0].draft.ja.replace('【伊】corda','【伊】corda, corde');
  assert.throws(()=>h.apply(j),/英伊対応|Italian:/);assert.equal(h.writes.length,0);
  j.rows[0].draft.en=j.rows[0].draft.en.replace('Italian: corda','Italian: corda, corde');
  j=h.apply(j);assert.equal(j.rows[0].status,'applied');assert.equal(j.rows[0].notesSupport.italian,'corda, corde');assert.equal(h.fetches,1);
});
test('unavailable English or Italian is held independently and is never filled just for appearance',()=>{
  for(const [english,italian]of [['string',''],['','corda'],['','']]){
    const h=harness('Notes');h.put('de','Saite');h.mutateDraft=d=>{
      const prefix=[english?'【英】'+english:'',italian?'【伊】'+italian:''].filter(Boolean).join('／');
      d.ja=(prefix?prefix+'\n\n':'')+'【一般的な意味】\n① 弦．';
      d.en=(italian?'Italian: '+italian+'\n\n':'')+'【General meanings】\n① A string.';
      d.notes_support={english,italian,rationale:'不明な言語だけ保留する．',usage_ids:[]};
    };
    let j=h.generate(h.preview());assert.equal(j.rows[0].status,'needs_review');j=h.apply(j);assert.equal(j.rows[0].status,'applied');
    assert.equal(h.value('ja').includes('【英】'),Boolean(english));assert.equal(h.value('en').includes('Italian:'),Boolean(italian));
  }
});
test('unknown or fabricated support IDs, links, controls and malformed lists are not accepted or retried',()=>{
  for(const change of [d=>{d.notes_support.usage_ids=['RS:999999'];},d=>{d.notes_support.rationale='https://invented.invalid';},d=>{d.notes_support.italian='corda; invented';},d=>{d.notes_support.english='string\ncommand';}]){
    const h=notesWithPublishedUsages(),mutate=h.mutateDraft;h.mutateDraft=d=>{mutate(d);change(d);};
    const j=h.generate(h.preview());assert.equal(j.rows[0].status,'uncertain');assert.equal(h.writes.length,0);
    assert.throws(()=>h.generate(j),/再生成/);assert.equal(h.fetches,1);
  }
});
test('existing Notes, annotations, catalogue and other tabs never gain new-proposal permission',()=>{
  const h=harness('Notes');h.put('ja','【一般的な意味】\n① 弦．');h.mutateDraft=d=>{d.en='Italian: corda\n\n【General meanings】\n① A string.';};
  const j=h.generate(h.preview());assert.equal(JSON.parse(h.lastRequest.input).domain_context.new_dictionary,false);
  assert(!h.lastRequest.text.format.schema.properties.notes_support);assert.equal(j.rows[0].status,'needs_review');assert.throws(()=>h.apply(j),/英伊対応/);
  for(const tab of ['GM','RW','RS']){const s=harness(tab);s.generate(s.preview());assert(!s.lastRequest.text.format.schema.properties.notes_support);}
  for(const de of ['AV','one long instruction with more than five words']){const n=harness('Notes');n.put('de',de);n.generate(n.preview());assert(!n.lastRequest.text.format.schema.properties.notes_support);}
});
test('catalogue fixtures find approved AV independent of exported row order without proposal permission',()=>{
  for(const reverseData of [false,true]){
    const h=harness('Notes',{reverseData});h.put('de','AV');h.generate(h.preview());
    const input=JSON.parse(h.lastRequest.input);
    assert(input.adopted_style_examples.some(example=>example.de==='AV'));
    assert(!h.lastRequest.text.format.schema.properties.notes_support);
    assert.equal(h.fetches,1);assert.equal(h.writes.length,0);
  }
});
test('new Notes proposals preserve conflict/lock protection and reject invented reference tokens',()=>{
  const h=notesWithPublishedUsages(),j=h.generate(h.preview());h.put('source','user changed source');assert.throws(()=>h.apply(j),/変更/);assert.equal(h.writes.length,0);
  const x=notesWithPublishedUsages(),mutate=x.mutateDraft;x.mutateDraft=d=>{mutate(d);d.ja+='\nhttps://invented.invalid/score#page=9';};
  const draft=x.generate(x.preview());assert.equal(draft.rows[0].status,'needs_review');assert.throws(()=>x.apply(draft),/トークン/);assert.equal(x.writes.length,0);
});
test('dialog script is valid, renders text safely and has no charge confirmation step',()=>{
  const html=fs.readFileSync(path.join(root,'src/row_completion_dialog.html'),'utf8');
  const js=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/<\?!=[^]*?\?>/g,"'rowCompletionPreview'");new vm.Script(js);
  assert(!/innerHTML|window\.confirm|\.alert\(|candidateWizardRunJev/.test(js));
  assert(html.includes('textContent'));assert(html.includes('User Properties'));assert(html.includes('前回1件'));
  assert(!/getDocumentProperties|appendRow|setDataValidation|setFormula\(/.test(source));
});
test('actual dialog flow preserves edits on failure and refreshes without regeneration',()=>{
  class Element {
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.events={};this.value='';this.disabled=false;this.textContent='';this.checked=false;}
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(){this.children=[];}
    addEventListener(type,fn){this.events[type]=fn;}
    setAttribute(name,value){this[name]=value;}
    click(){assert(!this.disabled,'button should be enabled: '+this.textContent);this.events.click();}
  }
  const ids=Object.fromEntries(['refresh','selection','message','summary','rows','finishArea','finish','checked'].map(id=>[id,new Element(id==='checked'?'input':id==='refresh'||id==='selection'||id==='finish'?'button':'div')]));
  const all=()=>{const found=[];function walk(e){found.push(e);e.children.forEach(walk);}Object.values(ids).forEach(walk);return found;};
  const job={id:'ui-test',tab:'Notes',closed:false,rows:[{number:2,status:'pending',message:'',targets:['ja','en'],draft:{},snapshot:{values:{de:'Leise <img src=x onerror=bad()>',ja:'',en:'',source:'[GM]'}}}]};
  const calls=[],queue=[];let fail=false;
  function runner(success,failure){return new Proxy({withSuccessHandler(fn){return runner(fn,failure);},withFailureHandler(fn){return runner(success,fn);}}, {get(object,key){if(key in object)return object[key];return(...args)=>queue.push(()=>{
    calls.push({method:key,args});if(fail){fail=false;failure({message:'ROW_COMPLETION: 保存状態を確認してください．'});return;}
    const row=job.rows[0];if(key==='rowCompletionGenerate'){row.status='needs_review';row.draft={ja:'静かに',en:'Softly'};row.notesSupport={english:'string',italian:'corda',rationale:'Evidence <img src=x onerror=bad()>',examples:[{id:'GM:2',location:'test',de:'Saite',ja:'弦',en:'string'}]};}
    if(key==='rowCompletionApply'){row.status='applied';row.draft=args[2];}
    success(JSON.parse(JSON.stringify({job,apiReady:true})));
  });}});}
  const document={getElementById:id=>ids[id],createElement:tag=>new Element(tag),querySelectorAll:selector=>all().filter(e=>selector.split(',').map(s=>s.toUpperCase()).includes(e.tagName))};
  const html=fs.readFileSync(path.join(root,'src/row_completion_dialog.html'),'utf8');
  const js=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/<\?!=[^]*?\?>/g,"'rowCompletionPreview'");
  vm.runInNewContext(js,{document,google:{script:{run:runner()}}});queue.shift()();
  const byText=label=>all().find(e=>e.tagName==='BUTTON'&&e.textContent===label);
  byText('この行の翻訳案を生成').click();queue.shift()();
  assert(all().some(e=>e.textContent==='Evidence <img src=x onerror=bad()>'));assert(!all().some(e=>e.tagName==='IMG'));
  let area=all().find(e=>e.tagName==='TEXTAREA');area.value='静かに（確認済み）';area.events.input();fail=true;
  byText('確認した内容を空欄へ反映').click();queue.shift()();
  assert.equal(all().find(e=>e.tagName==='TEXTAREA').value,'静かに（確認済み）');assert(byText('確認した内容を空欄へ反映').disabled);
  ids.refresh.click();queue.shift()();assert.equal(all().find(e=>e.tagName==='TEXTAREA').value,'静かに（確認済み）');
  byText('確認した内容を空欄へ反映').click();queue.shift()();
  assert.equal(job.rows[0].draft.ja,'静かに（確認済み）');assert.equal(job.rows[0].status,'applied');
  assert.equal(calls.filter(v=>v.method==='rowCompletionGenerate').length,1);assert.equal(calls.filter(v=>v.method==='rowCompletionState').length,1);
  assert(!all().some(e=>e.tagName==='IMG'));
});
function reviewColumn(h,value='',formula='') {
 const field='理由・要確認事項';h.headers.push(field);for(const row of h.rows.slice(1))row.push('');for(const row of h.formulas)row.push('');
 h.notes.push('keep-review-note');h.validation.push('keep-review-validation');h.put(field,value);h.formula(field,formula);return field;
}
test('GM/RW/RS review notes use the existing column format and are written only after review',()=>{
 for(const tab of ['GM','RW','RS']){
  const h=harness(tab),field=reviewColumn(h);h.mutateDraft=d=>{d.review_notes={reason:'原文の語形と入力された使用箇所に基づく。',questions:'総譜の文脈は未確認。'};};
  const before=h.writes.length;let j=h.generate(h.preview());assert(j.rows[0].targets.includes(field));assert.equal(h.value(field),'');assert.equal(h.writes.length,before);
  assert(j.rows[0].draft[field].startsWith('【根拠・未解決点】\n'));assert(j.rows[0].draft[field].includes('未確認．'));
  j=h.apply(j);assert.equal(h.value(field),j.rows[0].draft[field]);assert.equal(h.value('ja_old'),'保存した旧訳');
 }
});
test('existing review histories, formulas and absent columns are preserved and never sent to the model',()=>{
 for(const mode of ['existing','formula','absent']){
  const h=harness('RW'),field=mode==='absent'?'理由・要確認事項':reviewColumn(h,mode==='existing'?'DO_NOT_SEND_PRIVATE_REVIEW_HISTORY':'',mode==='formula'?'=""':'');
  h.mutateDraft=d=>{d.review_notes={reason:'原文の短い指示を訳した．',questions:''};};let j=h.generate(h.preview());
  assert(!j.rows[0].targets.includes(field));assert(j.rows[0].reviewNotes);assert(!h.lastRequest.input.includes('DO_NOT_SEND_PRIVATE_REVIEW_HISTORY'));
  h.apply(j);if(mode!=='absent')assert.equal(h.value(field),mode==='existing'?'DO_NOT_SEND_PRIVATE_REVIEW_HISTORY':'');
  if(mode==='formula')assert.equal(h.formulas[1][h.headers.indexOf(field)],'=""');
 }
});
test('unnecessary reasons do not create an empty target or boilerplate record',()=>{
 const h=harness(),field=reviewColumn(h),j=h.generate(h.preview());assert(!j.rows[0].targets.includes(field));h.apply(j);assert.equal(h.value(field),'');
});
test('review-note competition and malformed evidence do not overwrite existing user material',()=>{
 const h=harness(),field=reviewColumn(h);h.mutateDraft=d=>{d.review_notes={reason:'文脈上の訳語を選択．',questions:''};};const j=h.generate(h.preview());h.put(field,'人の追記');assert.throws(()=>h.apply(j),/変更/);assert.equal(h.value(field),'人の追記');
 const h2=harness();reviewColumn(h2);h2.mutateDraft=d=>{d.review_notes={reason:'https://example.invalid/fake-source',questions:''};};const j2=h2.generate(h2.preview());assert.equal(j2.rows[0].status,'needs_review');assert.equal(h2.writes.length,0);
});
test('missing recipient-only completion waits for canonical approval without paid request',()=>{
 const h=harness('RS');h.approved=[];h.put('ja','既存訳');h.put('en','Existing translation');h.put('whom','Farzana, Zemina');
 const pending=h.preview();assert.equal(pending.rows[0].status,'blocked');assert.match(pending.rows[0].message,/指示対象英訳確認/);assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
 h.approved.push(['RS','妖精 [feen]','Farzana, Zemina','自由修正','承認','','','','','Farzana and Zemina']);
 let j=h.generate(h.preview());j=h.apply(j);assert.equal(h.value('whom'),'Farzana, Zemina');assert.equal(h.value('whom_en'),'Farzana and Zemina');assert.equal(h.value('ja'),'既存訳');assert.equal(h.value('en'),'Existing translation');assert.equal(h.fetches,0);
});
test('recipient matching respects work, tab, selection and safe value, not another approval',()=>{
 for(const mode of ['work','tab','selection','empty','link','unknown']){const h=harness('RW');
  if(mode==='work')h.approved[0][1]='別作品 [other]';if(mode==='tab')h.approved[0][0]='RS';
  if(mode==='selection')h.approved[0][3]='第2案';if(mode==='empty')h.approved[0][5]='';
  if(mode==='link')h.approved[0][5]='https://example.invalid';if(mode==='unknown')h.approved[0][4]='未確認';
  const j=h.preview();assert(!j.rows[0].targets.includes('whom_en'));assert.match(j.rows[0].whomReview.message,/保存しません/);assert.equal(h.writes.length,0);
 }
 const h=harness('RW'),j=h.generate(h.preview());h.put('whom','別の対象');assert.throws(()=>h.apply(j),/変更/);assert.equal(h.writes.length,0);
});
test('recipient changed midway through writes stops remaining cells and preserves input',()=>{
 const h=harness('RW'),j=h.generate(h.preview());h.afterWrite=()=>{h.approved[0][4]='保留';};
 const applied=h.apply(j);assert.equal(applied.rows[0].status,'partial');assert.equal(h.value('whom_en'),'');assert.equal(h.value('whom'),'Chor');
});
test('GM proposal follows a unique unchanged row moved before generation or before application',()=>{
 for(const phase of ['generate','apply']){
  const h=harness('GM');h.put('data','M-9-9-99-v1&');let job=h.preview();
  if(phase==='apply')job=h.generate(job);
  [h.rows[1],h.rows[5]]=[h.rows[5],h.rows[1]];[h.formulas[1],h.formulas[5]]=[h.formulas[5],h.formulas[1]];
  if(phase==='generate')job=h.generate(job);
  job=h.apply(job);assert.equal(job.rows[0].number,6);assert.equal(job.rows[0].status,'applied');
  assert(h.value('ja',6));assert.equal(h.value('ja',2),'');assert.equal(h.fetches,1);assert(h.writes.every(w=>w.row===6));
 }
});
test('moved proposal refuses changed or ambiguous original content without writing or regenerating',()=>{
 for(const mode of ['changed','ambiguous']){
  const h=harness('GM');h.put('data','M-9-9-99-v1&');let job=h.generate(h.preview());
  [h.rows[1],h.rows[5]]=[h.rows[5],h.rows[1]];[h.formulas[1],h.formulas[5]]=[h.formulas[5],h.formulas[1]];
  if(mode==='changed')h.put('data','M-9-9-100-v1&',6);else{h.rows[4]=h.rows[5].slice();h.formulas[4]=h.formulas[5].slice();}
  assert.throws(()=>h.apply(job),/変更/);assert.equal(h.writes.length,0);assert.equal(h.fetches,1);
 }
});

console.log('Selected-row completion: '+passed+' scenarios passed; four tabs, private drafts, blank/formula guards, approved recipients, conflicts, no duplicate API, tokens/links and partial-write recovery. No real API or Sheet writes.');
