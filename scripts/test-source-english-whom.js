'use strict';
// Synthetic values only. Real Sheets and paid endpoints are never contacted.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const read=n=>fs.readFileSync(path.join(__dirname,'../src/'+n+'.js'),'utf8');
const workflow=read('sheet_column_layout')+'\n'+read('source_english_workflow'),api=read('source_english_api');
const {extract}=require('./test-source-english-edit-stop');
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const clone=v=>JSON.parse(JSON.stringify(v));
const headers=['区分','作品','指示対象（原語）','ユーザー選択案','ユーザー判断','第1案（推奨）','第2案','第3案','推奨理由・判断が難しい点','自由修正（英訳）'];
const item=(name='使者',english='Messenger',tab='RW',work='sample')=>[tab,'模擬作品 ['+work+']',name,'第1案','承認',english,'Alternative','Third','test reason','Custom'];
let passed=0;const names=[];
function test(name,fn){try{fn();passed++;names.push(name);}catch(e){e.message=name+': '+e.message;throw e;}}
const resolver=vm.createContext({NOTES_ENGLISH_META:'meta',notesEnglishHash_:hash});vm.runInContext(workflow,resolver);
function resolve(source,items=[item()],options={}){
  const rows=[headers,...items],formulas=rows.map(()=>Array(10).fill(''));
  if(options.formula)formulas[options.formula[0]][options.formula[1]]='=test';
  return resolver.sourceEnglishWhomResolve_(options.tab||'RW',options.work||'sample',source,rows,formulas);
}
test('approved selection beats old I and plain-script fallback',()=>assert.equal(resolve('Orchester',[item('Orchester','Orchestra')]).value,'Orchestra'));
test('second, third and custom selection use the selected cell',()=>{for(const [pick,expected] of [['第2案','Alternative'],['第3案','Third'],['自由修正','Custom']]){const r=item();r[3]=pick;assert.equal(resolve('使者',[r]).value,expected);}});
test('scope uses composer and exact Unicode work code',()=>{
  assert.equal(resolve('使者',[item('使者','Wrong','RS'),item('使者','Other','RW','different')]).status,'HOLD');
  assert.equal(resolve('使者',[item('使者','Right','RW','wälk')],{work:'wälk'}).value,'Right');
});
test('multiple targets retain order, repetitions and separators',()=>assert.equal(resolve('使者、 Arindal;使者\nBrünnhilde').value,'Messenger、 Arindal;Messenger\nBrünnhilde'));
test('whole approved compound wins over splitting',()=>assert.equal(resolve('甲、乙',[item('甲、乙','Pair')]).value,'Pair'));
test('European proper name stays nonempty with explicit unconfirmed notice',()=>{const p=resolve('Brünnhilde',[]);assert.equal(p.value,'Brünnhilde');assert.equal(p.reviewRequired,true);assert.match(p.reason,/確定ではありません/);});
test('unknown Japanese target holds the whole I value',()=>assert.equal(resolve('使者、未登録の役').status,'HOLD'));
test('explicit hold overrides European fallback',()=>{const r=item('Arindal','Arindal');r[4]='保留';assert.equal(resolve('Arindal',[r]).status,'HOLD');});
test('unselected or empty approved choice is held',()=>{for(const change of [r=>r[3]='',r=>r[5]='',r=>r[3]='toString']){const r=item();change(r);assert.equal(resolve('使者',[r]).status,'HOLD');}});
test('duplicate mappings are not guessed',()=>assert.equal(resolve('使者',[item(),item()]).status,'HOLD'));
test('approval and selected-text formulas are not accepted',()=>{for(const col of [0,1,2,3,4,5])assert.equal(resolve('使者',[item()],{formula:[1,col]}).status,'HOLD');});
test('blank input and empty split target never clear I',()=>{for(const v of ['',',使者','使者、'])assert.equal(resolve(v).status,'HOLD');});
test('unknown name does not inherit a different work approval',()=>assert.equal(resolve('未登録役',[item('未登録役','Other','RW','other')]).status,'HOLD'));
test('oversized assembled target is held, never truncated',()=>assert.equal(resolve(Array(99).fill('使者').join(','),[item('使者','x'.repeat(1000))]).status,'HOLD'));
test('changed approval data changes reference hash',()=>{const a=resolve('使者'),r=item();r[4]='保留';assert.notEqual(a.referenceHash,resolve('使者',[r]).referenceHash);});

