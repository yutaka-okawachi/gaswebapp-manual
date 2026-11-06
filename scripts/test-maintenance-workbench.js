'use strict';
// Reuse the established service mock, without executing its test cases or any network request.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),testFile=fs.readFileSync(path.join(__dirname,'test-row-completion.js'),'utf8');
const moduleBox={exports:{}};
vm.runInNewContext(testFile.slice(0,testFile.indexOf('\nfor(const tab of Object.keys(schemas))'))+'\nmodule.exports={harness};',
  {require,module:moduleBox,exports:moduleBox.exports,__dirname,console,Buffer},{filename:'maintenance-services-fixture.js'});
let passed=0;const test=(name,fn)=>{try{fn();passed++;}catch(e){e.message=name+': '+e.message;throw e;}};
function harness(options={}){
 const h=moduleBox.exports.harness('Notes',options),sheet=h.sheet,book=h.c.SpreadsheetApp.getActiveSpreadsheet();
 function ensure(r,c){while(h.rows.length<r){h.rows.push(h.headers.map(()=>''));h.formulas.push(h.headers.map(()=>''));}for(let i=0;i<h.rows.length;i++){while(h.rows[i].length<c)h.rows[i].push('');while(h.formulas[i].length<c)h.formulas[i].push('');}}
 const originalRange=sheet.getRange;
 sheet.getRange=(r,c,n=1,w=1)=>{ensure(r+n-1,c+w-1);const base=originalRange(r,c,n,w);return{...base,
  setValues(values){if(r>1&&h.beforeBatchWrite)h.beforeBatchWrite(r,values);if(r>1)h.writes.push({number:r,column:c,values:JSON.parse(JSON.stringify(values))});for(let i=0;i<n;i++)for(let j=0;j<w;j++){if(r+i===1)h.headers[c+j-1]=values[i][j];h.rows[r+i-1][c+j-1]=values[i][j];}if(r>1&&h.afterBatchWrite)h.afterBatchWrite(r,values);return this;}};};
 sheet.getDataRange=()=>sheet.getRange(1,1,h.rows.length,h.headers.length);
 sheet.getMaxColumns=()=>100;sheet.insertRowsAfter=(_,n)=>ensure(h.rows.length+n,h.headers.length);
 sheet.getLastRow=()=>{let i=h.rows.length;while(i>1&&!h.rows[i-1].some(v=>v!==''))i--;return i;};
 const sourceData={GM:[{de:'G-Saite',ja:'G線で',en:'On the G string.',data:'M-1-2-100-v1&'}],
  RS:[{de:'G-Saite auf Ges herunterstimmen',ja:'G線をGesまで下げて調弦する',en:'Tune the G string down to G-flat.',Oper:'salome',page:340,whom:'Orchester'},
      {de:'alle Streicher sehr seelenvoll, mit sehr viel vibrato, daher keine leeren Saiten benützen!',ja:'開放弦は用いないこと！',en:'Use no open strings!',Oper:'elektra',page:223,whom:'Orchester'}],
  RW:[{de:'immer auf doppelten Saiten.',ja:'常に重音で',en:'Always in double stops.',Oper:'walküre',page:7,whom:'Orchester'}]};
 function table(name,headers,rows){const data=[headers,...rows];return{data,getName:()=>name,getSheetId:()=>({GM:101,RW:102,RS:103}[name]||104),getLastRow:()=>data.length,getLastColumn:()=>headers.length,
  getRange(r,c,n=1,w=1){return{getValues:()=>data.slice(r-1,r+n-1).map(a=>a.slice(c-1,c+w-1)),getDisplayValues:()=>data.slice(r-1,r+n-1).map(a=>a.slice(c-1,c+w-1)),getFormulas:()=>Array.from({length:n},()=>Array(w).fill(''))};},
  appendRow(row){data.push(row.map(v=>typeof v==='string'&&v.startsWith("'")?v.slice(1):v));}};}
 for(const [tab,rows]of Object.entries(sourceData)){const fields=tab==='GM'?['de','ja','en','data']:['de','ja','en','Oper','Aufzug','Szene','page','whom','whom_en'];h.relatedSheets[tab]=table(tab,fields,rows.map(v=>fields.map(f=>v[f]===undefined?'':v[f])));}
 for(const file of ['dictionary_candidate_workflow.js','dictionary_candidate_wizard.js','notes_registration.js','maintenance_workbench.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),h.c);
 h.c.readSheetRows=(s,width)=>s.getRange(2,1,s.getLastRow()-1,width).getValues();
 h.observationId='observation-1234567890abcdef12345678';h.observation=[h.observationId,'Saite','saite','','',1,'terms_search.html',1,'未判定','',''];
 h.c.candidateWizardFindObservation=id=>{assert.equal(id,h.observationId);return{spreadsheet:book,row:h.observation,rowNumber:2};};
 h.c.candidateWizardBootstrap=()=>[{id:h.observationId,term:h.observation[1],status:h.observation[8]}];
 h.c.candidateWizardFindLinked=()=>h.oldCandidate||null;
 const mappingHeaders=['見出し','関連語形','語形区分','用語検索','実例検索','補足'];
 h.mapping=table('語形対応',mappingHeaders,[]);h.relatedSheets['語形対応']=h.mapping;
 h.mutateDraft=d=>{
  d.ja='【英】string／【伊】corda\n\n【一般的な意味】\n① 楽器の弦．\n\n【音楽用語としての訳例】\n「弦」，「G線」，「開放弦」．';
  d.en='Italian: corda\n\n【General meanings】\n① A musical instrument string.\n\n【Musical translation examples】\nA string; the G string; open strings.';
  if(d.notes_support)d.notes_support={english:'string',italian:'corda',rationale:'実例を踏まえた未承認の語彙案．',usage_ids:JSON.parse(h.lastRequest.input).domain_context.usage_examples.map(e=>e.id)};
 };
 h.run=()=>h.c.maintenanceNotesRun(h.observationId);h.state=()=>h.c.maintenanceWorkbenchState();
 h.managed=()=>h.c.notesRegistrationRead_(sheet).rows.filter(r=>r.entryId);
 h.public=r=>Boolean(r.values.de.trim());
 h.putManaged=(r,field,value)=>{if(['de','ja','en','source'].includes(field))h.put(field,value,r.number);else h.c.notesRegistrationCell_(sheet,r.number,field).setValue(value);};
 h.register=(fields,checked=true,hash)=>{const s=h.state();return h.c.maintenanceNotesRegister(s.job.id,hash||s.jobHash,fields||JSON.parse(JSON.stringify(s.job.rows[0].draft)),checked);};
 return h;
}
function legacyDraft(h) {
 const s=h.state(),job=s.job,sheet=h.sheet,number=sheet.getLastRow()+1;
 h.c.notesRegistrationEnsureColumns_(sheet);sheet.getRange(number,1,1,h.headers.length);
 for(const[k,v]of Object.entries({maintenance_id:job.intake.entryId,maintenance_observation_id:h.observationId,de:job.intake.plan.de,source:job.intake.plan.source})){
  const cell=['de','source'].includes(k)?h.c.namedSheetCell_(sheet,[k],number,0):h.c.notesRegistrationCell_(sheet,number,k);cell.setValue(v);
 }
 delete job.intake.flow;job.intake.number=number;job.intake.phase='ready';
 const row=job.rows[0];row.number=number;row.snapshot=h.c.rowCompletionRead_(sheet,number);row.hash=h.c.rowCompletionHash_(row.snapshot);
 h.c.rowCompletionSave_(job);return h.managed()[0];
}
test('one run resolves source and generates a private proposal with zero Sheet writes',()=>{
 for(const reverse of [false,true]){
  const h=harness({reverse}),before=JSON.stringify({rows:h.rows,formulas:h.formulas,headers:h.headers}),s=h.run();
  assert.equal(h.fetches,1);assert.equal(h.writes.length,0);assert.equal(h.managed().length,0);
  assert.equal(JSON.stringify({rows:h.rows,formulas:h.formulas,headers:h.headers}),before);
  assert.equal(s.job.rows[0].snapshot.values.de,'Saite');assert.equal(s.job.rows[0].snapshot.values.source,'[RS: Oper], [RW: Oper], [GM]');
  assert(s.job.rows[0].draft.ja.startsWith('【英】string／【伊】corda'));assert(s.job.rows[0].draft.en.startsWith('Italian: corda'));
  assert.equal(s.entry,null);assert.equal(s.validationErrors.length,0);h.run();assert.equal(h.fetches,1);assert.equal(h.writes.length,0);
 }
});
test('content approval alone appends one complete approved row, without changing pre-existing values or configuration',()=>{
 for(const reverse of [false,true]){
  const h=harness({reverse}),width=h.headers.length,before=JSON.stringify(h.rows),config=JSON.stringify([...h.script]);h.run();
  assert.throws(()=>h.register(undefined,false),/確認/);assert.equal(h.managed().length,0);
  const s=h.register(),r=h.managed()[0];assert.equal(s.job.intake.phase,'registered');assert.equal(s.job.closed,true);assert(h.public(r));
  assert.equal(r.values.de,'Saite');assert(r.values.ja&&r.values.en&&r.values.source);assert.equal(h.fetches,1);
  const original=JSON.parse(before);assert.equal(JSON.stringify(h.rows.slice(0,original.length).map(r=>r.slice(0,width))),before);
  assert.equal(h.script.get('OPENAI_DRAFT_MODEL'),'synthetic-model');assert.equal(h.script.get('OPENAI_API_KEY'),'synthetic-not-a-real-key');
  // Temporary claim deletion is allowed; fixed configuration is untouched.
  for(const [k,v]of JSON.parse(config))assert.equal(h.script.get(k),v);
  h.register();h.run();assert.equal(h.managed().length,1);assert.equal(h.fetches,1);
  h.putManaged(r,'ja',r.values.ja+'\n編集．');assert(h.public(h.managed()[0]));
 }
});
test('unknown source, Notes duplicate, alias, old candidate or missing settings stop before charging or Sheet writes',()=>{
 for(const mode of ['unknown','duplicate','alias','old','settings']){
  const h=harness();if(mode==='unknown')h.observation[1]='NoSuchGermanWord';if(mode==='duplicate')h.put('de','Saite');
  if(mode==='alias')h.mapping.data.push(['Bogen','Saite','別綴り','対象','対象','']);
  if(mode==='old'){h.relatedSheets['未登録語候補']={};h.oldCandidate={row:Array(28).fill('')};h.oldCandidate.row[13]='saved original';}
  if(mode==='settings')h.script.delete('OPENAI_DRAFT_MODEL');
  assert.throws(()=>h.run());assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
 }
});
test('saved legacy drafts enter unified bilingual review without another API call or Sheet write',()=>{
 const h=harness();h.relatedSheets['未登録語候補']={};const old={headword:'Saite',partOfSpeech:'女性名詞',translation:'弦',musicExamples:'弦で',english:'string',italian:'corda'};
 h.oldCandidate={row:Array(28).fill('')};h.oldCandidate.row[13]=JSON.stringify(old);h.oldCandidate.row[16]=old.headword;h.oldCandidate.row[17]=old.partOfSpeech;h.oldCandidate.row[19]=old.translation;h.oldCandidate.row[12]='作成済み';h.script.delete('OPENAI_DRAFT_MODEL');
 const before=JSON.stringify(h.oldCandidate),s=h.run();assert.equal(h.fetches,0);assert.equal(h.writes.length,0);assert.equal(s.job.rows[0].status,'needs_review');
 assert(s.job.rows[0].draft.ja.includes('【一般的な意味】'));assert.equal(s.job.rows[0].draft.en,'');assert.equal(JSON.stringify(h.oldCandidate),before);
 assert.throws(()=>h.register(),/英語本文/);assert.equal(h.managed().length,0);
 const fields={...s.job.rows[0].draft,en:'Italian: corda\n\n【General meanings】\n① String.\n\n【Musical translation examples】\nOn a string.'};
 h.register(fields);assert.equal(h.managed().length,1);assert.equal(h.fetches,0);assert.equal(JSON.stringify(h.oldCandidate),before);
});

test('an active regular row task is preserved and reachable through the unified entry',()=>{
 const h=harness(),old=h.preview();assert.throws(()=>h.run(),/処理中/);assert.equal(h.c.rowCompletionState().job.id,old.id);assert(h.state().otherWorkPending);assert.equal(h.state().job,null);
});
test('regular selection preview cannot replace the active private intake',()=>{
 const h=harness();h.run();const j=h.state().job;assert.equal(h.preview().id,j.id);assert.equal(h.fetches,1);assert.equal(h.managed().length,0);
});
test('uncertain API never creates Notes or automatically resends',()=>{
 const h=harness();h.transportFailure=true;const s=h.run();assert.equal(s.job.rows[0].status,'uncertain');assert.equal(h.fetches,1);
 assert.equal(h.managed().length,0);assert.equal(h.writes.length,0);assert(s.message.includes('結果不明'));
 h.transportFailure=false;h.run();assert.equal(h.fetches,1);assert.throws(()=>h.register(),/本文案/);
});
test('invalid generated format retains draft and reports its exact per-language validation reason',()=>{
 const h=harness(),mutate=h.mutateDraft;h.mutateDraft=d=>{mutate(d);d.en='Incomplete.';};
 let s=h.run();assert.equal(s.job.rows[0].status,'needs_review');assert.equal(s.job.rows[0].draft.en,'Incomplete.');
 assert(s.validationErrors.some(e=>e.field==='en'&&e.message.includes('Italian:')));assert.equal(h.managed().length,0);
 assert.throws(()=>h.register(),/英語本文/);assert.equal(h.managed().length,0);h.run();assert.equal(h.fetches,1);
 const fields={...s.job.rows[0].draft,en:'Italian: corda\n\n【General meanings】\n① A musical string.\n\n【Musical translation examples】\nA string; open strings.'};
 s=h.register(fields);assert.equal(s.job.intake.phase,'registered');assert.equal(h.managed()[0].values.en,fields.en);assert.equal(h.fetches,1);
});
test('new links, score tokens and missing equivalents remain blocked before registration',()=>{
 for(const change of [d=>d.ja+='\nhttps://example.invalid/invented',d=>d.en+='\n[[score:new-image]]',d=>d.ja=d.ja.replace('【英】string／【伊】corda','【英】tone')]){
  const h=harness();h.run();const fields=JSON.parse(JSON.stringify(h.state().job.rows[0].draft));change(fields);
  assert.throws(()=>h.register(fields));assert.equal(h.managed().length,0);assert.equal(h.fetches,1);
 }
});
test('evidenced generated source headings are formatted before review, with no registration until approval',()=>{
 const h=harness(),mutate=h.mutateDraft;
 h.mutateDraft=d=>{mutate(d);for(const field of ['ja','en'])d[field]+='\n\n[GM]\nG-Saite\n\n[RW: Oper]\ndoppelte Saiten\n\n[RS: Oper]\nkeine leeren Saiten';};
 const s=h.run(),draft=JSON.parse(JSON.stringify(s.job.rows[0].draft));
 assert.equal(s.validationErrors.length,0);assert.equal(h.fetches,1);assert.equal(h.writes.length,0);assert.equal(h.managed().length,0);
 for(const field of ['ja','en']){assert(draft[field].includes('\n[GM]\n'));assert(draft[field].includes('\n[RW: Oper]\n'));assert(draft[field].includes('\n[RS: Oper]\n'));}
 h.state();h.run();assert.equal(h.fetches,1);assert.equal(h.writes.length,0);assert.deepEqual(JSON.parse(JSON.stringify(h.state().job.rows[0].draft)),draft);
 h.register();assert.equal(h.managed().length,1);assert.equal(h.fetches,1);assert(h.public(h.managed()[0]));
 assert.equal(h.managed()[0].values.source,'[RS: Oper], [RW: Oper], [GM]');assert.equal(h.managed()[0].values.ja,draft.ja);
});
test('an unselected or fabricated source heading is retained and rejected, never stripped to permit registration',()=>{
 for(const mode of ['unselected','detailed','unknown','inline','duplicate']){
  const h=harness(),mutate=h.mutateDraft;
  h.mutateDraft=d=>{mutate(d);
   if(mode==='unselected')d.notes_support.usage_ids=JSON.parse(h.lastRequest.input).domain_context.usage_examples.filter(e=>e.tab!=='RW').map(e=>e.id);
   const heading={unselected:'[RW: Oper]',detailed:'[GM: invented]',unknown:'[H: KM1-1]',inline:'Text [GM]',duplicate:'[GM]\nG-Saite\n[GM]'}[mode];
   d.ja+='\n\n'+heading+'\nG-Saite';
  };
  const s=h.run();assert.equal(s.job.rows[0].status,'needs_review');assert(s.validationErrors.some(e=>e.field==='ja'&&e.message.includes('トークン')));
  assert.throws(()=>h.register(),/トークン/);assert.equal(h.writes.length,0);assert.equal(h.managed().length,0);assert.equal(h.fetches,1);
 }
});
test('checking a saved legacy draft never reformats its text, regenerates it, or changes its Notes row',()=>{
 const h=harness();h.run();const existing=legacyDraft(h),job=h.state().job;
 for(const field of ['ja','en'])job.rows[0].draft[field]+='\n\n[GM]\nG-Saite';
 job.rows[0].status='needs_review';h.c.rowCompletionSave_(job);
 const saved=JSON.stringify(h.state().job.rows[0].draft),rows=JSON.stringify(h.rows),writes=h.writes.length;
 h.state();h.run();assert.equal(JSON.stringify(h.state().job.rows[0].draft),saved);assert.equal(JSON.stringify(h.rows),rows);
 assert.equal(h.state().entry.number,existing.number);assert.equal(h.fetches,1);assert.equal(h.writes.length,writes);assert.equal(h.state().validationErrors.length,0);
});
test('stale review, source edit or added duplicate prevent any registration write',()=>{
 for(const mode of ['stale','source','duplicate','layout']){
  const h=harness();h.run();const s=h.state(),before=h.writes.length;
  if(mode==='stale'){const j=s.job;j.rows[0].message='another result';h.c.rowCompletionSave_(j);}
  if(mode==='source')h.relatedSheets.GM.data[1][3]='changed';
  if(mode==='duplicate')h.put('de','Saite',2);
  if(mode==='layout'){const a=h.headers.indexOf('de'),b=h.headers.indexOf('source');[h.headers[a],h.headers[b]]=[h.headers[b],h.headers[a]];}
  assert.throws(()=>h.register(s.job.rows[0].draft,true,s.jobHash),mode==='stale'?/変わりました/:/出典|見出し|列構成/);
  assert.equal(h.managed().length,0);assert.equal(h.writes.length,before);assert.equal(h.fetches,1);
 }
});
test('legacy etwas-style de/source draft and generated text are reused only after approval, without duplicate or regeneration',()=>{
 const h=harness();h.run();const r=legacyDraft(h),before=JSON.stringify(h.rows),saved=JSON.stringify(h.state().job.rows[0].draft);
 h.run();assert.equal(h.fetches,1);assert.equal(JSON.stringify(h.rows),before);assert.equal(JSON.stringify(h.state().job.rows[0].draft),saved);
 assert.equal(h.state().entry.number,r.number);const s=h.register();assert.equal(h.managed().length,1);assert.equal(s.entry.number,r.number);assert.equal(s.entry.values.de,'Saite');
 assert.equal(h.managed()[0].values.de,r.values.de);assert.equal(h.managed()[0].values.source,r.values.source);assert.equal(h.fetches,1);
});
test('manual text, source edits and owner changes on a legacy draft are preserved',()=>{
 for(const mode of ['ja','source','owner']){
  const h=harness();h.run();const r=legacyDraft(h);
  h.putManaged(r,mode==='owner'?'maintenance_id':mode,mode==='ja'?'ユーザー本文．':mode==='source'?'[GM]':'another-owner');
  const before=JSON.stringify(h.rows);assert.throws(()=>h.register());assert.equal(JSON.stringify(h.rows),before);assert.equal(h.fetches,1);
 }
});
test('failed atomic registration resumes the exact intent without another charge or row',()=>{
 for(const phase of ['before','after']){
  const h=harness();h.run();let once=true;
  h[phase==='before'?'beforeBatchWrite':'afterBatchWrite']=()=>{if(once){once=false;throw Error('synthetic batch outcome interruption');}};
  let s=h.register();assert.equal(s.job.rows[0].status,'partial');assert.equal(h.fetches,1);
  if(phase==='before')assert.equal(h.managed().length,0);
  else {const r=h.managed()[0];assert(r.values.de&&r.values.ja&&r.values.en&&r.values.source);}
  h.beforeBatchWrite=null;h.afterBatchWrite=null;h.run();assert.equal(h.fetches,1);assert.equal(h.state().job.rows[0].status,'partial');
  s=h.register();assert.equal(s.job.intake.phase,'registered');assert.equal(h.managed().length,1);assert.equal(h.fetches,1);
  assert.equal(h.writes.filter(w=>w.values&&w.number>1).length,1);
 }
});

test('manual edits or owner changes after an uncertain batch are preserved on retry',()=>{
 for(const mode of ['text','owner']){
  const h=harness();h.run();let changed=false;
  h.afterBatchWrite=number=>{if(!changed){changed=true;if(mode==='text')h.put('en','人の英語入力',number);else h.c.notesRegistrationCell_(h.sheet,number,'maintenance_id').setValue('another-owner');throw Error('uncertain outcome');}};
  let s=h.register();assert.equal(s.job.rows[0].status,'partial');const before=JSON.stringify(h.rows);
  h.afterBatchWrite=null;if(mode==='owner')assert.throws(()=>h.register(),/同じ見出し/);else {s=h.register();assert.equal(s.job.rows[0].status,'partial');}assert.equal(JSON.stringify(h.rows),before);assert.equal(h.fetches,1);
  if(mode==='text')assert.equal(h.value('en',h.state().job.intake.number),'人の英語入力');
 }
});

test('reserved row becoming used is never replaced by a second append',()=>{
 const h=harness();h.run();let once=true;h.beforeBatchWrite=()=>{if(once){once=false;throw Error('synthetic reservation interruption');}};
 h.register();h.beforeBatchWrite=null;const number=h.state().job.intake.number;h.put('de','人の追加項目',number);
 const s=h.register();assert.equal(s.job.rows[0].status,'partial');assert.equal(h.value('de',number),'人の追加項目');assert.equal(h.managed().length,0);
});
test('protected, merged or array-formula Notes fields cannot receive approved content',()=>{
 for(const mode of ['protected','merged','array']){
  const h=harness();h.run();if(mode==='protected')h.editable=false;if(mode==='merged')h.merged=true;
  if(mode==='array')h.formula('ja','=ARRAYFORMULA(A2:A)',3);
  const s=h.register();assert.equal(s.job.rows[0].status,'partial');assert(h.managed().every(r=>!h.public(r)));assert(h.managed().every(r=>!r.values.ja&&!r.values.en));
 }
});
test('concurrent intake claim prevents another user generating the same private proposal',()=>{
 const h=harness();h.run();h.user='second';assert.throws(()=>h.run(),/同じ見出しの処理/);assert.equal(h.fetches,1);assert.equal(h.managed().length,0);
});
test('switching selection returns only that word, not a previous task or the collection of draft Notes',()=>{
 const h=harness();h.run();const j=h.state().job,s=h.c.maintenanceWorkbenchState('observation-other');
 assert.equal(s.job,null);assert.equal(s.entry,null);assert(!('drafts'in s));assert(!('draftCount'in s));assert(s.otherWorkPending);
 assert(!JSON.stringify(s).includes(j.rows[0].draft.ja));assert.equal(h.state().job.id,j.id);
});
test('old regular Apply endpoint routes intake through content approval, not blind auto-save',()=>{
 const h=harness();h.run();const s=h.state();h.c.rowCompletionApply(s.job.id,0,s.job.rows[0].draft);
 assert.equal(h.managed().length,1);assert(h.public(h.managed()[0]));assert.equal(h.fetches,1);
});
test('registered private claims are released; finishing uncertain work never deletes Notes or legacy records',()=>{
 const h=harness();h.run();h.register();assert(![...h.script.keys()].some(k=>k.startsWith('row-completion-v1:claim:')));
 const h2=harness();h2.transportFailure=true;h2.run();const s=h2.state();h2.now+=8*60*1000;
 assert.throws(()=>h2.c.maintenanceWorkbenchFinish(s.job.id,false),/確認/);h2.c.maintenanceWorkbenchFinish(s.job.id,true);
 assert.equal(h2.state().job.closed,true);assert.equal(h2.managed().length,0);assert.equal(h2.fetches,1);
});
// Synthetic originals and locations below exercise matching only, not real corpus claims.
function sourceScanFixture(term, byTab) {
 const h=harness();h.observation[1]=term;
 // This fixture owns its Notes table; published headwords must not affect registration tests.
 const existing={de:'allgemein',ja:'【一般的な意味】\n① 合成テスト用の既存語．',en:'【General meanings】\n① Existing synthetic headword.',source:'[GM]'};
 h.rows.splice(1,h.rows.length-1,h.headers.map(key=>existing[key]||''));
 h.formulas.splice(1,h.formulas.length-1,h.headers.map(()=>''));
 for(const tab of ['GM','RW','RS']){
  const sheet=h.relatedSheets[tab],headers=sheet.data[0];
  const rows=(byTab[tab]||[]).map(value=>{
   const r=typeof value==='string'?{de:value}:value;
   const defaults={ja:'合成テスト用の訳．',en:'Synthetic fixture translation.',data:'M-1-1-1-all&',Oper:'synthetic-work',Aufzug:1,Szene:1,page:1,whom:''};
   return headers.map(key=>r[key]!==undefined?r[key]:defaults[key]!==undefined?defaults[key]:'');
  });
  sheet.data.splice(1,sheet.data.length-1,...rows);
 }
 h.source=()=>h.c.maintenanceNotesSource_(h.c.SpreadsheetApp.getActiveSpreadsheet(),term);
 return h;
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
 assert.throws(()=>h.source(),/形そのもの/);assert.throws(()=>h.run(),/形そのもの/);assert.equal(h.fetches,0);assert.equal(h.writes.length,0);assert.equal(h.managed().length,0);
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
test('late Aufzug evidence reaches private review and still requires one explicit complete registration',()=>{
 const h=sourceScanFixture('Aufzug',{RS:['Aufzuges','Aufzug'],RW:['Aufzugs','Aufzug']});
 h.mutateDraft=d=>{d.ja='【一般的な意味】\n① 合成テスト用の意味．\n\n【音楽用語としての訳例】\n合成用例の訳．';d.en='【General meanings】\n① Synthetic fixture meaning.\n\n【Musical translation examples】\nSynthetic example translation.';
  d.notes_support={english:'',italian:'',rationale:'合成テストの文言であり，実資料の語義を主張しない．',usage_ids:JSON.parse(h.lastRequest.input).domain_context.usage_examples.map(e=>e.id)};};
 let s=h.run();assert.equal(s.job.rows[0].snapshot.values.de,'Aufzug');assert.equal(h.managed().length,0);assert.equal(h.writes.length,0);
 assert.deepEqual([...s.job.intake.plan.proof].map(p=>[p.tab,p.number,p.german]),[['RS',3,'Aufzug'],['RW',3,'Aufzug']]);
 assert.throws(()=>h.register(undefined,false),/確認/);s=h.register();assert.equal(s.job.intake.phase,'registered');assert.equal(h.managed()[0].values.de,'Aufzug');
 const registered=JSON.stringify(h.rows);h.register();h.run();assert.equal(h.managed().length,1);assert.equal(h.fetches,1);
 assert.equal(JSON.stringify(h.rows),registered);assert.equal(h.mapping.data.length,1);
});
test('an explicitly existing Aufzug still blocks generation without Notes writes or aliases',()=>{
 const h=sourceScanFixture('Aufzug',{RS:['Aufzuges','Aufzug'],RW:['Aufzugs','Aufzug']});h.put('de','Aufzug');
 const before=JSON.stringify(h.rows);assert.throws(()=>h.run(),/同じ見出し/);
 assert.equal(JSON.stringify(h.rows),before);assert.equal(h.fetches,0);assert.equal(h.writes.length,0);assert.equal(h.mapping.data.length,1);
});

test('RW/RS source requires work and numeric page, accepts zero and skips incomplete first matches',()=>{
 const h=harness(),data=h.relatedSheets.RW.data;data[1][3]='';data[1][6]='';let source=h.c.maintenanceNotesSource_(h.c.SpreadsheetApp.getActiveSpreadsheet(),'Saite');
 assert(!source.source.includes('[RW: Oper]'));const next=data[1].slice();next[3]='walküre';next[6]=0;data.push(next);
 source=h.c.maintenanceNotesSource_(h.c.SpreadsheetApp.getActiveSpreadsheet(),'Saite');assert(source.source.includes('[RW: Oper]'));assert.equal(source.proof.find(p=>p.tab==='RW').number,3);
});
test('normal alias registration still uses approved Notes without Jev, modifies no Notes body and adds no duplicate mapping',()=>{
 const h=harness();h.run();h.register();h.observation[1]='Saiten';const before=JSON.stringify(h.rows),calls=h.fetches;
 h.c.maintenanceAliasApply(h.observationId,'Saite','INFLECTION',true);h.c.maintenanceAliasApply(h.observationId,'Saite','INFLECTION',true);
 assert.equal(h.mapping.data.length,2);assert.equal(JSON.stringify(h.rows),before);assert.equal(h.fetches,calls);
 assert.throws(()=>h.c.maintenanceAliasApply(h.observationId,'Saite','NEW_TERM_CANDIDATE',true));
});
test('dialogs use safe text, no model controls, no historical job heading or all-drafts approval list',()=>{
 const html=fs.readFileSync(path.join(root,'src/maintenance_workbench_dialog.html'),'utf8');
 for(const name of ['maintenance_workbench_dialog.html','maintenance_alias_dialog.html']){
  const t=fs.readFileSync(path.join(root,'src',name),'utf8'),js=t.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(js);
  assert(!/innerHTML|window\.confirm|setInterval|\.alert\(/.test(js));assert(js.includes('textContent'));assert(!/OPENAI_API_KEY|OPENAI_DRAFT_MODEL|TYPESAFE_API_KEY/.test(t));
 }
 assert(!/本人の前回作業|公開承認|再承認|maintenanceNotesApprove|gpt-6.1-solを検査|state\.drafts/.test(html));
 assert(html.includes('showMaintenanceSelectedRows'));assert(html.includes('出典・根拠・用例'));assert(html.includes('登録する日本語本文'));assert(html.includes('登録する英語本文'));
 const code=fs.readFileSync(path.join(root,'src/maintenance_workbench.js'),'utf8');assert(!/UrlFetchApp\.fetch|setProperty\('OPENAI|deleteSheet|deleteRow/.test(code));
});
function dialogHarness(h) {
 class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.events={};this.value='';this.disabled=false;this.textContent='';this.checked=false;}
  appendChild(child){this.children.push(child);return child;}replaceChildren(){this.children=[];}
  addEventListener(type,fn){this.events[type]=fn;}setAttribute(name,value){this[name]=value;}
  click(){assert(!this.disabled,'disabled: '+this.textContent);this.events.click();}
 }
 const ids=Object.fromEntries(['observation','run','refresh','message','current','finishArea','checked','finish','selectedRows'].map(id=>[id,new Element(id==='checked'?'input':id==='observation'?'select':['run','refresh','finish','selectedRows'].includes(id)?'button':'div')]));
 const all=()=>{const out=[];function walk(e){out.push(e);e.children.forEach(walk);}Object.values(ids).forEach(walk);return out;};
 const calls=[],queue=[],timers=new Map();let fail=false,timerId=0;
 function runner(success,failure){return new Proxy({withSuccessHandler(fn){return runner(fn,failure);},withFailureHandler(fn){return runner(success,fn);}}, {get(object,key){if(key in object)return object[key];return(...args)=>queue.push(()=>{
  calls.push({method:key,args});if(fail){fail=false;failure({message:'ROW_COMPLETION: 通信の結果を確認してください．'});return;}
  if(key==='showMaintenanceSelectedRows')return;
  try{const result=h.c[key](...args);if(success)success(JSON.parse(JSON.stringify(result)));}
  catch(e){if(failure)failure({message:e.message});else throw e;}
 });}});}
 const document={getElementById:id=>ids[id],createElement:tag=>new Element(tag),querySelectorAll:selector=>all().filter(e=>selector.split(',').map(s=>s.toUpperCase()).includes(e.tagName))};
 const html=fs.readFileSync(path.join(root,'src/maintenance_workbench_dialog.html'),'utf8');
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document,google:{script:{run:runner()}},setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}});
 const next=(index=0)=>{assert(queue.length>index);queue.splice(index,1)[0]();};next();
 const flushTimers=()=>{const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());};
 return{ids,all,calls,queue,next,flushTimers,validate(){flushTimers();next();},failNext(){fail=true;},button:label=>all().find(e=>e.tagName==='BUTTON'&&e.textContent===label),confirmation:()=>all().filter(e=>e.tagName==='INPUT'&&e!==ids.checked).at(-1),warnings:()=>all().filter(e=>e.className==='error').map(e=>e.textContent)};
}
test('actual workbench UI generates privately, previews edited ja/en, preserves edits after uncertain save and registers once',()=>{
 const h=harness(),mutate=h.mutateDraft;h.mutateDraft=d=>{mutate(d);d.notes_support.rationale='未検証 <img src=x onerror=bad()>';};
 const ui=dialogHarness(h);assert.equal(h.fetches,0);assert.equal(h.writes.length,0);
 ui.ids.run.click();assert(ui.ids.run.disabled);ui.next();assert.equal(h.fetches,1);assert.equal(h.writes.length,0);
 assert(ui.all().some(e=>e.textContent==='未検証 <img src=x onerror=bad()>'));assert(!ui.all().some(e=>e.tagName==='IMG'));
 const ja=ui.all().find(e=>e['aria-label']==='登録する日本語本文');ja.value+='\n確認して加筆．';ja.events.input();
 assert(ui.all().some(e=>e.className==='body-preview'&&e.textContent===ja.value));
 const accepted=ja.value;ui.validate();ui.confirmation().checked=true;ui.failNext();const button=ui.button('内容を承認してNotesに登録');button.click();button.events.click();assert.equal(ui.queue.length,1);
 ui.next();assert(ui.button('内容を承認してNotesに登録').disabled);assert.equal(h.managed().length,0);
 ui.ids.refresh.click();ui.next();assert.equal(ui.all().find(e=>e['aria-label']==='登録する日本語本文').value,accepted);ui.validate();
 ui.confirmation().checked=true;ui.button('内容を承認してNotesに登録').click();ui.next();
 assert.equal(h.managed().length,1);assert.equal(h.managed()[0].values.ja,accepted);assert(h.public(h.managed()[0]));assert.equal(h.fetches,1);
 assert(!ui.button('内容を承認してNotesに登録'));assert(!ui.ids.selectedRows.disabled);
 ui.ids.selectedRows.click();ui.next();assert.equal(ui.calls.at(-1).method,'showMaintenanceSelectedRows');
});
test('actual workbench selector hides another word and resumes the saved proposal without API',()=>{
 const h=harness();h.c.candidateWizardBootstrap=()=>[{id:h.observationId,term:'Saite',status:'未判定'},{id:'another-observation',term:'etwas',status:'未判定'}];
 h.run();const ui=dialogHarness(h),body=h.state().job.rows[0].draft.ja;assert(ui.all().some(e=>e.className==='body-preview'&&e.textContent===body));
 ui.ids.observation.value='another-observation';ui.ids.observation.events.change();ui.next();
 assert(!ui.all().some(e=>e.className==='body-preview'));assert(ui.ids.run.disabled);assert.equal(h.fetches,1);
 ui.ids.observation.value=h.observationId;ui.ids.observation.events.change();ui.next();assert(ui.all().some(e=>e.className==='body-preview'&&e.textContent===body));assert.equal(h.fetches,1);
});
test('current registered entry shows manual edits without requiring reapproval or API',()=>{
 const h=harness();h.run();h.register();const r=h.managed()[0],ui=dialogHarness(h);
 h.put('ja',r.values.ja+'\n確認して修正．',r.number);h.put('en',r.values.en+'\nReviewed correction.',r.number);
 assert(h.public(h.managed()[0]));ui.ids.refresh.click();ui.next();
 assert(ui.all().some(e=>e.className==='body-preview'&&e.textContent===h.value('ja',r.number)));
 assert(!ui.button('編集後の内容を再承認'));assert(!ui.button('内容を承認してNotesに登録'));
 assert(h.public(h.managed()[0]));assert.equal(h.fetches,1);assert.equal(h.managed().length,1);assert(!ui.button('編集後の内容を再承認'));
});
test('legacy preparing record with no row does not produce a white screen or discard it',()=>{
 const h=harness();h.run();const j=h.state().job;j.rows=[];delete j.intake.flow;j.intake.phase='preparing';h.c.rowCompletionSave_(j);
 const before=JSON.stringify(h.state().job);const ui=dialogHarness(h);assert(ui.all().some(e=>e.textContent.includes('準備状態の確認')));assert.equal(JSON.stringify(h.state().job),before);assert.equal(h.fetches,1);
});
test('draft validation uses the current text and identical registration rules without changing any stored work',()=>{
 const h=harness();h.run();const s=h.state(),fields=JSON.parse(JSON.stringify(s.job.rows[0].draft));
 const snapshot=()=>JSON.stringify({rows:h.rows,script:[...h.script],users:[...h.users].map(([id,map])=>[id,[...map]])});
 const before=snapshot(),calls=h.fetches,keyReads=h.keyReads;
 let result=h.c.maintenanceNotesValidateDraft(s.job.id,s.jobHash,fields);assert.equal(result.validationErrors.length,0);assert.equal(h.keyReads,keyReads);
 assert.equal(result.jobId,s.job.id);assert.equal(result.jobHash,s.jobHash);
 for(const [field,token]of [['ja','[GM: invented]'],['en','[[score:invented]]'],['ja','https://example.invalid/new']]){
  const invalid={...fields,[field]:fields[field]+'\n'+token},reads=h.keyReads;result=h.c.maintenanceNotesValidateDraft(s.job.id,s.jobHash,invalid);assert.equal(h.keyReads,reads);
  assert(result.validationErrors.some(e=>e.field===field&&e.message.includes('トークン')));
  assert.throws(()=>h.register(invalid),/トークン/);
 }
 const edited={ja:fields.ja.replace('【英】string／【伊】corda','【英】strings／【伊】corde'),en:fields.en.replace('Italian: corda','Italian: corde')};
 const reads=h.keyReads;assert.equal(h.c.maintenanceNotesValidateDraft(s.job.id,s.jobHash,edited).validationErrors.length,0);assert.equal(h.keyReads,reads);
 assert.equal(snapshot(),before);assert.equal(h.fetches,calls);assert.equal(h.writes.length,0);
 assert.equal(h.state().job.rows[0].notesSupport.humanReviewed,false);
});
test('read-only validation rejects stale, closed, reserved, malformed, and another user jobs without writes',()=>{
 for(const mode of ['hash','closed','intent','status','fields','length','user']){
  const h=harness();h.run();let s=h.state(),fields=JSON.parse(JSON.stringify(s.job.rows[0].draft));
  if(mode==='closed'){s.job.closed=true;h.c.rowCompletionSave_(s.job);}
  if(mode==='intent'){s.job.intake.intent={ja:fields.ja,en:fields.en};h.c.rowCompletionSave_(s.job);}
  if(mode==='status'){s.job.rows[0].status='generating';h.c.rowCompletionSave_(s.job);}
  s=h.state();if(mode==='fields')fields={...fields,extra:'not allowed'};if(mode==='length')fields.ja='x'.repeat(6001);
  const before=JSON.stringify(h.rows),calls=h.fetches;if(mode==='user')h.user='another-user';
  assert.throws(()=>h.c.maintenanceNotesValidateDraft(s.job.id,mode==='hash'?'0'.repeat(64):s.jobHash,fields));
  assert.equal(h.writes.length,0);assert.equal(JSON.stringify(h.rows),before);assert.equal(h.fetches,calls);
 }
});
test('editing invalid text updates warnings, blocks approval immediately, and requires a new confirmation after correction',()=>{
 const h=harness();h.run();const ui=dialogHarness(h),ja=ui.all().find(e=>e['aria-label']==='登録する日本語本文'),original=ja.value;
 assert(ui.button('内容を承認してNotesに登録').disabled);ui.validate();assert(!ui.button('内容を承認してNotesに登録').disabled);
 ui.confirmation().checked=true;ja.value+='\n[GM: invented]';ja.events.input();
 assert(!ui.confirmation().checked);assert(ui.button('内容を承認してNotesに登録').disabled);ui.validate();assert(ui.warnings().some(t=>t.startsWith('日本語本文：')&&t.includes('トークン')));
 ja.value=original;ja.events.input();assert(!ui.warnings().length);assert(ui.button('内容を承認してNotesに登録').disabled);ui.validate();assert(!ui.warnings().length);
 assert(!ui.confirmation().checked);ui.button('内容を承認してNotesに登録').click();assert.equal(ui.queue.length,0);assert.equal(h.writes.length,0);assert.equal(h.fetches,1);
 const en=ui.all().find(e=>e['aria-label']==='登録する英語本文');en.value+='\n[[score:invented]]';en.events.input();ui.validate();assert(ui.warnings().some(t=>t.startsWith('英語本文：')));
});
test('debounced current-text checks ignore out-of-order responses and never validate each keystroke',()=>{
 const h=harness();h.run();const ui=dialogHarness(h),ja=ui.all().find(e=>e['aria-label']==='登録する日本語本文'),original=ja.value;
 ja.value+='\n[GM: invented]';ja.events.input();ui.flushTimers();assert.equal(ui.queue.length,1);
 ja.value=original;ja.events.input();ja.events.input();ja.events.input();ui.flushTimers();assert.equal(ui.queue.length,2);
 ui.next(1);assert(!ui.button('内容を承認してNotesに登録').disabled);assert.equal(ui.warnings().length,0);
 ui.next();assert(!ui.button('内容を承認してNotesに登録').disabled);assert.equal(ui.warnings().length,0);
 assert.equal(ui.calls.filter(c=>c.method==='maintenanceNotesValidateDraft').length,2);assert.equal(h.fetches,1);assert.equal(h.writes.length,0);
});
test('an old validation response cannot restore a previous word after the selector changes',()=>{
 const h=harness();h.c.candidateWizardBootstrap=()=>[{id:h.observationId,term:'Saite',status:'未判定'},{id:'other',term:'another',status:'未判定'}];h.run();const ui=dialogHarness(h);
 ui.flushTimers();ui.ids.observation.value='other';ui.ids.observation.events.change();ui.next(1);ui.next();
 assert(!ui.button('内容を承認してNotesに登録'));assert(!ui.all().some(e=>e.className==='body-preview'));assert.equal(h.fetches,1);assert.equal(h.writes.length,0);
});
test('failed or mismatched validation keeps edits and approval blocked, with explicit read-only refresh recovery',()=>{
 for(const mode of ['failure','mismatched','malformed']){
  const h=harness();h.run();const ui=dialogHarness(h),ja=ui.all().find(e=>e['aria-label']==='登録する日本語本文');ja.value+='\n確認して加筆．';ja.events.input();const edited=ja.value;
  const original=h.c.maintenanceNotesValidateDraft;
  if(mode==='failure')ui.failNext();
  else h.c.maintenanceNotesValidateDraft=()=>mode==='mismatched'?{jobId:'other',jobHash:'other',validationErrors:[]}:{jobId:h.state().job.id,jobHash:h.state().jobHash};
  ui.validate();assert(ui.button('内容を承認してNotesに登録').disabled);assert(ui.warnings().some(t=>t.includes('検証結果を確認できません')));
  assert.equal(ja.value,edited);h.c.maintenanceNotesValidateDraft=original;ui.ids.refresh.click();ui.next();ui.validate();
  assert.equal(ui.all().find(e=>e['aria-label']==='登録する日本語本文').value,edited);assert(!ui.button('内容を承認してNotesに登録').disabled);assert.equal(h.writes.length,0);assert.equal(h.fetches,1);
 }
});
test('stale work hashes and edits that bypass input events cannot cause an unvalidated registration',()=>{
 const h=harness();h.run();const ui=dialogHarness(h);ui.validate();const ja=ui.all().find(e=>e['aria-label']==='登録する日本語本文');
 ui.confirmation().checked=true;ja.value+='\n[[score:invented]]';ui.button('内容を承認してNotesに登録').events.click();assert.equal(ui.calls.filter(c=>c.method==='maintenanceNotesRegister').length,0);assert.equal(h.writes.length,0);
 const j=h.state().job;j.rows[0].message='changed in another request';h.c.rowCompletionSave_(j);ui.validate();assert(ui.button('内容を承認してNotesに登録').disabled);assert(ui.warnings().some(t=>t.includes('処理状態が変わりました')));assert.equal(h.fetches,1);
});
test('failed bootstrap and malformed legacy records keep a visible recovery message without generation or data changes',()=>{
 for(const mode of ['failure','invalid-response','missing-intake','missing-plan','invalid-rows']){
  const h=harness();h.run();const j=h.state().job;
  if(mode==='missing-intake')delete j.intake;if(mode==='missing-plan')delete j.intake.plan;if(mode==='invalid-rows')j.rows=null;
  const state=h.state(),safe=JSON.parse(JSON.stringify(state));safe.job=j;
  h.c.maintenanceWorkbenchState=()=>{if(mode==='failure')throw Error('ROW_COMPLETION: 読取結果を確認してください．');return mode==='invalid-response'?{observations:[null]}:safe;};
  const before=JSON.stringify(h.rows),calls=h.fetches,ui=dialogHarness(h);
  assert(!ui.button('内容を承認してNotesに登録'));assert(!ui.ids.refresh.disabled);
  assert(ui.ids.message.textContent.includes('自動で繰り返しません')||ui.warnings().some(t=>t.includes('保存記録の構成')));
  assert.equal(ui.calls.length,1);assert.equal(ui.queue.length,0);assert.equal(h.fetches,calls);assert.equal(JSON.stringify(h.rows),before);assert.equal(h.writes.length,0);
 }
});
test('verified bracketed source headings validate and register exactly as edited without another API call',()=>{
 const h=harness();h.run();const s=h.state(),fields=JSON.parse(JSON.stringify(s.job.rows[0].draft));
 fields.ja+='\n[GM]\nG-Saite．\n[RW: Oper]\nSaiten．\n[RS: Oper]\nSaiten．';
 fields.en+='\n[GM]\nG string.\n[RW: Oper]\nStrings.\n[RS: Oper]\nStrings.';
 const ui=dialogHarness(h),ja=ui.all().find(e=>e['aria-label']==='登録する日本語本文');ja.value=fields.ja;ja.events.input();ui.validate();
 assert(!ui.button('内容を承認してNotesに登録').disabled);assert.equal(h.writes.length,0);
 assert.equal(h.c.maintenanceNotesValidateDraft(s.job.id,s.jobHash,fields).validationErrors.length,0);
 h.register(fields);assert.equal(h.managed()[0].values.ja,fields.ja);assert.equal(h.managed()[0].values.en,fields.en);assert.equal(h.fetches,1);
});
test('pending Notes proposal follows identical source content after a sort and never accepts changed evidence',()=>{
 for(const changed of [false,true]){
  const h=harness();h.run();const before=h.state(),gm=h.relatedSheets.GM;
  gm.data.splice(1,0,['An unrelated instruction','別の行','Other row','M-9-9-9-v1&']);
  if(changed)gm.data[2][3]='M-9-9-10-v1&';
  if(changed){assert.throws(()=>h.register(),/出典/);assert.equal(h.managed().length,0);}
  else{h.register();assert.equal(h.managed().length,1);assert.equal(h.state().job.intake.plan.proof.find(p=>p.tab==='GM').number,3);}
  assert.equal(h.fetches,1);assert.equal(before.job.rows[0].draft.ja,h.state().job.rows[0].draft.ja);
 }
});
console.log('Unified maintenance review-before-insert: '+passed+' scenarios passed. Private generation, explicit approved registration, legacy recovery, one-word display, aliases and no live calls.');
