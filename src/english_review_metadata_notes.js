/** On-demand Notes EN401-989 jobs, after the unchanged schema-1 job completes. */
const ENGLISH_NOTES_PLAN='english-metadata-notes-plan-v2';
const ENGLISH_NOTES_DAY=24*60*60000,ENGLISH_NOTES_HOUR=60*60000,ENGLISH_NOTES_BUDGET=30*60000;
// Operational trigger budget only, not an account-wide remaining-quota measurement.
const ENGLISH_NOTES_DAILY_BUDGET=60*60000;
// Reserve a complete 270-second check plus 30 seconds for status persistence.
const ENGLISH_NOTES_START_RESERVE_MS=300000;
function englishMetadataNotesTarget_(t){return !!t&&Number.isSafeInteger(t.firstId)&&Number.isSafeInteger(t.lastId)&&t.firstId>=401&&t.lastId<=989&&t.lastId>=t.firstId&&t.lastId-t.firstId<80;}
function englishMetadataNotesLoad_(){
  const raw=PropertiesService.getScriptProperties().getProperty(ENGLISH_NOTES_PLAN);if(!raw)return null;let p;try{p=JSON.parse(raw);}catch(_){}
  if(!p||p.schema!==2||p.scope!=='Notes'||!p.book||!Number.isSafeInteger(p.sheet)||!p.triggerUid||!p.legacyJobId||
    !['ACTIVE','FINISHED','STOPPED','PAUSED','ERROR'].includes(p.status)||!Number.isSafeInteger(p.started)||p.expires-p.started!==14*ENGLISH_NOTES_DAY||
    !Number.isSafeInteger(p.completedThrough)||p.completedThrough<400||p.completedThrough>989||!Array.isArray(p.buckets)||p.buckets.length>26||
    p.buckets.some(function(b){return !Number.isSafeInteger(b.hour)||b.hour%ENGLISH_NOTES_HOUR!==0||!Number.isSafeInteger(b.ms)||b.ms<0;}))throw new Error('Notes継続の管理記録が不正です。');
  const j=p.job;if(j&&(!j.jobId||!englishMetadataNotesTarget_(j.target)||!['WAITING','READY','BUILDING','DONE','LIMIT','DAILY_WAIT','ERROR'].includes(j.status)||
    !Number.isSafeInteger(j.runs)||j.runs<0||j.runs>12||!Number.isSafeInteger(j.usedMs)||j.usedMs<0||!Number.isSafeInteger(j.started)||
    (j.started?j.expires-j.started!==90*60000:j.expires!==0)||!Array.isArray(j.requests)||j.requests.length>12||new Set(j.requests).size!==j.requests.length))throw new Error('Notes継続jobの管理記録が不正です。');
  return p;
}
function englishMetadataNotesPut_(p){const text=JSON.stringify(p);if(text.length>8000)throw new Error('Notes継続の管理記録が上限です。');PropertiesService.getScriptProperties().setProperty(ENGLISH_NOTES_PLAN,text);}
function englishMetadataNotesPrune_(p){p.buckets=p.buckets.filter(function(b){return b.hour+ENGLISH_NOTES_HOUR+ENGLISH_NOTES_DAY>Date.now();});}
function englishMetadataNotesCharge_(p,hour,ms){let b=p.buckets.find(function(x){return x.hour===hour;});if(!b){b={hour:hour,ms:0};p.buckets.push(b);}b.ms+=ms;if(b.ms<0)throw new Error('実行予算の予約が不一致です。');}
function englishMetadataNotesBudget_(p){
  englishMetadataNotesPrune_(p);let used=p.buckets.reduce(function(n,b){return n+b.ms;},0),remaining=used,resume=Date.now();
  for(const b of p.buckets.slice().sort(function(a,b){return a.hour-b.hour;})){if(remaining+ENGLISH_METADATA_EXPORT_RUN_MS<=ENGLISH_NOTES_DAILY_BUDGET)break;remaining-=b.ms;resume=b.hour+ENGLISH_NOTES_HOUR+ENGLISH_NOTES_DAY;}
  return {used:used,resume:resume,available:used+ENGLISH_METADATA_EXPORT_RUN_MS<=ENGLISH_NOTES_DAILY_BUDGET};
}
function englishMetadataNotesState_(p){
  const j=p.job,budget=englishMetadataNotesBudget_(p);
  const state={schema:2,scope:'Notes',protocol:p.protocol||'notes-v2',taskStatus:p.status,status:p.status==='ACTIVE'?(j?j.status:'WAITING_JOB'):p.status,
    jobId:j?j.jobId:p.legacyJobId,previousJobId:j?j.previousJobId:'',target:j?j.target:null,completedThrough:p.completedThrough,
    taskExpires:p.expires,expires:j?j.expires:0,runs:j?j.runs:0,usedMs:j?j.usedMs:0,dailyUsedMs:budget.used,dailyLimitMs:ENGLISH_NOTES_DAILY_BUDGET,resumeAfter:p.resumeAfter||0,
    lastSnapshotId:j?j.lastSnapshotId:'',lastRequestId:j?j.lastRequestId:'',lastEvidenceDigest:j?j.lastEvidenceDigest||'':'',timing:j?j.timing||null:null,saveUntil:j?j.saveUntil:0,reason:p.reason||''};
  if(j&&j.deadlineStop)state.deadlineStop=j.deadlineStop;return state;
}
function englishMetadataNotesArchive_(p,kind){
  const key='english-metadata-notes-'+kind+'-'+p.job.jobId,props=PropertiesService.getScriptProperties(),text=JSON.stringify(p),old=props.getProperty(key);
  if(old&&old!==text)throw new Error('旧jobの保全記録が不一致です。上書きしません。');
  if(!old)props.setProperty(key,text);if(props.getProperty(key)!==text)throw new Error('旧jobの保全読戻しが不一致です。');return key;
}
function englishMetadataNotesPublish_(sheet,p){
  let old;try{old=JSON.parse(englishMetadataAutoCell_(sheet,6));}catch(_){}
  const allowed=old&&(old.schema===1&&old.scope==='EN321-400'&&old.jobId===p.legacyJobId||old.schema===2&&old.scope==='Notes'&&[p.publishedId,p.job&&p.job.jobId,p.legacyJobId].includes(old.jobId));
  if(!allowed)throw new Error('Notes継続の状態欄が別の内容です。上書きしません。');
  p.dailyLimitMs=ENGLISH_NOTES_DAILY_BUDGET;
  const state=englishMetadataNotesState_(p),text=JSON.stringify(state);englishMetadataNotesPut_(p);
  sheet.getRange(1,6,1,1).setRichTextValues([[SpreadsheetApp.newRichTextValue().setText(text).build()]]);SpreadsheetApp.flush();
  if(englishMetadataAutoCell_(sheet,6)!==text)throw new Error('Notes継続の状態保存を確認できません。');p.publishedId=state.jobId;englishMetadataNotesPut_(p);
}
function englishMetadataNotesCommand_(sheet){
  const raw=englishMetadataAutoCell_(sheet,5);let c;try{c=JSON.parse(raw);}catch(_){}
  if(!c||c.schema!==2||c.scope!=='Notes'||!['RUN','WRITE','DONE','STOP'].includes(c.action)||typeof c.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.requestId))throw new Error('Notes継続の命令が不正です。');
  return {raw:raw,value:c};
}
function englishMetadataNotesManualGuard_(){const p=englishMetadataNotesLoad_();if(p&&p.status==='ACTIVE')throw new Error('Notes継続が稼働中です。手動exportは重ねません。');}
function englishMetadataNotesAck_(sheet,p,command){
  if(englishMetadataAutoCell_(sheet,5)!==command.raw)throw new Error('job開始中に命令が変わりました。');
  const c={schema:2,scope:'Notes',action:'RUN',jobId:p.job.jobId,requestId:command.value.requestId};
  if(p.protocol==='demand-v3'){c.protocol='demand-v3';c.evidence=englishMetadataEvidence_(command.value.evidence,p.job.target);}
  const raw=JSON.stringify(c);sheet.getRange(1,5,1,1).setRichTextValues([[SpreadsheetApp.newRichTextValue().setText(raw).build()]]);SpreadsheetApp.flush();
  if(englishMetadataAutoCell_(sheet,5)!==raw)throw new Error('job開始命令の読戻しが一致しません。');return {raw:raw,value:c};
}
function englishMetadataNotesBegin_(sheet,p,command){
  const c=command.value,old=p.job,hash=englishReviewDigest_(command.raw);
  if(c.action!=='RUN'||!englishMetadataNotesTarget_(c.target)||typeof c.previousJobId!=='string')throw new Error('後続jobの対象・前jobが不正です。');
  if(old&&old.startHash===hash)return englishMetadataNotesAck_(sheet,p,command);
  if(c.previousJobId!==(old?old.jobId:p.legacyJobId))throw new Error('前jobが一致しません。古い開始要求は使えません。');
  if(old&&old.status!=='DONE'&&old.status!=='LIMIT')throw new Error('未完了・異常jobの対象を差し替えません。');
  if(old&&old.status==='LIMIT'){
    if(c.target.firstId!==old.target.firstId||c.target.lastId!==old.target.lastId)throw new Error('途中の組は同じ対象範囲で再照合してください。');
    englishMetadataNotesArchive_(p,'limit');
  }else if(c.target.firstId!==p.completedThrough+1)throw new Error('対象IDに飛び越し・重複があります。');
  p.job={jobId:Utilities.getUuid(),previousJobId:c.previousJobId,target:{firstId:c.target.firstId,lastId:c.target.lastId},status:'WAITING',started:0,expires:0,runs:0,usedMs:0,requests:[],startHash:hash,lastSnapshotId:'',lastRequestId:'',saveUntil:0,nextAllowedAt:0};
  p.resumeAfter=0;p.reason='新しいRUN要求の照合待ち';englishMetadataNotesPut_(p);
  command=englishMetadataNotesAck_(sheet,p,command);englishMetadataNotesPublish_(sheet,p);return command;
}
// Returns null only while the original schema-1 job remains in charge.
function englishMetadataNotesRoute_(e){
  let p=englishMetadataNotesLoad_(),legacy=englishMetadataAutoState_();if(!p&&(!legacy||legacy.status!=='DONE'))return null;
  if(p&&p.status!=='ACTIVE'){
    if(p.status==='ERROR'&&p.reason==='照合時間または作業期限の上限です。'&&typeof englishMetadataNotesDeadlineRoute_==='function')return englishMetadataNotesDeadlineRoute_(e);
    return p.status==='ERROR'&&typeof englishMetadataNotesRecoverRoute_==='function'?englishMetadataNotesRecoverRoute_(e):{status:p.status};
  }
  const lock=LockService.getScriptLock();if(!lock||!lock.tryLock(1))return {status:'BUSY'};
  const began=Date.now();let doc,sheet,reservedHour=null,charged=false,publish=false,deadlineFailure=null,deadlineKind='';
  try{
    p=englishMetadataNotesLoad_();legacy=englishMetadataAutoState_();
    if(!p){
      if(!legacy||legacy.status!=='DONE')return {status:'WAITING'};
      p={schema:2,scope:'Notes',status:'ACTIVE',book:legacy.book,sheet:legacy.sheet,triggerUid:legacy.triggerUid,legacyJobId:legacy.jobId,publishedId:legacy.jobId,
        started:began,expires:began+14*ENGLISH_NOTES_DAY,completedThrough:400,job:null,buckets:[],resumeAfter:0,reason:'',protocol:legacy.protocol==='demand-v3'?'demand-v3':'notes-v2'};
      if(legacy.continuation){p.buckets=legacy.buckets.map(function(b){return {hour:b.hour,ms:b.ms};});englishMetadataNotesPrune_(p);}
      else englishMetadataNotesCharge_(p,Math.floor(began/ENGLISH_NOTES_HOUR)*ENGLISH_NOTES_HOUR,legacy.usedMs);englishMetadataNotesPut_(p);
    }
    if(p.triggerUid!==String(e.triggerUid))throw new Error('異なるトリガーです。同じ1個を使ってください。');
    if(p.status!=='ACTIVE')return {status:p.status};
    const candidate=LockService.getDocumentLock();if(!candidate||!candidate.tryLock(1))return {status:'BUSY'};doc=candidate;
    if(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')!==p.book)throw new Error('対象ブックが一致しません。');
    const book=SpreadsheetApp.openById(p.book);sheet=englishMetadataOwnedSheet_(book);if(sheet.getSheetId()!==p.sheet)throw new Error('補助タブが一致しません。');
    if(Date.now()>=p.expires){p.status='PAUSED';p.reason='14日の期間上限。全件完了ではありません。要確認。';if(p.job)p.job.saveUntil=0;publish=true;return {status:p.status};}
    // The legacy DONE command is left intact until the cloud supplies a schema-2 RUN.
    const raw=englishMetadataAutoCell_(sheet,5);let peek;try{peek=JSON.parse(raw);}catch(_){}
    if(!p.job&&peek&&peek.schema===1&&peek.action==='DONE'&&peek.jobId===p.legacyJobId)return {status:'WAITING_JOB'};
    let command=englishMetadataNotesCommand_(sheet),c=command.value;
    if(p.protocol==='demand-v3'&&c.protocol!=='demand-v3')throw new Error('旧writerの命令は受け付けません。demand-v3契約を確認してください。');
    if(!c.jobId){command=englishMetadataNotesBegin_(sheet,p,command);c=command.value;}
    let j=p.job;if(!j||c.jobId!==j.jobId)throw new Error('Notes jobIdが一致しません。');
    if(c.action==='STOP'){p.status='STOPPED';p.reason='クラウドから停止要求';j.saveUntil=0;publish=true;return {status:p.status};}
    if(j.status==='BUILDING')throw new Error('前回の出力が未完了です。再実行せず要確認。');
    if(j.status==='ERROR')throw new Error('異常jobは自動再開しません。');
    if(j.status==='DONE'||j.status==='LIMIT')return {status:j.status};
    if(c.action==='DONE'){
      if(j.status!=='READY'||!j.lastSnapshotId)throw new Error('確認可能なsnapshotがないjobは完了にできません。');
      p.completedThrough=j.target.lastId;j.status='DONE';j.saveUntil=0;p.reason='クラウドがこの組の保存・読戻し完了を宣言';
      if(p.completedThrough===989){p.status='FINISHED';p.reason='クラウドがNotes EN401-989の全組完了を宣言';}publish=true;return {status:p.status==='ACTIVE'?'DONE':p.status};
    }
    if(j.started&&Date.now()>=j.expires){j.status='LIMIT';j.saveUntil=0;p.reason='jobの90分上限。途中状態を照合して同じ範囲を新jobで要求';publish=true;return {status:j.status};}
    if(c.action==='WRITE'){
      if(j.status!=='READY'||c.requestId!==j.lastRequestId||c.snapshotId!==j.lastSnapshotId||!Number.isSafeInteger(c.until)||c.until<=Date.now()||c.until>j.saveUntil)throw new Error('WRITEのsnapshot・要求ID・期限が不正です。');
      return {status:'WRITING'};
    }
    const evidence=p.protocol==='demand-v3'?englishMetadataEvidence_(c.evidence,j.target):null;
    // Completed requests are consumed once, including after their snapshot TTL expires.
    if(j.requests.includes(c.requestId)){
      if(c.requestId!==j.lastRequestId||evidence&&englishReviewDigest_(evidence)!==j.lastEvidenceDigest)throw new Error('古いRUN要求または同じ要求IDの計画変更です。');return {status:j.status};
    }
    if(j.runs>=12||j.usedMs+ENGLISH_METADATA_EXPORT_RUN_MS>ENGLISH_NOTES_BUDGET){j.status='LIMIT';j.saveUntil=0;p.reason='jobの12回・累計30分上限。途中状態を照合して同じ範囲を新jobで要求';publish=true;return {status:j.status};}
    // Read STOP and ownership even during a daily wait; only snapshot work is deferred.
    if(Date.now()<j.nextAllowedAt)return {status:'WAITING'};
    const budget=englishMetadataNotesBudget_(p);
    if(!budget.available){publish=j.status!=='DAILY_WAIT'||j.saveUntil!==0||p.resumeAfter!==budget.resume||p.dailyLimitMs!==ENGLISH_NOTES_DAILY_BUDGET;j.status='DAILY_WAIT';j.saveUntil=0;p.resumeAfter=budget.resume;p.reason='ローリング24時間予算の回復待ち。旧WRITEは無効';return {status:j.status,resumeAfter:p.resumeAfter};}
    // Check immediately before charging/starting. Recovery acceptance on a previous
    // event does not reserve enough time for this event's full snapshot.
    if(Date.now()+ENGLISH_NOTES_START_RESERVE_MS>=p.expires){p.status='PAUSED';j.saveUntil=0;p.reason='全体期限まで照合と終了保存の時間が不足しています。';publish=true;return {status:p.status};}
    if(j.started&&Date.now()+ENGLISH_NOTES_START_RESERVE_MS>=j.expires){j.status='LIMIT';j.saveUntil=0;j.deadlineStop={kind:'JOB_START_RESERVE',at:Date.now(),expires:j.expires};p.reason='job期限まで照合270秒と終了保存30秒の余裕がありません。同じ範囲の新jobを要求してください。';publish=true;return {status:j.status};}
    p.resumeAfter=0;if(!j.started){j.started=Date.now();j.expires=j.started+90*60000;}
    reservedHour=Math.floor(Date.now()/ENGLISH_NOTES_HOUR)*ENGLISH_NOTES_HOUR;englishMetadataNotesCharge_(p,reservedHour,ENGLISH_METADATA_EXPORT_RUN_MS);charged=true;
    j.usedMs+=ENGLISH_METADATA_EXPORT_RUN_MS;j.runs++;j.requests.push(c.requestId);j.status='BUILDING';j.saveUntil=0;j.nextAllowedAt=Date.now()+5*60000;p.reason='要求されたsnapshotを作成中';englishMetadataNotesPublish_(sheet,p);
    function guard(){
      // A control conflict must never be relabelled as a time limit.
      if(englishMetadataAutoCell_(sheet,5)!==command.raw)throw new Error('出力中に制御命令が変わりました。');
      const now=Date.now();deadlineKind=now>=p.expires?'TASK_EXPIRED':now>=j.expires?'JOB_EXPIRED':'';
      if(deadlineKind){deadlineFailure=new Error(deadlineKind==='TASK_EXPIRED'?'全体期限に到達しました。':'job期限に到達しました。');throw deadlineFailure;}
      if(now-began>ENGLISH_METADATA_EXPORT_RUN_MS)throw new Error('照合処理が1回の時間上限に達しました。未完成です。');
    }
    const result=englishMetadataExport_({book:book,guard:guard,documentLockHeld:true,target:j.target,jobId:j.jobId,requestId:c.requestId,evidence:evidence,scope:'Notes',controlSchema:2});guard();
    if(evidence){j.lastEvidenceDigest=result.evidenceDigest;j.timing=result.timing;}
    j.status='READY';j.lastSnapshotId=result.snapshotId;j.lastRequestId=c.requestId;j.saveUntil=Math.min(Date.parse(result.completedAt)+10*60000-30000,j.expires-30000,p.expires-30000);
    p.reason='新RUN要求がなければ再出力しません。保存期限と最新BEGINを確認';publish=true;return {status:j.status,jobId:j.jobId,snapshotId:j.lastSnapshotId};
  }catch(error){
    if(p&&p.job&&deadlineFailure&&error===deadlineFailure){
      p.status=deadlineKind==='TASK_EXPIRED'?'PAUSED':'ACTIVE';p.job.status='LIMIT';p.job.saveUntil=0;
      p.job.deadlineStop={kind:deadlineKind,at:Date.now(),expires:deadlineKind==='TASK_EXPIRED'?p.expires:p.job.expires};
      if(error.metadataTiming)p.job.timing=error.metadataTiming;
      p.reason=deadlineKind==='TASK_EXPIRED'?'全体期限到達。未完成のまま停止しました。':'job期限到達。未完成の控えを保持し、同じ範囲の新jobを要求してください。';publish=true;return {status:p.status==='ACTIVE'?'LIMIT':p.status};
    }
    if(p){p.status='ERROR';p.reason=String(error&&error.message||'Notes継続エラー').slice(0,200);if(p.job){p.job.status='ERROR';p.job.saveUntil=0;if(error&&error.metadataTiming)p.job.timing=error.metadataTiming;}englishMetadataNotesPut_(p);publish=true;}
    return {status:'ERROR'};
  }finally{
    try{
      if(p&&(p.status==='ACTIVE'||charged||publish)){
        const elapsed=Math.max(0,Date.now()-began);
        if(charged){englishMetadataNotesCharge_(p,reservedHour,-ENGLISH_METADATA_EXPORT_RUN_MS);p.job.usedMs=p.job.usedMs-ENGLISH_METADATA_EXPORT_RUN_MS+elapsed;}
        if(elapsed)englishMetadataNotesCharge_(p,Math.floor(Date.now()/ENGLISH_NOTES_HOUR)*ENGLISH_NOTES_HOUR,elapsed);
        englishMetadataNotesPrune_(p);englishMetadataNotesPut_(p);
        if(sheet&&publish){try{englishMetadataNotesPublish_(sheet,p);}catch(_){p.status='ERROR';if(p.job){p.job.status='ERROR';p.job.saveUntil=0;}englishMetadataNotesPut_(p);throw new Error('Notes状態の保存失敗。COMPLETEだけで保存を進めないでください。');}}
      }
    }finally{if(doc)doc.releaseLock();lock.releaseLock();}
  }
}
