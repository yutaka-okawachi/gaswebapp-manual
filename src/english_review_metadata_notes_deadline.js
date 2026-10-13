/** One explicit migration of the old, ambiguous timeout after the read recovery.
 * It classifies the expired job only; a separate same-target RUN starts its successor. */
function englishMetadataNotesDeadlineRoute_(e){
  const lock=LockService.getScriptLock();if(!lock||!lock.tryLock(1))return {status:'BUSY'};
  let doc,p,sheet,accepted=false;const began=Date.now();
  try{
    p=englishMetadataNotesLoad_();const j=p&&p.job,recovery=p&&p.metadataReadRecovery,props=PropertiesService.getScriptProperties();
    if(!p||p.status!=='ERROR'||p.protocol!=='demand-v3'||!j||j.status!=='ERROR'||p.reason!=='照合時間または作業期限の上限です。'||
      p.deadlineReclassification||!recovery||recovery.archiveKey!=='english-metadata-notes-error-'+j.jobId||p.triggerUid!==String(e.triggerUid)||
      Date.now()<j.expires||Date.now()>=p.expires)return {status:'ERROR'};
    let prior;try{prior=JSON.parse(props.getProperty(recovery.archiveKey));}catch(_){}
    const old=prior&&prior.job;
    if(!prior||prior.schema!==2||prior.protocol!=='demand-v3'||prior.status!=='ERROR'||!old||old.status!=='ERROR'||old.jobId!==j.jobId||old.expires!==j.expires||old.started!==j.started||
      prior.book!==p.book||prior.sheet!==p.sheet||prior.triggerUid!==p.triggerUid||prior.completedThrough!==p.completedThrough||JSON.stringify(old.target)!==JSON.stringify(j.target)||
      j.runs!==old.runs+1||j.usedMs<=old.usedMs||j.usedMs-old.usedMs>=ENGLISH_METADATA_EXPORT_RUN_MS||
      !Array.isArray(old.requests)||JSON.stringify(j.requests.slice(0,-1))!==JSON.stringify(old.requests)||j.requests[j.requests.length-1]!==recovery.requestId||
      !j.timing||!j.timing.firstRead||!Number.isFinite(j.timing.firstRead.metadataReadMs)||j.timing.firstRead.metadataReadMs<=0||
      !j.timing.secondRead||Object.keys(j.timing.secondRead).length)return {status:'ERROR'};
    const candidate=LockService.getDocumentLock();if(!candidate||!candidate.tryLock(1))return {status:'BUSY'};doc=candidate;
    if(props.getProperty('SPREADSHEET_ID')!==p.book)return {status:'ERROR'};
    sheet=englishMetadataOwnedSheet_(SpreadsheetApp.openById(p.book));if(sheet.getSheetId()!==p.sheet)return {status:'ERROR'};
    const raw=englishMetadataAutoCell_(sheet,5),shown=englishMetadataAutoCell_(sheet,6);let c,f;
    try{c=JSON.parse(raw);f=JSON.parse(shown);}catch(_){return {status:'ERROR'};}
    if(!c||c.schema!==2||c.scope!=='Notes'||c.protocol!=='demand-v3'||c.action!=='CLASSIFY_EXPIRED_JOB'||c.jobId!==j.jobId||
      c.confirmNoCandidateWrites!==true||c.confirmPartialStateReconciled!==true||!/^[a-f0-9]{64}$/.test(c.reconciliationDigest||'')||
      typeof c.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.requestId)||j.requests.includes(c.requestId)||
      c.expectedStateDigest!==englishReviewDigest_(shown)||c.expectedRuns!==j.runs||c.expectedUsedMs!==j.usedMs||c.expectedExpires!==j.expires||c.expectedReason!==p.reason||
      c.expectedRecoveryRequestId!==recovery.requestId||JSON.stringify(c.target)!==JSON.stringify(j.target)||
      f.schema!==2||f.scope!=='Notes'||f.protocol!=='demand-v3'||f.status!=='ERROR'||f.taskStatus!=='ERROR'||f.jobId!==j.jobId||
      f.runs!==j.runs||f.usedMs!==j.usedMs||f.expires!==j.expires||f.taskExpires!==p.expires||f.reason!==p.reason||f.completedThrough!==p.completedThrough||
      f.lastSnapshotId!==j.lastSnapshotId||f.lastRequestId!==j.lastRequestId||f.lastEvidenceDigest!==(j.lastEvidenceDigest||'')||JSON.stringify(f.target)!==JSON.stringify(j.target))return {status:'ERROR'};
    englishMetadataEvidence_(c.evidence,j.target);
    const last=sheet.getLastRow(),from=Math.max(3,last-60002),history=sheet.getRange(from,1,last-from+1,4).getDisplayValues(),tail=history[history.length-1];
    const begins=history.filter(function(r){return r[1]==='BEGIN';}),begin=begins[begins.length-1],start=begin&&Date.parse(begin[3]),end=tail&&Date.parse(tail[3]);
    if(!tail||tail[1]!=='ERROR'||tail[2]!=='FAILED'||!begin||begin[1]!=='BEGIN'||begin[2]!=='BUILDING'||begin[0]!==tail[0]||
      c.expectedFailedSnapshotId!==tail[0]||tail[0]===recovery.failedSnapshotId||c.expectedFailedBeginAt!==begin[3]||c.expectedFailedErrorAt!==tail[3]||
      !Number.isFinite(start)||!Number.isFinite(end)||start<j.expires-ENGLISH_NOTES_START_RESERVE_MS||start>j.expires+30000||end<j.expires||end<start||end-start>=ENGLISH_METADATA_EXPORT_RUN_MS||end>Date.now()||
      history.some(function(r){return r[0]===tail[0]&&r[1]==='END'&&r[2]==='COMPLETE';})||
      englishMetadataAutoCell_(sheet,5)!==raw||englishMetadataAutoCell_(sheet,6)!==shown||sheet.getLastRow()!==last)return {status:'ERROR'};
    // The 30-second allowance above describes the old BEGIN-after-check race. It
    // never extends a deadline or permits any new read of the expired job.
    const archiveKey='english-metadata-notes-deadline-error-'+j.jobId;if(props.getProperty(archiveKey))return {status:'ERROR'};
    englishMetadataNotesArchive_(p,'deadline-error');
    p.deadlineReclassification={requestId:c.requestId,archiveKey:archiveKey,reconciliationDigest:c.reconciliationDigest,failedSnapshotId:tail[0],at:Date.now()};
    p.status='ACTIVE';j.status='LIMIT';j.saveUntil=0;j.deadlineStop={kind:'LEGACY_JOB_EXPIRED',at:Date.now(),expires:j.expires,failedSnapshotId:tail[0],archiveKey:archiveKey};
    p.reason='期限由来の旧ERRORを証跡付きでLIMITへ整理。同じ対象範囲の後続jobを明示要求してください。';accepted=true;englishMetadataNotesPut_(p);
    // RUN against a LIMIT job is inert. The successor requires another explicit command.
    englishMetadataNotesAck_(sheet,p,{raw:raw,value:c});return {status:'LIMIT'};
  }catch(_){if(accepted){p.status='ERROR';p.job.status='ERROR';p.job.saveUntil=0;p.reason='期限分類の受付保存に失敗しました。要確認。';}return {status:'ERROR'};
  }finally{
    try{if(accepted){const elapsed=Math.max(0,Date.now()-began);p.job.usedMs+=elapsed;if(elapsed)englishMetadataNotesCharge_(p,Math.floor(Date.now()/ENGLISH_NOTES_HOUR)*ENGLISH_NOTES_HOUR,elapsed);englishMetadataNotesPut_(p);
      try{englishMetadataNotesPublish_(sheet,p);}catch(_){p.status='ERROR';p.job.status='ERROR';p.job.saveUntil=0;p.reason='期限分類の状態保存に失敗しました。要確認。';englishMetadataNotesPut_(p);throw new Error(p.reason);}}}
    finally{if(doc)doc.releaseLock();lock.releaseLock();}
  }
}
