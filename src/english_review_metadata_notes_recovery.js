/** Explicit, single-use recovery of a metadata-read timeout. Never clears ERROR on RUN. */
function englishMetadataNotesRecoverRoute_(e){
  const lock=LockService.getScriptLock();if(!lock||!lock.tryLock(1))return {status:'BUSY'};
  let doc,p,sheet,accepted=false;const began=Date.now();
  try{
    p=englishMetadataNotesLoad_();const j=p&&p.job;
    if(!p||p.status!=='ERROR'||p.protocol!=='demand-v3'||!j||j.status!=='ERROR'||p.targetedMetadataRecovery||
      !['最終照合で時間上限に達しました。未完成です。','metadata読取りで時間上限に達しました。未完成です。'].includes(p.reason)||
      p.triggerUid!==String(e.triggerUid))return {status:'ERROR'};
    const timing=j.timing||{},reads=[timing.firstRead,timing.secondRead];
    if(reads.reduce(function(n,r){return n+(r&&Number.isFinite(r.metadataReadMs)?r.metadataReadMs:0);},0)<ENGLISH_METADATA_EXPORT_RUN_MS*0.9)return {status:'ERROR'};
    const candidate=LockService.getDocumentLock();if(!candidate||!candidate.tryLock(1))return {status:'BUSY'};doc=candidate;
    const props=PropertiesService.getScriptProperties();if(props.getProperty('SPREADSHEET_ID')!==p.book)return {status:'ERROR'};
    sheet=englishMetadataOwnedSheet_(SpreadsheetApp.openById(p.book));if(sheet.getSheetId()!==p.sheet)return {status:'ERROR'};
    const raw=englishMetadataAutoCell_(sheet,5),shown=englishMetadataAutoCell_(sheet,6);let c,f;
    try{c=JSON.parse(raw);f=JSON.parse(shown);}catch(_){return {status:'ERROR'};}
    const expired=c&&c.action==='CLASSIFY_EXPIRED_TARGETED_METADATA_READ';
    const targeted=expired||c&&c.action==='RECOVER_TARGETED_METADATA_READ';
    if(expired){
      if(Date.now()<j.expires||Date.now()+ENGLISH_NOTES_START_RESERVE_MS>=p.expires)return {status:'ERROR'};
    }else if(Date.now()+ENGLISH_METADATA_EXPORT_RUN_MS>=Math.min(p.expires,j.expires)||j.runs>=12||j.usedMs+ENGLISH_METADATA_EXPORT_RUN_MS>ENGLISH_NOTES_BUDGET)return {status:'ERROR'};
    if(targeted){
      // One migration for a fresh job whose first full-key read timed out before
      // any completed snapshot/WRITE. A prior job's recovery is retained, not reset.
      const first=timing.firstRead,second=timing.secondRead;
      if(p.targetedMetadataRecovery||p.reason!=='metadata読取りで時間上限に達しました。未完成です。'||j.runs!==1||!Array.isArray(j.requests)||j.requests.length!==1||
        j.lastSnapshotId!==''||j.lastRequestId!==''||(j.lastEvidenceDigest||'')!==''||j.saveUntil!==0||
        !first||first.metadataLocationStrategy!=='row-a1-grid-v1'||first.metadataScope||!Number.isSafeInteger(first.metadataCount)||first.metadataCount<1||
        !Number.isFinite(first.metadataFieldsMs)||first.metadataFieldsMs<ENGLISH_METADATA_EXPORT_RUN_MS*0.9||!second||Object.keys(second).length||
        c.metadataAddedBeforeFailedRun!==0||c.confirmNoMetadataWrites!==true||c.expectedSnapshotSchema!==4||c.expectedMetadataCountScope!=='target-id-or-planned-row-union-v1'||
        c.expectedFailedRequestId!==j.requests[0]||c.expectedCompletedThrough!==p.completedThrough||f.completedThrough!==p.completedThrough||
        (!expired&&Date.now()+ENGLISH_NOTES_START_RESERVE_MS>=Math.min(p.expires,j.expires)))return {status:'ERROR'};
    }else if(p.metadataReadRecovery||!c||c.action!=='RECOVER_METADATA_READ')return {status:'ERROR'};
    if(!c||c.schema!==2||c.scope!=='Notes'||c.protocol!=='demand-v3'||c.jobId!==j.jobId||
      c.confirmNoCandidateWrites!==true||c.confirmPartialStateReconciled!==true||!Number.isSafeInteger(c.metadataAddedBeforeFailedRun)||c.metadataAddedBeforeFailedRun<0||c.metadataAddedBeforeFailedRun>20||
      !/^[a-f0-9]{64}$/.test(c.reconciliationDigest||'')||typeof c.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.requestId)||j.requests.includes(c.requestId)||
      c.expectedStateDigest!==englishReviewDigest_(shown)||c.expectedRuns!==j.runs||c.expectedUsedMs!==j.usedMs||c.expectedExpires!==j.expires||c.expectedReason!==p.reason||
      c.expectedLastSnapshotId!==j.lastSnapshotId||c.expectedLastRequestId!==j.lastRequestId||c.expectedLastEvidenceDigest!==(j.lastEvidenceDigest||'')||
      JSON.stringify(c.target)!==JSON.stringify(j.target)||f.schema!==2||f.scope!=='Notes'||f.protocol!=='demand-v3'||f.jobId!==j.jobId||f.status!=='ERROR'||f.taskStatus!=='ERROR'||
      f.runs!==j.runs||f.usedMs!==j.usedMs||f.reason!==p.reason||f.expires!==j.expires||f.taskExpires!==p.expires||JSON.stringify(f.target)!==JSON.stringify(j.target)||
      f.lastSnapshotId!==j.lastSnapshotId||f.lastRequestId!==j.lastRequestId||f.lastEvidenceDigest!==(j.lastEvidenceDigest||''))return {status:'ERROR'};
    const evidence=englishMetadataEvidence_(c.evidence,j.target);
    const last=sheet.getLastRow(),from=Math.max(3,last-60002),history=sheet.getRange(from,1,last-from+1,4).getDisplayValues(),tail=history[history.length-1];
    const begins=history.filter(function(r){return r[1]==='BEGIN';}),begin=begins[begins.length-1];
    if(!tail||tail[1]!=='ERROR'||tail[2]!=='FAILED'||!begin||begin[0]!==tail[0]||begin[2]!=='BUILDING'||c.expectedFailedSnapshotId!==tail[0]||
      history.some(function(r){return r[0]===tail[0]&&r[1]==='END'&&r[2]==='COMPLETE';})||
      englishMetadataAutoCell_(sheet,5)!==raw||englishMetadataAutoCell_(sheet,6)!==shown||sheet.getLastRow()!==last)return {status:'ERROR'};
    if(expired){
      // The old failure happened before expiry, during its first capture, with no
      // output body or COMPLETE. Expiry now permits classification, not a retry.
      const start=Date.parse(begin[3]),end=Date.parse(tail[3]);
      if(c.expectedFailedBeginAt!==begin[3]||c.expectedFailedErrorAt!==tail[3]||history[history.length-2]!==begin||
        !Number.isFinite(start)||!Number.isFinite(end)||start<j.started||end<start||end>=j.expires||end>Date.now()||
        end-start>j.usedMs||j.usedMs<timing.firstRead.metadataReadMs||Date.now()+ENGLISH_NOTES_START_RESERVE_MS>=p.expires)return {status:'ERROR'};
    }
    const archiveKey=(targeted?'english-metadata-notes-targeted-error-':'english-metadata-notes-error-')+j.jobId,archive=JSON.stringify(p);
    if(props.getProperty(archiveKey))return {status:'ERROR'};
    // Keep the complete failed state before any acknowledgement. A partial archive fails closed.
    props.setProperty(archiveKey,archive);if(props.getProperty(archiveKey)!==archive)throw new Error('回復前の記録保存が不一致です。');
    p[targeted?'targetedMetadataRecovery':'metadataReadRecovery']={requestId:c.requestId,failedSnapshotId:tail[0],archiveKey:archiveKey,reconciliationDigest:c.reconciliationDigest,metadataAddedBeforeFailedRun:c.metadataAddedBeforeFailedRun,at:Date.now()};
    p.status='ACTIVE';j.status=expired?'LIMIT':'WAITING';j.saveUntil=0;
    if(expired){j.deadlineStop={kind:'EXPIRED_INITIAL_METADATA_TIMEOUT',at:Date.now(),expires:j.expires,failedSnapshotId:tail[0],archiveKey:archiveKey};p.reason='初回metadata時間超過の証跡を保全して期限切れjobをLIMITへ整理。同じ対象の新jobを明示要求してください。';}
    else{j.nextAllowedAt=0;p.resumeAfter=0;p.reason='metadata時間超過の明示回復を受付。原文全体と対象metadataの再照合待ち';}
    accepted=true;
    englishMetadataNotesPut_(p);
    englishMetadataNotesAck_(sheet,p,{raw:raw,value:{requestId:c.requestId,evidence:evidence}});
    return {status:expired?'LIMIT':'RECOVERY_ACCEPTED'};
  }catch(_){if(accepted){p.status='ERROR';p.job.status='ERROR';p.job.saveUntil=0;p.reason='metadata回復の受付保存に失敗しました。要確認。';}return {status:'ERROR'};
  }finally{
    try{if(accepted){const elapsed=Math.max(0,Date.now()-began);p.job.usedMs+=elapsed;if(elapsed)englishMetadataNotesCharge_(p,Math.floor(Date.now()/ENGLISH_NOTES_HOUR)*ENGLISH_NOTES_HOUR,elapsed);englishMetadataNotesPut_(p);
      try{englishMetadataNotesPublish_(sheet,p);}catch(_){p.status='ERROR';p.job.status='ERROR';p.job.saveUntil=0;p.reason='metadata回復の状態保存に失敗しました。要確認。';englishMetadataNotesPut_(p);throw new Error(p.reason);}}}
    finally{if(doc)doc.releaseLock();lock.releaseLock();}
  }
}
