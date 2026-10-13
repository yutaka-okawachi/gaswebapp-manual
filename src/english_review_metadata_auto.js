/** Temporary EN321-400 metadata support. No triggers, scopes, source/candidate writes. */
const ENGLISH_METADATA_AUTO_PROPERTY='english-metadata-auto-v1';
const ENGLISH_METADATA_AUTO_SCOPE='EN321-400';
const ENGLISH_METADATA_AUTO_LIMITS={duration:90*60000,runs:12,runtime:30*60000,oneRun:270000,interval:5*60000,margin:30000};
function englishMetadataAutoState_(){
  const raw=PropertiesService.getScriptProperties().getProperty(ENGLISH_METADATA_AUTO_PROPERTY);
  if(!raw)return null;
  let s;try{s=JSON.parse(raw);}catch(_){}
  if(s&&s.schema===1&&s.halted===true&&s.status==='ERROR')return s;
  if(!s||s.schema!==1||s.scope!==ENGLISH_METADATA_AUTO_SCOPE||typeof s.jobId!=='string'||!s.jobId||typeof s.triggerUid!=='string'||!s.triggerUid||
    !['WAITING','BUILDING','READY','DONE','STOPPED','LIMIT','ERROR','DAILY_WAIT','PAUSED'].includes(s.status)||
    !Number.isSafeInteger(s.started)||!Number.isSafeInteger(s.expires)||!(s.expires-s.started===ENGLISH_METADATA_AUTO_LIMITS.duration||s.continuation&&s.started===0&&s.expires===0)||
    !Number.isSafeInteger(s.runs)||s.runs<0||s.runs>12||!Number.isSafeInteger(s.usedMs)||s.usedMs<0||
    !Number.isSafeInteger(s.nextRefreshAt)||s.nextRefreshAt<0||!Number.isSafeInteger(s.saveUntil)||s.saveUntil<0||typeof s.lastSnapshotId!=='string'||typeof s.lastRequestId!=='string'||!s.book||!Number.isSafeInteger(s.sheet))throw new Error('自動照合の管理記録が不正です。自動再開しません。');
  if(typeof englishMetadataResumeValidateState_==='function')englishMetadataResumeValidateState_(s);return s;
}
function englishMetadataAutoTerminal_(s){return ['DONE','STOPPED','LIMIT','ERROR','PAUSED'].includes(s.status);}
function englishMetadataAutoCell_(sheet,column){
  const range=sheet.getRange(1,column,1,1),value=range.getDisplayValues()[0][0];
  if(range.getFormulas()[0][0]||range.getNotes()[0][0])throw new Error('自動照合の管理セルに数式・メモがあります。');
  if(value.length>8000)throw new Error('自動照合の管理セルが長すぎます。');
  return value;
}
function englishMetadataAutoCommand_(sheet,s){
  const raw=englishMetadataAutoCell_(sheet,5);let c;try{c=JSON.parse(raw);}catch(_){}
  if(!c||c.schema!==1||c.jobId!==s.jobId||c.scope!==s.scope||!['RUN','WRITE','DONE','STOP'].includes(c.action)||
    typeof c.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.requestId))throw new Error('自動照合の作業ID・制御命令が不正です。');
  if(s.protocol==='demand-v3'&&c.protocol!=='demand-v3')throw new Error('旧writerの制御命令は受け付けません。demand-v3契約を確認してください。');
  if(c.action==='WRITE'&&(!Number.isSafeInteger(c.until)||s.protocol!=='demand-v3'&&c.until>Date.now()+5*60000||c.until>s.saveUntil||c.snapshotId!==s.lastSnapshotId||c.requestId!==s.lastRequestId))throw new Error('保存時間またはsnapshotの指定が不正です。');
  return {raw:raw,value:c};
}
function englishMetadataAutoPublish_(sheet,s,initial,previous){
  const old=englishMetadataAutoCell_(sheet,6);let owned;try{owned=JSON.parse(old);}catch(_){}
  const transferred=!!previous&&s.continuation&&owned&&owned.schema===1&&owned.jobId===s.previousJobId&&owned.scope===s.scope&&old===previous;
  if(initial?!!old:!transferred&&(!owned||owned.schema!==1||owned.jobId!==s.jobId||owned.scope!==s.scope))throw new Error('自動照合の状態欄が別の内容です。上書きしません。');
  const text=JSON.stringify(s);PropertiesService.getScriptProperties().setProperty(ENGLISH_METADATA_AUTO_PROPERTY,text);
  sheet.getRange(1,6,1,1).setRichTextValues([[SpreadsheetApp.newRichTextValue().setText(text).build()]]);SpreadsheetApp.flush();
  if(englishMetadataAutoCell_(sheet,6)!==text)throw new Error('自動照合の状態保存を確認できません。');
}
function englishMetadataAutoManualGuard_(){
  if(typeof englishMetadataNotesManualGuard_==='function')englishMetadataNotesManualGuard_();
  const s=englishMetadataAutoState_();if(s&&!englishMetadataAutoTerminal_(s))throw new Error('一時自動照合が稼働中です。手動の照合出力は重ねず、制御欄とトリガーの状態を確認してください。');
}
function englishMetadataAutoCommandState_(command,s){
  if(command.value.action==='DONE')return 'DONE';
  if(command.value.action==='STOP')return 'STOPPED';
  if(command.value.action==='WRITE'&&command.value.until<=Date.now())throw new Error('クラウドの保存時間が切れました。途中状態を確認してから再開してください。');
  return '';
}
// One explicit recovery is allowed only for an initial timeout with no READY ever issued.
// No counters, original deadline, job ID, snapshots or candidate data are reset.
function englishMetadataAutoRecoverable_(s){
  return s&&s.status==='ERROR'&&!s.halted&&!s.lastSnapshotId&&!s.lastRequestId&&!s.recovery&&s.runs>0&&[
    '照合出力が時間上限に達しました。未完成です。','最終照合前に時間上限へ達しました。未完成です。',
    '最終照合で時間上限に達しました。未完成です。','完成印保存前に時間上限に達しました。未完成です。','自動照合の実行時間上限です。'
  ].includes(s.reason);
}
function englishMetadataAutoDemandRecoverable_(s){
  return !!s&&s.status==='ERROR'&&!s.halted&&!!s.recovery&&!s.demandRecovery&&s.runs===3&&s.usedMs===602087&&!!s.lastSnapshotId&&!!s.lastRequestId&&s.reason==='最終照合で時間上限に達しました。未完成です。';
}
function englishMetadataAutoRecover_(sheet,s,uid){
  const raw=englishMetadataAutoCell_(sheet,5);let c,shown;try{c=JSON.parse(raw);shown=JSON.parse(englishMetadataAutoCell_(sheet,6));}catch(_){return false;}
  const demand=englishMetadataAutoDemandRecoverable_(s);
  if(!(demand||englishMetadataAutoRecoverable_(s))||!c||c.schema!==1||c.scope!==s.scope||c.jobId!==s.jobId||c.action!==(demand?'RECOVER_DEMAND':'RECOVER')||
    c.confirmNoCandidateWrites!==true||typeof c.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.requestId)||c.requestId===s.jobId||
    c.expectedRuns!==s.runs||c.expectedUsedMs!==s.usedMs||c.expectedReason!==s.reason||JSON.stringify(shown)!==JSON.stringify(s)||
    String(uid)!==s.triggerUid||Date.now()>=s.expires||s.runs>=12||s.usedMs+ENGLISH_METADATA_AUTO_LIMITS.oneRun>ENGLISH_METADATA_AUTO_LIMITS.runtime)return false;
  let evidence;
  if(demand){
    if(c.protocol!=='demand-v3'||c.confirmNoMetadataWrites!==true||c.expectedLastSnapshotId!==s.lastSnapshotId||c.expectedLastRequestId!==s.lastRequestId||c.expectedRecoveryRequestId!==s.recovery.requestId||c.requestId===s.lastRequestId||c.requestId===s.recovery.requestId)return false;
    try{evidence=englishMetadataEvidence_(c.evidence,{firstId:321,lastId:400});}catch(_){return false;}
  }
  if(englishMetadataAutoCell_(sheet,5)!==raw)return false;
  const last=sheet.getLastRow(),from=Math.max(3,last-60002),history=sheet.getRange(from,1,last-from+1,3).getDisplayValues(),tail=history[history.length-1];
  const begins=history.filter(function(row){return row[1]==='BEGIN';}),begin=begins[begins.length-1];
  if(!tail||tail[1]!=='ERROR'||tail[2]!=='FAILED'||!begin||begin[0]!==tail[0]||begin[2]!=='BUILDING'||history.some(function(row){return row[0]===tail[0]&&row[1]==='END'&&row[2]==='COMPLETE';}))return false;
  if(demand&&c.expectedFailedSnapshotId!==tail[0])return false;
  if(englishMetadataAutoCell_(sheet,5)!==raw||sheet.getLastRow()!==last)return false;
  const recovery={requestId:c.requestId,previousReason:s.reason,previousRuns:s.runs,previousUsedMs:s.usedMs,failedSnapshotId:tail[0],at:Date.now()};
  if(demand){s.demandRecovery=recovery;s.protocol='demand-v3';s.requests=[s.lastRequestId];s.lastEvidenceDigest='';}else s.recovery=recovery;
  s.status='WAITING';s.saveUntil=0;s.nextRefreshAt=0;s.reason='初回時間超過の明示回復を受付。新しい照合の完了待ち';
  // Persist acceptance first. A partial acknowledgement must never replay the recovery.
  PropertiesService.getScriptProperties().setProperty(ENGLISH_METADATA_AUTO_PROPERTY,JSON.stringify(s));
  const nextCommand={schema:1,scope:s.scope,jobId:s.jobId,action:'RUN',requestId:c.requestId};if(demand){nextCommand.protocol='demand-v3';nextCommand.evidence=evidence;}
  const next=JSON.stringify(nextCommand);
  sheet.getRange(1,5,1,1).setRichTextValues([[SpreadsheetApp.newRichTextValue().setText(next).build()]]);SpreadsheetApp.flush();
  if(englishMetadataAutoCell_(sheet,5)!==next)throw new Error('回復命令の受付読戻しが一致しません。');
  englishMetadataAutoPublish_(sheet,s);return true;
}
// Select this function for ONE time-driven / minutes / every-five-minutes trigger.
// Its first event initializes the bounded job. It cannot be started from the editor.
function refreshEnglishReviewMetadataAutomatically(e){
  if(!e||!e.triggerUid||!/^[a-zA-Z0-9_-]{1,200}$/.test(String(e.triggerUid)))throw new Error('この関数は5分おきの時間主導トリガー1個に設定してください。手動実行は不要です。');
  if(typeof englishRetranslationPoll_==='function')englishRetranslationPoll_(e);
  if(typeof englishDraftSnapshotsDetached_==='function'&&englishDraftSnapshotsDetached_())return {status:'SNAPSHOT_DETACHED'};
  if(typeof englishMetadataNotesRoute_==='function'){const routed=englishMetadataNotesRoute_(e);if(routed)return routed;}
  const lock=LockService.getScriptLock();if(!lock||!lock.tryLock(1))return {status:'BUSY'};
  const invocationStarted=Date.now();
  let s,sheet,documentLock,runStarted=0,charged=false,inactive=false,dailyReservedHour=null,publishState=false;
  try{
    s=englishMetadataAutoState_();
    if(s&&englishMetadataAutoTerminal_(s)){inactive=true;if(!englishMetadataAutoRecoverable_(s)&&!englishMetadataAutoDemandRecoverable_(s)&&!(typeof englishMetadataResumeEligible_==='function'&&englishMetadataResumeEligible_(s)))return {status:s.status};}
    const candidateLock=LockService.getDocumentLock();if(!candidateLock||!candidateLock.tryLock(1))return {status:'BUSY'};documentLock=candidateLock;
    const bookId=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if(!bookId||s&&s.book!==bookId)throw new Error('自動照合の対象ブックが一致しません。');
    const book=SpreadsheetApp.openById(bookId);
    if(!book.getSheetByName(ENGLISH_METADATA_EXPORT_NAME))throw new Error('確認済みの補助タブがありません。自動作成しません。');
    sheet=englishMetadataOwnedSheet_(book);
    if(s&&s.sheet!==sheet.getSheetId())throw new Error('自動照合の補助タブが一致しません。');
    if(inactive){const accepted=s.status==='LIMIT'?englishMetadataResumeLimit_(sheet,s,e.triggerUid):englishMetadataAutoRecover_(sheet,s,e.triggerUid);if(!accepted)return {status:s.status};inactive=false;}
    if(s&&s.continuation)englishMetadataResumeAck_(sheet,s);
    if(!s){
      // E1/F1 are the only new managed cells. Never adopt pre-existing content.
      if(englishMetadataAutoCell_(sheet,5)||englishMetadataAutoCell_(sheet,6))throw new Error('E1/F1に既存内容があります。上書きせず停止しました。');
      const now=Date.now();s={schema:1,jobId:Utilities.getUuid(),scope:ENGLISH_METADATA_AUTO_SCOPE,book:bookId,sheet:sheet.getSheetId(),triggerUid:String(e.triggerUid),status:'WAITING',started:now,expires:now+ENGLISH_METADATA_AUTO_LIMITS.duration,runs:0,usedMs:0,nextRefreshAt:0,lastSnapshotId:'',lastRequestId:'',saveUntil:0,reason:''};
      const command=JSON.stringify({schema:1,jobId:s.jobId,scope:s.scope,action:'RUN',requestId:s.jobId});
      // Persist ownership before cells, so an interrupted initialization cannot restart itself.
      PropertiesService.getScriptProperties().setProperty(ENGLISH_METADATA_AUTO_PROPERTY,JSON.stringify(s));
      sheet.getRange(1,5,1,1).setRichTextValues([[SpreadsheetApp.newRichTextValue().setText(command).build()]]);SpreadsheetApp.flush();
      if(englishMetadataAutoCell_(sheet,5)!==command)throw new Error('開始命令の保存読戻しが一致しません。');
      englishMetadataAutoPublish_(sheet,s,true);
    }
    if(s.triggerUid!==String(e.triggerUid))throw new Error('異なるトリガーが検出されました。作業用は1個だけにしてください。');
    if(s.status==='BUILDING')throw new Error('前回の自動出力が未完了です。自動再開しません。');
    if(s.continuation&&Date.now()>=s.taskExpires){s.status='PAUSED';s.saveUntil=0;s.reason='EN321–400引継ぎ全体の14日上限。未完了として停止';publishState=true;return {status:s.status};}
    const command=englishMetadataAutoCommand_(sheet,s),terminal=englishMetadataAutoCommandState_(command,s);
    if(terminal){
      if(terminal==='DONE'&&s.continuation){if(s.status!=='READY'||command.value.requestId!==s.lastRequestId||command.value.completedThrough!==400||command.value.confirmAll400!==true||!/^[a-f0-9]{64}$/.test(command.value.reconciliationDigest||''))throw new Error('全400IDの保存・読戻し確認がないためDONEにしません。');s.completedThrough=400;s.reconciliationDigest=command.value.reconciliationDigest;}
      s.status=terminal;s.saveUntil=0;s.reason='クラウドの作業ID付き停止合図';publishState=true;englishMetadataAutoPublish_(sheet,s);return {status:s.status};}
    const demand=s.protocol==='demand-v3';
    if(s.started&&Date.now()>=s.expires||!demand&&(s.runs>=12||s.usedMs+ENGLISH_METADATA_AUTO_LIMITS.oneRun>ENGLISH_METADATA_AUTO_LIMITS.runtime)){s.status='LIMIT';s.saveUntil=0;s.reason='90分・12回・累計30分の上限';englishMetadataAutoPublish_(sheet,s);return {status:s.status};}
    if(command.value.action==='WRITE')return {status:'WRITING'};
    let evidence;
    if(demand){
      evidence=englishMetadataEvidence_(command.value.evidence,{firstId:321,lastId:400});
      if(!Array.isArray(s.requests)||s.requests.length>12)throw new Error('要求履歴が不正です。');
      if(s.requests.includes(command.value.requestId)){
        if(command.value.requestId!==s.lastRequestId||englishReviewDigest_(evidence)!==s.lastEvidenceDigest)throw new Error('古い要求または同じ要求IDの計画変更です。');return {status:s.status};
      }
      if(s.runs>=12||s.usedMs+ENGLISH_METADATA_AUTO_LIMITS.oneRun>ENGLISH_METADATA_AUTO_LIMITS.runtime){s.status='LIMIT';s.saveUntil=0;s.reason='12回・累計30分の上限';englishMetadataAutoPublish_(sheet,s);return {status:s.status};}
    }
    if(Date.now()<s.nextRefreshAt)return {status:'WAITING'};
    if(s.started&&Date.now()+ENGLISH_METADATA_AUTO_LIMITS.oneRun>=s.expires){s.status='LIMIT';s.saveUntil=0;s.reason='元のjob期限まで次の照合を安全に完了する余裕がありません';publishState=true;return {status:s.status};}
    if(s.continuation){
      if(Date.now()+ENGLISH_METADATA_AUTO_LIMITS.oneRun>=s.taskExpires){s.status='PAUSED';s.saveUntil=0;s.reason='引継ぎ全体の期限まで次の照合を完了する余裕がありません';publishState=true;return {status:s.status};}
      const budget=englishMetadataNotesBudget_(s),budgetChanged=s.dailyLimitMs!==ENGLISH_NOTES_DAILY_BUDGET;s.dailyUsedMs=budget.used;s.dailyLimitMs=ENGLISH_NOTES_DAILY_BUDGET;
      if(!budget.available){publishState=budgetChanged||s.status!=='DAILY_WAIT'||s.resumeAfter!==budget.resume;s.status='DAILY_WAIT';s.saveUntil=0;s.resumeAfter=budget.resume;s.reason='引継ぎ前を含む直近24時間の予算回復待ち';return {status:s.status,resumeAfter:s.resumeAfter};}
      s.resumeAfter=0;if(!s.started){s.started=Date.now();s.expires=s.started+ENGLISH_METADATA_AUTO_LIMITS.duration;}
      dailyReservedHour=Math.floor(Date.now()/ENGLISH_NOTES_HOUR)*ENGLISH_NOTES_HOUR;englishMetadataNotesCharge_(s,dailyReservedHour,ENGLISH_METADATA_AUTO_LIMITS.oneRun);
    }
    // Reserve one whole run. A hard interruption leaves BUILDING and this charged budget.
    runStarted=invocationStarted;s.status='BUILDING';s.runs++;s.usedMs+=ENGLISH_METADATA_AUTO_LIMITS.oneRun;charged=true;s.saveUntil=0;s.nextRefreshAt=runStarted+ENGLISH_METADATA_AUTO_LIMITS.interval;
    if(demand)s.requests.push(command.value.requestId);
    englishMetadataAutoPublish_(sheet,s);
    function guard(){
      if(Date.now()>=s.expires||s.continuation&&Date.now()>=s.taskExpires||Date.now()-runStarted>ENGLISH_METADATA_AUTO_LIMITS.oneRun||s.usedMs-ENGLISH_METADATA_AUTO_LIMITS.oneRun+Date.now()-runStarted>=ENGLISH_METADATA_AUTO_LIMITS.runtime)throw new Error('自動照合の実行時間上限です。');
      if(englishMetadataAutoCommand_(sheet,s).raw!==command.raw)throw new Error('照合中にクラウドの制御命令が変わりました。');
    }
    const exportOptions={book:book,guard:guard,documentLockHeld:true};
    if(demand)Object.assign(exportOptions,{target:{firstId:321,lastId:400},evidence:evidence,scope:s.scope,controlSchema:1,jobId:s.jobId,requestId:command.value.requestId});
    const result=englishMetadataExport_(exportOptions);guard();
    s.lastSnapshotId=result.snapshotId;s.lastRequestId=command.value.requestId;s.status='READY';
    s.snapshotValidUntil=Date.parse(result.completedAt)+10*60000;
    // Leave a useful saving window even when a verified export takes over two minutes.
    if(!demand)s.nextRefreshAt=Math.max(s.nextRefreshAt,Date.now()+180000);
    s.saveUntil=demand?Math.min(s.snapshotValidUntil-30000,s.expires-30000):Math.min(s.snapshotValidUntil,s.nextRefreshAt-ENGLISH_METADATA_AUTO_LIMITS.margin,s.expires-ENGLISH_METADATA_AUTO_LIMITS.margin);
    if(s.continuation)s.saveUntil=Math.min(s.saveUntil,s.taskExpires-30000);
    if(demand){s.lastEvidenceDigest=result.evidenceDigest;s.timing=result.timing;}
    s.reason=s.saveUntil>Date.now()?'保存前後に最新BEGIN・原文・metadataと制御欄を再照合':'保存時間なし。次のCOMPLETEを待つ';
    return {status:s.status,jobId:s.jobId,snapshotId:s.lastSnapshotId,saveUntil:s.saveUntil};
  }catch(error){
    if(s&&(s.recovery||s.continuation))inactive=false;
    if(s){s.status='ERROR';s.saveUntil=0;s.reason=String(error.message||'自動照合エラー').slice(0,200);if(error.metadataTiming)s.timing=error.metadataTiming;}
    else if(!PropertiesService.getScriptProperties().getProperty(ENGLISH_METADATA_AUTO_PROPERTY))PropertiesService.getScriptProperties().setProperty(ENGLISH_METADATA_AUTO_PROPERTY,JSON.stringify({schema:1,status:'ERROR',halted:true,reason:'初期化できませんでした。既存管理欄を確認してください。'}));
    console.log(JSON.stringify({status:'ERROR',notice:'一時自動照合は停止しました。管理欄と最新BEGIN以降を確認してください。'}));
    return {status:'ERROR'};
  }finally{
    try{
      if(s&&!inactive){
        const elapsed=Math.max(0,Date.now()-invocationStarted);s.usedMs=s.usedMs-(charged?ENGLISH_METADATA_AUTO_LIMITS.oneRun:0)+elapsed;
        if(s.continuation)englishMetadataResumeAccount_(s,elapsed,dailyReservedHour);
        // Persist terminal state even if the status cell is damaged or unavailable.
        PropertiesService.getScriptProperties().setProperty(ENGLISH_METADATA_AUTO_PROPERTY,JSON.stringify(s));
        if(sheet&&(charged||publishState||s.status==='ERROR'||s.status==='LIMIT')){try{englishMetadataAutoPublish_(sheet,s);}catch(_){
          s.status='ERROR';s.saveUntil=0;PropertiesService.getScriptProperties().setProperty(ENGLISH_METADATA_AUTO_PROPERTY,JSON.stringify(s));
          throw new Error('自動照合の状態欄を確認できず停止しました。COMPLETEだけで保存を進めないでください。');
        }}
      }
    }finally{if(documentLock)documentLock.releaseLock();lock.releaseLock();}
  }
}