function harness(options={}){
  let now=1800000000000,row=2,fetches=0,bodyWritten=false,iWritten=false,settled=0;
  const tab=options.tab||'RW',id='NE-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const otherId='NE-cccccccc-cccc-cccc-cccc-cccccccccccc';
  const values=['sample','1','1','12',options.whom||'使者','leise','','静かに','old target','静かに','','old body','','existing evidence','確認待ち'];
  const notes=Array(15).fill(''),formulas=Array(15).fill('');
  const table=[headers,item('使者','Messenger',tab)],tableFormulas=table.map(()=>Array(10).fill(''));
  if(options.hold)table[1][4]='保留';
  const other={schema:2,mode:'direct-english-v2',id:otherId,sourceTab:tab==='RW'?'GM':'Notes',sheetId:99,revision:1,at:now-50000,status:'BASE',reason:'OLD',reviewed:false,inputHash:hash('other'),jaHash:hash('other'),fHash:hash('other'),sourceHash:hash('other')};
  const lines=[JSON.stringify(other)],otherText=lines[0],writes=[];
  const props=new Map([['key','mock-key']]);
  if(options.flight)props.set('flight','already-in-flight');
  const propApi={getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)};
  const ledger={getLastRow:()=>lines.length+2,getMaxRows:()=>1000,getRange:(r,c,n,w)=>({kind:'ledger',row:r,col:c,width:w,
    getDisplayValues:()=>Array.from({length:n},(_,i)=>[lines[r-3+i]||'']),getFormulas:()=>Array.from({length:n},()=>[''])})};
  const sourceHeaders=['Oper','Aufzug','Szene','page','whom','de','de_normalized','ja','whom_en','現在の日本語（修正案）','修正点','改訂英訳候補','イタリア語の比較','根拠・未解決点','準備状態'];
  const sheet={getName:()=>tab,getSheetId:()=>7,getLastRow:()=>row,getMaxColumns:()=>15,getLastColumn:()=>15,
    getRange:(r,c,n,w)=>({kind:'sheet',row:r,col:c,width:w,
      getDisplayValues:()=>{if(options.readbackFailure&&iWritten)throw new Error('readback failed');return [(r===1?sourceHeaders:values).slice(c-1,c-1+w)];},
      getNotes:()=>[(r===1?Array(15).fill(''):notes).slice(c-1,c-1+w)],getFormulas:()=>[(r===1?Array(15).fill(''):formulas).slice(c-1,c-1+w)]})};
  const reference={getLastRow:()=>table.length+3,getMaxColumns:()=>12,getRange:()=>({getDisplayValues:()=>clone(table),getFormulas:()=>clone(tableFormulas)})};
  const selection={getSheet:()=>sheet,getRow:()=>row,getLastRow:()=>row};
  const book={getId:()=> 'test-book',getActiveRange:()=>selection,toast:()=>{},getSheetByName:name=>{
    if(name==='指示対象英訳確認'){if(options.tableFailure)throw new Error('unavailable');return options.missingTable?null:reference;}throw new Error('Unexpected sheet read');
  }};
  class Clock extends Date{constructor(v){super(arguments.length?v:now);}static now(){return now;}}
  const sandbox={NOTES_ENGLISH_META:'meta',NOTES_ENGLISH_MAX_ROWS:10000,NOTES_ENGLISH_API_KEY:'key',NOTES_ENGLISH_API_FLIGHT:'flight',NOTES_ENGLISH_API_CONFIG:'config',
    NOTES_ENGLISH_API_MAX_CALLS:100,NOTES_ENGLISH_API_MONTHLY_MICRO:5000000,NOTES_ENGLISH_API_MODEL:'mock-model',NOTES_ENGLISH_API_OUTPUT:16384,
    Date:Clock,console,notesEnglishHash_:hash,notesEnglishJson_:s=>{try{return JSON.parse(s);}catch(_){return null;}},notesEnglishLock_:f=>f(),
    PropertiesService:{getScriptProperties:()=>propApi},SpreadsheetApp:{getActiveSpreadsheet:()=>book,flush:()=>{}},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}}),getDocumentLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
    Utilities:{getUuid:()=>crypto.randomUUID(),sleep:ms=>{now+=ms;}},
    notesEnglishApiConfig_:()=>({tested:true,testedKeyHash:hash('mock-key')}),notesEnglishApiBudget_:()=>({entries:[],total:0}),notesEnglishApiBudgetSave_:()=>{},
    notesEnglishApiEstimate_:payload=>{if(options.inputLimit)throw new Error('limit');assert.equal(JSON.parse(payload.input[1].content).whom,values[4]);return {micro:1};},
    notesEnglishApiSettle_:()=>{settled++;},
    notesEnglishWrite_:(range,data)=>{
      if(range.kind==='ledger'){lines[range.row-3]=data[0];return;}
      assert.equal(range.row,row,'write follows metadata row');assert.equal(range.width,1,'never rewrite J/K or a whole row');
      if(range.col===12&&options.bodyWriteFailure)throw new Error('body save failed');
      if(range.col===9&&options.whomWriteFailure)throw new Error('target save failed');
      if(range.col===14&&options.logWriteFailure)throw new Error('log save failed');
      writes.push(range.col);if(!(range.col===9&&options.ignoreIWrite))values[range.col-1]=data[0];
      if(range.col===12){bodyWritten=true;if(options.afterBodyEdit!==undefined)values[options.afterBodyEdit]='concurrent edit';}
      if(range.col===9)iWritten=true;
    },
    UrlFetchApp:{fetch:()=>{
      fetches++;
      if(options.duringResponseEdit!==undefined)values[options.duringResponseEdit]='concurrent edit';
      if(options.referenceChange)table[1][5]='Changed translation';
      if(options.approvalChange)table[1][4]='保留';
      if(options.moveRow)row=3;
      if(options.newRequest){const idx=lines.findIndex(l=>JSON.parse(l).id===id),c=JSON.parse(lines[idx]);c.reason='NEWER';c.revision++;lines[idx]=JSON.stringify(c);}
      return {getResponseCode:()=>options.httpFailure?500:200,getContentText:()=>JSON.stringify({status:'completed',output:[{type:'message',status:'completed',content:[{type:'output_text',text:JSON.stringify({status:options.advisory?'needs_review':'candidate',english:options.empty?'':'quietly',reason:options.advisory?'模擬の注意':''})}]}]})};
    }}
  };
  vm.createContext(sandbox);vm.runInContext(workflow+'\n'+api+'\n'+extract(read('notes_english_api'),'notesEnglishApiPayload_')+'\n'+extract(read('notes_english_api'),'notesEnglishApiParse_'),sandbox);
  const ctx={book,sheet,ledger,adapter:sandbox.sourceEnglishAdapter_(tab)};
  sandbox.sourceEnglishContext_=()=>ctx;
  sandbox.sourceEnglishIndex_=()=>({byId:{[id]:row},byRow:{[row]:id},allIds:{[id]:true}});
  function control(){const line=lines.find(l=>JSON.parse(l).id===id);return line&&JSON.parse(line);}
  return {run:()=>sandbox.regenerateSourceEnglishSelection(),values,notes,formulas,table,writes,props,control,sandbox,ctx,
    counts:()=>({fetches,settled,bodyWritten,iWritten}),assertOther:()=>assert.equal(lines[0],otherText),advance:()=>{now+=6000;}};
}
for(const tab of ['RW','RS']){
  test(tab+' manual menu updates only L,I,N; keeps mixed-tab ledger',()=>{const h=harness({tab});const r=h.run();assert.equal(r.written,1);assert.equal(r.held,0);assert.equal(h.values[8],'Messenger');assert.equal(h.values[11],'quietly');assert.deepEqual(h.writes,[12,9,14]);assert.match(h.values[13],/^existing evidence\n\n/);assert.equal(h.control().whomStatus,'UPDATED');assert.equal(h.counts().fetches,1);h.assertOther();});
  for(const col of [0,4,5,7,8,9,10,11,13,14])test(tab+' response-time edit at column '+(col+1)+' discards result',()=>{const h=harness({tab,duringResponseEdit:col});const r=h.run();assert.equal(r.written,0);assert.equal(r.held,1);assert.deepEqual(h.writes,[]);assert.equal(h.counts().fetches,1);h.assertOther();});
}
for(const opt of [{httpFailure:true},{empty:true},{inputLimit:true}])test('body failure retains both I and L '+JSON.stringify(opt),()=>{const h=harness(opt);h.run();assert.equal(h.values[8],'old target');assert.equal(h.values[11],'old body');assert.equal(h.control().status,'HOLD');assert.equal(h.control().whomStatus,'HELD');assert.match(h.values[13],/指示対象英訳/);assert.ok(!h.writes.includes(9));assert.ok(!h.writes.includes(12));});
for(const opt of [{hold:true},{whom:'未登録役'},{missingTable:true},{tableFailure:true}])test('unresolved target saves body but holds I '+JSON.stringify(opt),()=>{const h=harness(opt),r=h.run();assert.equal(r.written,1);assert.equal(r.held,1);assert.equal(r.whomHeld,1);assert.equal(h.values[8],'old target');assert.equal(h.values[11],'quietly');assert.equal(h.control().whomStatus,'HELD');assert.match(h.control().reviewReason,/指示対象英訳/);});
test('untranslated European name remains nonempty and visibly unconfirmed',()=>{const h=harness({whom:'Arindal'});h.run();assert.equal(h.values[8],'Arindal');assert.equal(h.control().reason,'UPDATED_REVIEW_REQUIRED');assert.match(h.values[13],/確定ではありません/);});
for(const opt of [{referenceChange:true},{approvalChange:true}])test('changed reference preserves I '+JSON.stringify(opt),()=>{const h=harness(opt);h.run();assert.equal(h.values[8],'old target');assert.equal(h.control().whomStatus,'HELD');assert.match(h.values[13],/対応表が変わった/);});
test('body-write failure leaves I unchanged and save unresolved',()=>{const h=harness({bodyWriteFailure:true});assert.throws(()=>h.run());assert.equal(h.values[8],'old target');assert.equal(h.values[11],'old body');assert.equal(h.control().status,'WRITING');assert.ok(h.props.get('flight'));});
test('I-write failure retains saved body and unresolved flight; no resend',()=>{const h=harness({whomWriteFailure:true});assert.throws(()=>h.run());assert.equal(h.values[11],'quietly');assert.equal(h.values[8],'old target');assert.equal(h.control().whomStatus,'PENDING');assert.ok(h.props.get('flight'));h.run();assert.equal(h.counts().fetches,1);assert.equal(h.control().status,'WRITING');assert.equal(h.control().whomStatus,'PENDING');});
test('I readback failure stays unresolved with no automatic retry',()=>{const h=harness({readbackFailure:true});assert.throws(()=>h.run());assert.equal(h.control().status,'WRITING');assert.ok(h.props.get('flight'));assert.equal(h.counts().fetches,1);});
test('unmatched I readback is reported as unknown, not held unchanged',()=>{const h=harness({ignoreIWrite:true}),r=h.run();assert.equal(h.control().status,'HOLD');assert.equal(h.control().whomStatus,'PENDING');assert.equal(r.whomUnconfirmed,1);assert.equal(r.whomHeld,0);});
test('log failure with held target preserves WRITING across another click',()=>{const h=harness({hold:true,logWriteFailure:true});assert.throws(()=>h.run());h.run();assert.equal(h.control().status,'WRITING');assert.equal(h.control().whomStatus,'HELD');assert.equal(h.counts().fetches,1);});
test('partial save status identifies L/I even when the input hash changed',()=>{const h=harness({whomWriteFailure:true});assert.throws(()=>h.run());const d=h.sandbox.sourceEnglishStatusDetail_(h.control(),{inputChanged:true,inFlight:true});assert.match(d.reason,/本文英訳・指示対象英訳の保存完了は未確認/);assert.match(d.nextAction,/本文英訳・指示対象英訳・根拠欄/);});
test('E edit after body save prevents I overwrite',()=>{const h=harness({afterBodyEdit:4});const r=h.run();assert.equal(r.written,0);assert.equal(h.control().status,'HOLD');assert.equal(h.values[8],'old target');assert.equal(h.values[4],'concurrent edit');});
test('I edit after body save retains the user value',()=>{const h=harness({afterBodyEdit:8});h.run();assert.equal(h.values[8],'concurrent edit');assert.ok(!h.writes.includes(9));assert.equal(h.control().status,'HOLD');});
test('concurrent N-only edit survives I update and is reported',()=>{const h=harness({afterBodyEdit:13});h.run();assert.equal(h.values[13],'concurrent edit');assert.equal(h.values[8],'Messenger');assert.equal(h.control().reason,'UPDATED_LOG_UNSAVED');assert.deepEqual(h.writes,[12,9]);});
test('metadata relocation is followed for both writes',()=>{const h=harness({moveRow:true});h.run();assert.equal(h.values[8],'Messenger');assert.equal(h.values[11],'quietly');});
test('newer request keeps ownership; no candidate writes',()=>{const h=harness({newRequest:true});h.run();assert.deepEqual(h.writes,[]);assert.equal(h.control().reason,'NEWER');});
test('double click cannot dispatch a second request',()=>{const h=harness();h.run();h.run();assert.equal(h.counts().fetches,1);});
test('global in-flight record protects all tabs',()=>{const h=harness({flight:true});h.run();assert.equal(h.counts().fetches,0);assert.deepEqual(h.writes,[]);h.assertOther();});
test('body advisory coexists with whom status',()=>{const h=harness({advisory:true});h.run();assert.match(h.control().reviewReason,/模擬の注意/);assert.equal(h.control().whomStatus,'UPDATED');});
test('held target reason remains visible even if N is edited concurrently',()=>{const h=harness({hold:true,afterBodyEdit:13});const r=h.run();assert.equal(r.whomHeld,1);assert.equal(h.values[13],'concurrent edit');assert.equal(h.control().reason,'UPDATED_LOG_UNSAVED');assert.match(h.control().whomReason,/保留/);});
test('invalid whom state is rejected by shared ledger validator',()=>{const h=harness();h.run();const controls=h.sandbox.sourceEnglishControls_(h.ctx);const c=controls[Object.keys(controls)[0]].value;c.whomStatus='INVALID';assert.throws(()=>h.sandbox.sourceEnglishSave_(h.ctx,controls,c)&&h.sandbox.sourceEnglishControls_(h.ctx));});
test('RW/RS/GM editing remains inert without reading the table',()=>{for(const tab of ['RW','RS','GM']){const c=vm.createContext({NOTES_ENGLISH_META:'meta'});vm.runInContext(workflow,c);assert.equal(c.sourceEnglishEdited_({range:{getSheet:()=>({getName:()=>tab})},source:{}}),false);}});
test('Notes and GM do not touch the whom table',()=>{for(const tab of ['Notes','GM'])assert.equal(resolver.sourceEnglishWhomPlan_({adapter:{name:tab}},{}),null);});
test('I formulas prevent sending and are never overwritten',()=>{const h=harness();h.formulas[8]='=test';h.run();assert.equal(h.counts().fetches,0);assert.deepEqual(h.writes,[]);});
test('input-limit and missing table reasons are visible without adoption',()=>{const h=harness({missingTable:true});h.run();const c=h.control();assert.equal(c.reviewed,false);const detail=h.sandbox.sourceEnglishStatusDetail_(c,{now:1800000010000,inputChanged:false,keyPresent:true});assert.match(detail.reason,/指示対象英訳/);assert.match(detail.nextAction,/本文英訳/);});
console.log(JSON.stringify({passed,tests:names,networkCalls:0,productionWrites:0},null,2));
