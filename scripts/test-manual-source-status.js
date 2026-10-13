'use strict';
// Synthetic fixtures only. No external network, GAS or spreadsheet writes.
function runCandidateTests(workflow,api){
 const passed=[],NOW=1800000000000,H='a'.repeat(64),id='NE-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',uuid='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 function ok(v,m){if(!v)throw new Error(m);}
 function eq(a,b,m){ok(JSON.stringify(a)===JSON.stringify(b),m+' got '+JSON.stringify(a));}
 function test(n,f){f();passed.push(n);}
 function compile(names,env){return Function.apply(null,Object.keys(env).concat([names.map(function(n){
   const src=workflow.includes('function '+n+'(')?workflow:api,start=src.indexOf('function '+n+'(');ok(start>=0,'missing '+n);
   const m=/\nfunction [A-Za-z0-9_]+\(/.exec(src.slice(start));return src.slice(start,m?start+m.index:src.length);
 }).join('\n')+'\nreturn {'+names.map(function(n){return n+':'+n;}).join(',')+'};'])).apply(null,Object.values(env));}
 class FixedDate extends Date{constructor(v){super(arguments.length?v:NOW);}static now(){return NOW;}}
 const clone=function(v){return JSON.parse(JSON.stringify(v));};
 const control=function(status){return {schema:2,mode:'direct-english-v2',id:id,sourceTab:'Notes',sheetId:7,revision:1,at:NOW-60000,status:status||'REQUEST',reason:'QUEUED',inputHash:H,jaHash:H,fHash:H,sourceHash:H,requestId:uuid,readyAt:NOW-50000,reviewed:false};};
 const snapshot=function(){return {inputHash:H,jaHash:H,fHash:H,sourceHash:H,eligible:true,manualEligible:true,values:['sample','ja','src','draft','','old en','','evidence','確認待ち'],notes:Array(9).fill(''),formulas:Array(9).fill('')};};
 const ctx={adapter:{name:'Notes',de:0,ja:1,source:2,draft:3,changes:4,english:5,italian:6,evidence:7,status:8,width:9},sheet:{getSheetId:function(){return 7;}}};
 const base={Date:FixedDate,SOURCE_ENGLISH_MODE:'direct-english-v2',Utilities:{getUuid:function(){return uuid;},sleep:function(){}},NOTES_ENGLISH_API_FLIGHT:'flight',NOTES_ENGLISH_API_KEY:'key'};
 const env=function(e){return Object.assign({},base,e);};
 const detail=compile(['sourceEnglishStatusDetail_'],{}).sourceEnglishStatusDetail_,facts={now:NOW,keyPresent:true,inFlight:false,inputChanged:false,flightMatched:false};
 test('status: old record has no invented receipt time or retry',function(){const d=detail(control(),facts);eq([d.requestedAt,d.elapsedMs,d.nextRunAt,d.automaticRetry],[null,null,null,false],'unknown');ok(d.reason.includes('確認できません'),'execution unknown');});
 test('status: unmatched flight remains unresolved',function(){const d=detail(control(),Object.assign({},facts,{inFlight:true}));ok(d.reason.includes('対応する処理を確認できない')&&d.reason.includes('不明')&&d.nextAction.includes('自動解除しません'),'safe blocker');});
 test('status: matched flight does not prove running',function(){ok(detail(control(),Object.assign({},facts,{inFlight:true,flightMatched:true})).reason.includes('または結果未確定'),'uncertain');});
 test('status: missing key is specific',function(){eq(detail(control(),Object.assign({},facts,{keyPresent:false})).phase,'停止・設定不足','key');});
 test('status: readyAt is not a scheduled retry',function(){const c=control();c.readyAt=NOW+10;const d=detail(c,facts);ok(d.phase.includes('編集確定待ち')&&d.reason.includes('自動送信の予約ではありません'),'wait');});
 test('status: batch and time limits distinguished',function(){['BATCH_LIMIT','TIME_LIMIT'].forEach(function(code){const c=control();c.waitCode=code;ok(detail(c,facts).reason.includes(code==='BATCH_LIMIT'?'3件':'処理時間'),'limit');});});
 test('status: reserved is not HTTP running',function(){const d=detail(control('RESERVED'),facts);ok(d.reason.includes('API開始・実行中・終了は確認できません')&&d.nextAction.includes('再送せず'),'reserve');});
 test('status: changed F during WRITING does not permit resending',function(){const d=detail(control('WRITING'),Object.assign({},facts,{inputChanged:true}));ok(d.phase.includes('保存完了未確認')&&d.nextAction.includes('再送せず'),'writing');});
 test('status: edited source invalidates saved result',function(){eq(detail(control('WRITTEN'),Object.assign({},facts,{inputChanged:true})).phase,'入力変更あり','stale');});
 test('status: known receipt gives elapsed time without ETA',function(){const c=control();c.requestedAt=NOW-120000;eq([detail(c,facts).elapsedMs,detail(c,facts).nextRunAt],[120000,null],'elapsed');});
 test('status: saved advisory still needs human review',function(){const c=control('WRITTEN');c.reason='UPDATED_REVIEW_REQUIRED';ok(detail(c,facts).nextAction.includes('本人が判断'),'human');});
 test('status: unknown failure not invented',function(){const c=control('HOLD');c.reason='unknown';ok(detail(c,facts).reason.includes('確認できません'),'unknown');});
 test('state: new request discards prior operation timestamps',function(){const f=compile(['sourceEnglishState_'],env({})).sourceEnglishState_,c=control();c.requestedAt=1;c.reservedAt=2;c.responseAt=3;const n=f(ctx,id,snapshot(),c,'REQUEST','QUEUED');eq([n.requestedAt,n.readyAt,n.reservedAt,n.responseAt,n.reviewed],[NOW,NOW+1200,undefined,undefined,false],'fresh');});
 test('state: final record retains known timestamps',function(){const f=compile(['sourceEnglishState_'],env({})).sourceEnglishState_,c=control();c.requestedAt=10;c.reservedAt=20;c.responseAt=30;const n=f(ctx,id,snapshot(),c,'WRITTEN','UPDATED_UNREVIEWED');eq([n.requestedAt,n.reservedAt,n.responseAt,n.waitCode],[10,20,30,undefined],'final');});
 function capture(c,snap){let writes=0,identities=0;const cs=c?{[id]:{value:clone(c)}}:{},index={byRow:c?{2:id}:{},byId:c?{[id]:2}:{}};
   const f=compile(['sourceEnglishCapture_','sourceEnglishState_'],env({sourceEnglishSnapshot_:function(){return clone(snap||snapshot());},sourceEnglishIdentity_:function(){identities++;return id;},sourceEnglishSave_:function(ct,cs,n){writes++;return n;}})).sourceEnglishCapture_;
   return {run:function(o){return f(ctx,cs,index,2,o);},count:function(){return [writes,identities];}};}
 test('edit: unidentified D creates no identity or request',function(){const t=capture();eq(t.run({draftEdit:true,explicit:false,cancel:false}),null,'no request');eq(t.count(),[0,0],'no write');});
 test('edit: changed D invalidates without retranslation',function(){const c=control('WRITTEN');c.inputHash='b'.repeat(64);c.jaHash='c'.repeat(64);eq(capture(c).run({draftEdit:true,explicit:false}).status,'OBSERVE','invalidated');});
 test('capture: explicit valid selection requests',function(){eq(capture().run({explicit:true}).status,'REQUEST','manual');});
 test('capture: invalid selection does not request',function(){const s=snapshot();s.eligible=false;s.manualEligible=false;eq(capture(null,s).run({explicit:true}).status,'HOLD','invalid');});
 test('capture: pending double click does not resubmit',function(){['REQUEST','RESERVED','WRITING'].forEach(function(s){const t=capture(control(s));eq(t.run({explicit:true}).status,s,'same');eq(t.count()[0],0,'no write');});});
 test('capture: completed double click suppressed for five seconds',function(){const c=control('WRITTEN');c.at=NOW-1000;const t=capture(c);eq(t.run({explicit:true}).status,'WRITTEN','same');eq(t.count()[0],0,'no write');});
 test('entry: timer and range drain cannot access services',function(){const f=compile(['retrySourceEnglishQueue','sourceEnglishDrainRanges_'],{});eq(f.retrySourceEnglishQueue({triggerUid:'dummy'}).stoppedReason,'MANUAL_ONLY','timer');eq(f.sourceEnglishDrainRanges_().stoppedReason,'MANUAL_ONLY','drain');});
 test('entry: edit callback only invalidates',function(){let count=0;const f=compile(['handleSourceEnglishEdit'],{notesEnglishBook_:function(){return {getId:function(){return 'book';}};},sourceEnglishDirect_:function(){return true;},sourceEnglishEdited_:function(){count++;}});f.handleSourceEnglishEdit({triggerUid:'dummy',source:{getId:function(){return 'book';}}});eq(count,1,'edit');});
 test('entry: automatic enable cannot change settings',function(){const f=compile(['enableSourceEnglishAutomatic'],{SpreadsheetApp:{getActiveSpreadsheet:function(){return {toast:function(){}};}}});eq(f.enableSourceEnglishAutomatic(),{enabled:false,stoppedReason:'MANUAL_ONLY'},'manual');});
 test('process: non-selection returns without services',function(){const f=compile(['sourceEnglishProcess_'],{}).sourceEnglishProcess_;[false,null,undefined,'all'].forEach(function(v){eq(f(v).stoppedReason,'MANUAL_ONLY','manual');});eq(f([]),{written:0,held:0,pending:0},'empty');});
 test('reserve: non-selection returns without lock or properties',function(){const f=compile(['sourceEnglishReserve_'],{}).sourceEnglishReserve_;[false,null,undefined,[],{}].forEach(function(v){eq(f(v),null,'manual');});});
 function reserve(o){o=o||{};const c=control(o.status),s=snapshot();c.waitCode='BATCH_LIMIT';c.waitObservedAt=NOW-50;if(o.future)c.readyAt=NOW+10;if(o.changed)s.inputHash='b'.repeat(64);
  const cs={[id]:{value:c}},props=new Map([['key','mock-key']]);if(o.flight)props.set('flight','prior');if(o.noKey)props.delete('key');
  const count={budget:0,payload:0,cancel:0,stopped:[]};
  const e=env({notesEnglishLock_:function(f){return f();},sourceEnglishContext_:function(){return ctx;},PropertiesService:{getScriptProperties:function(){return {getProperty:function(k){return props.get(k)||null;},setProperty:function(k,v){props.set(k,v);}};}},
   notesEnglishApiConfig_:function(){return {enabled:false,tested:false};},sourceEnglishControls_:function(){return cs;},sourceEnglishIndex_:function(){return {byId:o.noRow?{}:{[id]:2}};},sourceEnglishSnapshot_:function(){return s;},sourceEnglishRequestable_:function(){return true;},
   sourceEnglishCapture_:function(){count.cancel++;},sourceEnglishSave_:function(){},notesEnglishApiPayload_:function(){count.payload++;return {input:[{}]};},notesEnglishApiEstimate_:function(){if(o.inputLimit)throw new Error('limit');return {micro:10};},
   notesEnglishApiBudget_:function(){return {entries:[],total:o.limit?100:0};},NOTES_ENGLISH_API_MAX_CALLS:10,NOTES_ENGLISH_API_MONTHLY_MICRO:100,notesEnglishApiBudgetSave_:function(){count.budget++;},sourceEnglishStop_:function(ct,cs,c,s,r){count.stopped.push(r);},notesEnglishHash_:function(){return H;}});
  return {run:function(){return compile(['sourceEnglishReserve_'],e).sourceEnglishReserve_([id]);},count:count,c:c,props:props};}
 test('reserve: manual works while automatic OFF',function(){const t=reserve();ok(t.run(),'job');eq([t.count.budget,t.c.reservedAt,t.c.waitCode,t.c.reviewed],[1,NOW,undefined,false],'reserved');});
 test('reserve: global flight prevents budget and payload',function(){const t=reserve({flight:true});eq(t.run(),null,'block');eq([t.count.budget,t.count.payload,t.props.get('flight')],[0,0,'prior'],'preserve');});
 test('reserve: key, readyAt, reserved and writing guards',function(){[{noKey:true},{future:true},{status:'RESERVED'},{status:'WRITING'}].forEach(function(o){const t=reserve(o);eq(t.run(),null,'blocked');eq(t.count.budget,0,'no cost');});});
 test('reserve: edited source cancels before paid reservation',function(){const t=reserve({changed:true});eq(t.run(),null,'changed');eq([t.count.cancel,t.count.budget],[1,0],'safe');});
 test('reserve: missing row removes incompatible wait fields',function(){const t=reserve({noRow:true});t.run();eq([t.c.status,t.c.waitCode,t.c.waitObservedAt],['HOLD',undefined,undefined],'valid');});
 test('reserve: input and monthly limits remain enforced',function(){[{inputLimit:true},{limit:true}].forEach(function(o){const t=reserve(o);t.run();eq(t.count.budget,0,'no cost');eq(t.count.stopped[0],o.limit?'MONTHLY_LIMIT':'INPUT_LIMIT','reason');});});
 function process(o){o=o||{};let now=NOW,calls=0,remembered;const ids=['a','b','c','d'],cs={};ids.forEach(function(k){cs[k]={value:{status:'REQUEST',readyAt:NOW-1}};});if(o.state)cs.a.value.status=o.state;
  const e=env({Date:{now:function(){return now;}},sourceEnglishReserve_:function(selected){eq(selected,ids,'selected only');if(o.block)return null;const k=selected.find(function(k){return cs[k].value.status==='REQUEST';});return k?{id:k}:null;},
   sourceEnglishExecute_:function(j){calls++;cs[j.id].value.status='WRITTEN';if(o.slow)now+=120001;return 'written';},sourceEnglishRememberWait_:function(selected,limit){remembered=limit;if(o.conflict)throw new Error('conflict');},sourceEnglishContext_:function(){return ctx;},sourceEnglishControls_:function(){return cs;},
   PropertiesService:{getScriptProperties:function(){return {getProperty:function(k){return k==='flight'?(o.flight?'active':null):(o.noKey?null:'mock-key');}};}}});
  return {run:function(){return compile(['sourceEnglishProcess_'],e).sourceEnglishProcess_(ids);},calls:function(){return calls;},reason:function(){return remembered;}};}
 test('process: batch limit keeps fourth request',function(){const t=process(),r=t.run();eq([r.written,r.pending,r.pendingReason,t.calls(),t.reason()],[3,1,'BATCH_LIMIT',3,'BATCH_LIMIT'],'batch');});
 test('process: execution time limit keeps remainder',function(){const t=process({slow:true}),r=t.run();eq([r.written,r.pending,r.pendingReason,t.calls()],[1,3,'TIME_LIMIT',1],'time');});
 test('process: live blockers take precedence',function(){[{flight:true,reason:'IN_FLIGHT'},{state:'RESERVED',reason:'RESPONSE_UNCONFIRMED'},{state:'WRITING',reason:'SAVE_UNCONFIRMED'},{noKey:true,reason:'KEY_MISSING'}].forEach(function(o){const t=process(Object.assign({block:true},o));eq(t.run().pendingReason,o.reason,'reason');eq(t.calls(),0,'no execute');});});
 test('process: observation conflict never replays HTTP',function(){const t=process({conflict:true}),r=t.run();eq([r.waitRecordSaved,t.calls(),r.pendingReason],[false,3,'BATCH_LIMIT'],'no replay');});
 test('process: duplicate selection deduplicated',function(){let got;const f=compile(['sourceEnglishProcess_'],env({sourceEnglishReserve_:function(ids){got=ids;return null;},sourceEnglishRememberWait_:function(){},sourceEnglishContext_:function(){return ctx;},sourceEnglishControls_:function(){return {};},PropertiesService:{getScriptProperties:function(){return {};}}}));f.sourceEnglishProcess_(['a','a']);eq(got,['a'],'unique');});
 function remember(o){o=o||{};const c=control(o.state),cs={[id]:{value:c},other:{value:control()}},saved=[];
  const e=env({notesEnglishLock_:function(f){return f();},sourceEnglishContext_:function(){return ctx;},sourceEnglishControls_:function(){return cs;},sourceEnglishIndex_:function(){return {byId:{[id]:2,other:3}};},
   sourceEnglishSnapshot_:function(){const s=snapshot();if(o.changed)s.inputHash='b'.repeat(64);return s;},sourceEnglishSave_:function(ct,cs,n){saved.push(n);},PropertiesService:{getScriptProperties:function(){return {getProperty:function(k){return k==='flight'?(o.flight?'op':null):'mock-key';}};}}});
  compile(['sourceEnglishRememberWait_'],e).sourceEnglishRememberWait_([id],'BATCH_LIMIT');return {saved:saved,other:cs.other.value};}
 test('wait: only selected REQUEST receives bounded observation',function(){const t=remember();eq(t.saved.length,1,'one');eq([t.saved[0].waitCode,t.saved[0].waitObservedAt,t.saved[0].at,t.other.waitCode],['BATCH_LIMIT',NOW,NOW-60000,undefined],'bounded');});
 test('wait: source conflict and unresolved saves are not overwritten',function(){[{changed:true},{state:'WRITING'},{state:'RESERVED'}].forEach(function(o){eq(remember(o).saved.length,0,'skip');});});
 test('wait: global blocker supersedes prior batch limit',function(){eq(remember({flight:true}).saved[0].waitCode,'IN_FLIGHT','priority');});
 test('parser: full revised sources parse',function(){new Function(workflow);new Function(api);});

 test('controls: legacy records remain readable, optional timing and wait fields validated',function(){
   function parse(c){const text=JSON.stringify(c),local={adapter:ctx.adapter,sheet:ctx.sheet,ledger:{getLastRow:function(){return 3;},getRange:function(){return {getDisplayValues:function(){return [[text]];},getFormulas:function(){return [['']];}};}}};
     return compile(['sourceEnglishControls_'],env({notesEnglishJson_:JSON.parse})).sourceEnglishControls_(local);
   }
   ok(parse(control())[id],'legacy');
   const good=control();good.requestedAt=NOW;good.waitCode='BATCH_LIMIT';good.waitObservedAt=NOW;ok(parse(good)[id],'new');
   [{requestedAt:-1},{waitCode:'ARBITRARY',waitObservedAt:NOW},{waitCode:'BATCH_LIMIT'},{status:'HOLD',waitCode:'BATCH_LIMIT',waitObservedAt:NOW}].forEach(function(change){let threw=false;try{parse(Object.assign(control(),change));}catch(_){threw=true;}ok(threw,'reject malformed');});
 });
 test('status menu: read only, safe heading, explicit unknown times, no text in logs',function(){
   let toast='',log='',propertyWrites=0;const c=control(),cs={[id]:{value:c}},snap=snapshot();snap.values[0]='sample mock-key';
   const book={getId:function(){return 'book';},getActiveRange:function(){return {getSheet:function(){return {getSheetId:function(){return 7;}};},getRow:function(){return 2;}};},getSpreadsheetTimeZone:function(){return 'Asia/Tokyo';},toast:function(v){toast=v;}};
   const local={book:book,adapter:ctx.adapter,sheet:{getSheetId:function(){return 7;},getLastRow:function(){return 3;}}};
   const e=env({SpreadsheetApp:{getActiveSpreadsheet:function(){return book;}},PropertiesService:{getScriptProperties:function(){return {getProperty:function(k){return k==='SPREADSHEET_ID'?'book':k==='key'?'mock-key':null;},setProperty:function(){propertyWrites++;throw new Error('forbidden write');},deleteProperty:function(){throw new Error('forbidden delete');}};}},
    sourceEnglishContext_:function(){return local;},sourceEnglishControls_:function(){return cs;},sourceEnglishIndex_:function(){return {byId:{[id]:2},byRow:{2:id}};},sourceEnglishSnapshot_:function(){return snap;},sourceEnglishReviewMessage_:function(){return '';},
    Utilities:{formatDate:function(){return 'test-time';}},console:{log:function(v){log=v;}}});
   const f=compile(['showSourceEnglishStatus','sourceEnglishStatusDetail_','sourceEnglishStatusTime_','sourceEnglishReviewText_'],e),r=f.showSourceEnglishStatus();
   ok(r.displayed&&toast.includes('Notes 2行')&&toast.includes('不明（時刻の記録なし）')&&toast.includes('自動再試行予定なし'),'display');
   ok(!toast.includes('mock-key')&&!log.includes('sample')&&!log.includes('mock-key'),'redaction');eq(propertyWrites,0,'read only');eq(c,control(),'control unchanged');
 });
 test('status menu: wrong active book is rejected before source access',function(){
   const f=compile(['showSourceEnglishStatus'],env({SpreadsheetApp:{getActiveSpreadsheet:function(){return {getId:function(){return 'wrong';}};}},PropertiesService:{getScriptProperties:function(){return {getProperty:function(){return 'book';}};}}}));
   let threw=false;try{f.showSourceEnglishStatus();}catch(e){threw=e.message.includes('一致しません');}ok(threw,'wrong book');
 });
 function execute(o){
   o=o||{};let currentValues=snapshot().values,notes=Array(9).fill(''),formulas=Array(9).fill(''),fetches=0,settlements=0,flushes=0,writeCols=[],logs=0;
   const hash=JSON.stringify,snap=function(){return {values:clone(currentValues),notes:clone(notes),formulas:clone(formulas),eligible:true,manualEligible:true,inputHash:hash([currentValues,notes,formulas]),jaHash:hash(currentValues[3]),fHash:hash(currentValues[5]),sourceHash:hash(currentValues.slice(0,3))};};
   const c=Object.assign(control('RESERVED'),snap(),{reason:'SENDING',operationId:uuid,month:'2027-01',reservedMicro:10,reservedAt:NOW-10,requestedAt:NOW-100});
   delete c.values;delete c.notes;delete c.formulas;delete c.eligible;delete c.manualEligible;
   const job={control:clone(c),operationId:uuid,keyHash:hash('mock-key'),payload:{input:[]},test:false},cs={[id]:{value:clone(c)}},props=new Map([['key','mock-key'],['flight',uuid]]);
   const local={adapter:ctx.adapter,sheet:{getSheetId:function(){return 7;},getRange:function(row,col){return {row:row,col:col};}}};
   const index={byId:{[id]:2},byRow:{2:id}};
   const lock={tryLock:function(){return !o.lockFailure;},releaseLock:function(){}};
   const e=env({notesEnglishHash_:hash,notesEnglishJson_:JSON.parse,sourceEnglishContext_:function(){return local;},sourceEnglishControls_:function(){return cs;},sourceEnglishIndex_:function(){return index;},sourceEnglishSnapshot_:function(){if(o.readbackFailure&&writeCols.includes(6))throw new Error('readback failed');return snap();},
    sourceEnglishRequestable_:function(){return true;},sourceEnglishSave_:function(ct,controls,n){controls[id]={value:clone(n)};return n;},sourceEnglishCapture_:function(){cs[id].value.status='OBSERVE';},
    notesEnglishApiSettle_:function(){settlements++;},sourceEnglishTested_:function(){},LockService:{getScriptLock:function(){return lock;},getDocumentLock:function(){return lock;}},
    PropertiesService:{getScriptProperties:function(){return {getProperty:function(k){return props.get(k)||null;},deleteProperty:function(k){props.delete(k);}};}},
    UrlFetchApp:{fetch:function(){fetches++;if(o.newerEdit)cs[id].value.revision++;if(o.sourceEdit)currentValues[3]='changed by user';return {getResponseCode:function(){return o.httpFailure?500:200;},getContentText:function(){return '{}';}};}},
    notesEnglishApiParse_:function(){return {status:o.advisory?'needs_review':'ok',english:o.empty?'':'new English',reason:'confirm quotation'};},
    notesEnglishWrite_:function(range,values){writeCols.push(range.col);currentValues[range.col-1]=values[0];if(range.col===6&&o.hEdit)currentValues[7]='concurrent user evidence';if(range.col===8)logs++;},
    SpreadsheetApp:{flush:function(){flushes++;}}});
   let result,error;try{result=compile(['sourceEnglishExecute_','sourceEnglishResultLock_','sourceEnglishState_','sourceEnglishLog_','sourceEnglishStop_','sourceEnglishReviewText_'],e).sourceEnglishExecute_(job);}catch(err){error=err.message;}
   return {result:result,error:error,c:cs[id].value,values:currentValues,fetches:fetches,settlements:settlements,writeCols:writeCols,logs:logs,flight:props.get('flight')};
 }
 test('execute: successful F/H write has receipt/reservation/response times and no adoption',function(){const t=execute();eq([t.result,t.fetches,t.settlements,t.c.status,t.c.reviewed,t.flight],['written',1,1,'WRITTEN',false,undefined],'saved');eq([t.c.requestedAt,t.c.reservedAt,t.c.responseAt],[NOW-100,NOW-10,NOW],'times');eq(t.writeCols,[6,8],'only F and H in mocked workflow');eq(t.values[3],'draft','D preserved');eq(t.values[8],'確認待ち','I preserved');});
 test('execute: advisory saves full English and human-review reason',function(){const t=execute({advisory:true});eq([t.result,t.c.reason,t.c.reviewReason,t.values[5]],['written','UPDATED_REVIEW_REQUIRED','confirm quotation','new English'],'advisory');});
 test('execute: new control or edited source discards stale response',function(){[{newerEdit:true},{sourceEdit:true}].forEach(function(o){const t=execute(o);eq([t.result,t.fetches,t.values[5],t.writeCols.length],['held',1,'old en',0],'preserve');});});
 test('execute: concurrent H edit retained after F save',function(){const t=execute({hEdit:true});eq([t.result,t.values[7],t.c.reason,t.writeCols],['written','concurrent user evidence','UPDATED_LOG_UNSAVED',[6]],'H retained');});
 test('execute: empty and failed API leave old F and log reason',function(){[{empty:true},{httpFailure:true}].forEach(function(o){const t=execute(o);eq([t.result,t.values[5],t.fetches,t.c.reason],['held','old en',1,o.empty?'EMPTY_ENGLISH':'API_UNCONFIRMED'],'failure');ok(!t.writeCols.includes(6),'F unchanged');});});
 test('execute: post-response lock failure retains flight and never retries HTTP',function(){const t=execute({lockFailure:true});ok(t.error,'throws');eq([t.fetches,t.writeCols.length,t.flight],[1,0,uuid],'retain');});
 test('execute: failed readback retains WRITING and flight with no retry',function(){const t=execute({readbackFailure:true});ok(t.error,'throws');eq([t.fetches,t.c.status,t.flight,t.writeCols],[1,'WRITING',uuid,[6]],'unknown save');});

 return {passed:passed.length,tests:passed,networkCalls:0,productionWrites:0};
}

if(typeof module!=='undefined')module.exports={runCandidateTests};
if(typeof require!=='undefined'&&require.main===module){
  const fs=require('node:fs'),path=require('node:path');
  const workflow=fs.readFileSync(process.argv[2]||(fs.existsSync(path.join(__dirname,'source_english_workflow.js'))?path.join(__dirname,'source_english_workflow.js'):path.join(__dirname,'../src/source_english_workflow.js')),'utf8');
  const api=fs.readFileSync(process.argv[3]||(fs.existsSync(path.join(__dirname,'source_english_api.js'))?path.join(__dirname,'source_english_api.js'):path.join(__dirname,'../src/source_english_api.js')),'utf8');
  console.log(JSON.stringify(runCandidateTests(workflow,api),null,2));
}
