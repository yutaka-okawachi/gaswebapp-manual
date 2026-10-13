/** Explicit finite successors for a LIMIT in the same EN321-400 scope only. */
const ENGLISH_METADATA_ARCHIVE_PREFIX='english-metadata-limit-archive-v1-';
function englishMetadataResumeEligible_(s){return !!s&&s.schema===1&&s.scope==='EN321-400'&&s.protocol==='demand-v3'&&s.status==='LIMIT'&&!s.halted&&(!s.taskExpires||Date.now()<s.taskExpires);}
function englishMetadataResumeValidateState_(s){
  if(!s.continuation)return;
  if(s.protocol!=='demand-v3'||typeof s.previousJobId!=='string'||!s.previousJobId||!s.rootJobId||!Number.isSafeInteger(s.sequence)||s.sequence<1||
    !Number.isSafeInteger(s.taskExpires)||!Number.isSafeInteger(s.carriedUsedMs)||s.carriedUsedMs<0||!Number.isSafeInteger(s.carriedRuns)||s.carriedRuns<0||
    !Number.isSafeInteger(s.completedThrough)||s.completedThrough<320||s.completedThrough>400||!Array.isArray(s.buckets)||s.buckets.length>26||
    s.buckets.some(function(b){return !Number.isSafeInteger(b.hour)||b.hour%ENGLISH_NOTES_HOUR!==0||!Number.isSafeInteger(b.ms)||b.ms<0;})||
    !/^[a-f0-9]{64}$/.test(s.resumeCommandHash||'')||!/^[a-f0-9]{64}$/.test(s.reconciliationDigest||''))throw new Error('LIMIT引継ぎの管理記録が不正です。');
}
function englishMetadataResumeAck_(sheet,s){
  if(!s.continuation)return false;
  const raw=englishMetadataAutoCell_(sheet,5);let c;try{c=JSON.parse(raw);}catch(_){return false;}
  if(!c||c.action!=='RESUME_LIMIT')return false;
  if(englishReviewDigest_(raw)!==s.resumeCommandHash||c.previousJobId!==s.previousJobId)throw new Error('古いLIMIT引継ぎ要求または変更された要求です。');
  const evidence=englishMetadataEvidence_(c.evidence,{firstId:321,lastId:400});
  const archived=PropertiesService.getScriptProperties().getProperty(ENGLISH_METADATA_ARCHIVE_PREFIX+s.previousJobId);
  if(!archived)throw new Error('前jobの保存控えがありません。');
  englishMetadataAutoPublish_(sheet,s,false,archived);
  if(englishMetadataAutoCell_(sheet,5)!==raw)throw new Error('LIMIT引継ぎ受付中に命令が変わりました。');
  const next=JSON.stringify({schema:1,scope:s.scope,protocol:'demand-v3',jobId:s.jobId,action:'RUN',requestId:c.requestId,evidence:evidence});
  sheet.getRange(1,5,1,1).setRichTextValues([[SpreadsheetApp.newRichTextValue().setText(next).build()]]);SpreadsheetApp.flush();
  if(englishMetadataAutoCell_(sheet,5)!==next)throw new Error('LIMIT引継ぎ命令の読戻しが一致しません。');return true;
}
// Called with both locks held. Invalid requests leave the terminal job unchanged.
function englishMetadataResumeLimit_(sheet,s,uid){
  if(!englishMetadataResumeEligible_(s))return false;
  const raw=englishMetadataAutoCell_(sheet,5);let c;try{c=JSON.parse(raw);}catch(_){return false;}
  const oldText=JSON.stringify(s);
  if(!c||c.schema!==1||c.scope!==s.scope||c.protocol!=='demand-v3'||c.action!=='RESUME_LIMIT'||c.jobId||c.previousJobId!==s.jobId||
    typeof c.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.requestId)||c.requestId===s.lastRequestId||(s.requests||[]).includes(c.requestId)||
    c.expectedRuns!==s.runs||c.expectedUsedMs!==s.usedMs||c.expectedExpires!==s.expires||c.expectedLastSnapshotId!==s.lastSnapshotId||
    c.expectedLastRequestId!==s.lastRequestId||c.expectedLastEvidenceDigest!==(s.lastEvidenceDigest||'')||
    !Number.isSafeInteger(c.completedThrough)||c.completedThrough<(s.completedThrough||320)||c.completedThrough>400||
    typeof c.reconciliationDigest!=='string'||!/^[a-f0-9]{64}$/.test(c.reconciliationDigest)||c.confirmPartialStateReconciled!==true||
    String(uid)!==s.triggerUid||englishMetadataAutoCell_(sheet,6)!==oldText)return false;
  let evidence;try{evidence=englishMetadataEvidence_(c.evidence,{firstId:321,lastId:400});}catch(_){return false;}
  // All original failures/evidence pointers and the exact old deadline survive in an immutable private archive.
  const props=PropertiesService.getScriptProperties(),key=ENGLISH_METADATA_ARCHIVE_PREFIX+s.jobId,archived=props.getProperty(key);
  if(archived&&archived!==oldText)throw new Error('前jobの保存控えが別の内容です。上書きしません。');
  if(englishMetadataAutoCell_(sheet,5)!==raw)return false;
  const now=Date.now(),buckets=s.continuation?s.buckets.map(function(b){return {hour:b.hour,ms:b.ms};}):[{hour:Math.floor(now/ENGLISH_NOTES_HOUR)*ENGLISH_NOTES_HOUR,ms:s.usedMs}];
  const next={schema:1,scope:s.scope,protocol:'demand-v3',jobId:Utilities.getUuid(),book:s.book,sheet:s.sheet,triggerUid:s.triggerUid,
    status:'WAITING',started:0,expires:0,runs:0,usedMs:0,nextRefreshAt:0,lastSnapshotId:'',lastRequestId:'',lastEvidenceDigest:'',saveUntil:0,requests:[],
    continuation:true,previousJobId:s.jobId,rootJobId:s.rootJobId||s.jobId,sequence:(s.sequence||0)+1,taskExpires:s.taskExpires||s.started+14*ENGLISH_NOTES_DAY,
    carriedUsedMs:(s.carriedUsedMs||0)+s.usedMs,carriedRuns:(s.carriedRuns||0)+s.runs,totalUsedMs:(s.carriedUsedMs||0)+s.usedMs,totalRuns:(s.carriedRuns||0)+s.runs,
    buckets:buckets,dailyLimitMs:ENGLISH_NOTES_DAILY_BUDGET,resumeAfter:0,completedThrough:c.completedThrough,reconciliationDigest:c.reconciliationDigest,
    previousSnapshotId:s.lastSnapshotId,previousEvidenceDigest:s.lastEvidenceDigest||'',resumeCommandHash:englishReviewDigest_(raw),reason:'LIMITの旧jobと途中状態を保持し、新しい有限jobを受付'};
  if(now>=next.taskExpires)return false;
  props.setProperty(key,oldText);if(props.getProperty(key)!==oldText)throw new Error('前jobの控えの読戻しが一致しません。');
  // Mutate the caller's state reference before persisting, so any later failure stops this successor.
  Object.keys(s).forEach(function(k){delete s[k];});Object.assign(s,next);
  props.setProperty(ENGLISH_METADATA_AUTO_PROPERTY,JSON.stringify(s));
  englishMetadataResumeAck_(sheet,s);return true;
}
function englishMetadataResumeAccount_(s,elapsed,reservedHour){
  if(!s.continuation)return;
  if(reservedHour!==null)englishMetadataNotesCharge_(s,reservedHour,-ENGLISH_METADATA_AUTO_LIMITS.oneRun);
  if(elapsed)englishMetadataNotesCharge_(s,Math.floor(Date.now()/ENGLISH_NOTES_HOUR)*ENGLISH_NOTES_HOUR,elapsed);
  const budget=englishMetadataNotesBudget_(s);s.dailyUsedMs=budget.used;s.dailyLimitMs=ENGLISH_NOTES_DAILY_BUDGET;s.totalUsedMs=s.carriedUsedMs+s.usedMs;s.totalRuns=s.carriedRuns+s.runs;
}
