'use strict';
// Review regression fixtures. No network or production writes.
function runReviewRegressions(processSource,messageSource,detailSource){
  const passed=[],now=1800000000000;
  function equal(a,b,message){if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(message+': '+JSON.stringify(a));}
  function test(name,fn){fn();passed.push(name);}
  function run(options){
    options=options||{};let sent=false,calls=0,slept=0;
    const controls={a:{value:{status:options.initial||'REQUEST',readyAt:now-1}}};
    if(options.missing)delete controls.a;
    const env={Utilities:{sleep:function(){slept++;}},Date:{now:function(){return now;}},
      sourceEnglishReserve_:function(){if(sent||options.block)return null;sent=true;return {control:{id:'a'}};},
      sourceEnglishExecute_:function(){calls++;if(options.throws)throw new Error('uncertain save');if(options.finalMissing)delete controls.a;else controls.a.value.status=options.final||'OBSERVE';return options.outcome===undefined?'held':options.outcome;},
      sourceEnglishRememberWait_:function(){if(options.observationError)throw new Error('control conflict');},
      sourceEnglishContext_:function(){return {};},sourceEnglishControls_:function(){return controls;},
      PropertiesService:{getScriptProperties:function(){return {getProperty:function(k){return k==='flight'?(options.flight?'operation':null):(options.noKey?null:'mock-key');}};}},
      NOTES_ENGLISH_API_FLIGHT:'flight',NOTES_ENGLISH_API_KEY:'key'};
    const fn=Function.apply(null,Object.keys(env).concat(['return ('+processSource+');'])).apply(null,Object.values(env));
    return {run:function(input){return fn(arguments.length?input:['a']);},counts:function(){return {calls:calls,slept:slept};}};
  }
  test('discarded response with OBSERVE still requires attention',function(){equal(run().run().held,1,'held');});
  test('missing selected control is not all-zero success',function(){equal(run({block:true,missing:true}).run().held,1,'missing');});
  test('explicit row invalidated before reservation is counted',function(){equal(run({block:true,initial:'OBSERVE'}).run().held,1,'invalidated');});
  test('held outcome survives a concurrently completed newer control',function(){equal(run({final:'WRITTEN'}).run().held,1,'discard retained');});
  test('same failed row and HOLD count only once',function(){equal(run({final:'HOLD'}).run().held,1,'deduplicated');});
  test('a newer pending request retains both wait and prior failure',function(){const r=run({final:'REQUEST',flight:true}).run();equal([r.held,r.pending,r.pendingReason],[1,1,'IN_FLIGHT'],'both');});
  test('successful write stays successful',function(){const r=run({final:'WRITTEN',outcome:'written'}).run();equal([r.written,r.held,r.pending],[1,0,0],'success');});
  test('unknown worker return is rejected, never counted as success',function(){let threw=false;try{run({outcome:'unknown'}).run();}catch(_){threw=true;}equal(threw,true,'rejected');});
  test('worker exception propagates without resubmitting',function(){const t=run({throws:true});let threw=false;try{t.run();}catch(_){threw=true;}equal([threw,t.counts().calls],[true,1],'no retry');});
  test('wait record failure remains explicit',function(){const r=run({block:true,observationError:true}).run();equal([r.pending,r.waitRecordSaved],[1,false],'observation failure');});
  test('non-selection guard still does no work',function(){const t=run();equal(t.run(false).stoppedReason,'MANUAL_ONLY','guard');equal(t.counts(),{calls:0,slept:0},'no service work');});

  test('WRITING overrides flight with save-specific reason',function(){equal(run({block:true,initial:'WRITING',flight:true}).run().pendingReason,'SAVE_UNCONFIRMED','save');});
  test('RESERVED overrides flight with response-specific reason',function(){equal(run({block:true,initial:'RESERVED',flight:true}).run().pendingReason,'RESPONSE_UNCONFIRMED','response');});
  const message=Function('return ('+messageSource+');')();
  test('manual result surfaces wait-record failure',function(){const value=message({written:0,held:0,pending:1,pendingReason:'QUEUED',waitRecordSaved:false});equal(value.includes('待ち理由の保存を確認できません'),true,'visible failure');});
  test('manual result explains discarded response requiring attention',function(){equal(message({written:0,held:1,pending:0}).includes('入力変更による応答破棄'),true,'attention visible');});
  test('manual result differentiates reserved from save unknown',function(){equal(message({written:0,held:0,pending:1,pendingReason:'RESPONSE_UNCONFIRMED'}).includes('応答を確認できません'),true,'response');equal(message({written:0,held:0,pending:1,pendingReason:'SAVE_UNCONFIRMED'}).includes('保存完了を確認できません'),true,'save');});
  test('no false observation warning after all work completes',function(){equal(message({written:1,held:0,pending:0,waitRecordSaved:false}).includes('待ち理由の保存を確認できません'),false,'not needed');});

  const detail=Function('return ('+detailSource+');')();
  test('changed input with unresolved flight does not instruct resending',function(){const d=detail({status:'REQUEST'},{inputChanged:true,inFlight:true,now:now});equal(d.phase,'入力変更あり','changed');equal(d.nextAction.includes('再送せず'),true,'no resend');equal(d.reason.includes('結果未確定'),true,'reason');});
  test('changed input without flight still allows explicit manual request',function(){const d=detail({status:'REQUEST'},{inputChanged:true,inFlight:false,now:now});equal(d.nextAction.includes('対象行を選んで再生成'),true,'manual');});
  test('WRITING remains save-unknown even with changed F',function(){const d=detail({status:'WRITING'},{inputChanged:true,inFlight:true,now:now});equal(d.phase,'応答確認済み・保存完了未確認','stage');equal(d.nextAction.includes('再送せず'),true,'no resend');});

  test('BASE is not silently counted as complete',function(){equal(run({block:true,initial:'BASE'}).run().held,1,'BASE');});
  test('save-unknown overrides an unrelated flight and missing key',function(){equal(run({block:true,initial:'WRITING',flight:true,noKey:true}).run().pendingReason,'SAVE_UNCONFIRMED','save first');});
  return {passed:passed.length,tests:passed,networkCalls:0,productionWrites:0};
}

function extractReviewFunction(source,name){
  const start=source.indexOf('function '+name+'(');
  if(start<0)throw new Error('Missing function: '+name);
  const next=/\nfunction [A-Za-z0-9_]+\(/.exec(source.slice(start));
  return source.slice(start,next?start+next.index:source.length);
}
if(typeof module!=='undefined')module.exports={runReviewRegressions};
if(typeof require!=='undefined'&&require.main===module){
  const fs=require('node:fs'),path=require('node:path');
  const workflow=fs.readFileSync(process.argv[2]||(fs.existsSync(path.join(__dirname,'source_english_workflow.js'))?path.join(__dirname,'source_english_workflow.js'):path.join(__dirname,'../src/source_english_workflow.js')),'utf8');
  const api=fs.readFileSync(process.argv[3]||(fs.existsSync(path.join(__dirname,'source_english_api.js'))?path.join(__dirname,'source_english_api.js'):path.join(__dirname,'../src/source_english_api.js')),'utf8');
  new Function(workflow);new Function(api);
  console.log(JSON.stringify(runReviewRegressions(
    extractReviewFunction(api,'sourceEnglishProcess_'),
    extractReviewFunction(workflow,'sourceEnglishProcessMessage_'),
    extractReviewFunction(workflow,'sourceEnglishStatusDetail_')),null,2));
}
