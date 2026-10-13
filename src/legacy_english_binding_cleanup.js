/** Explicit owner-run cleanup of this book's retired draft-binding receipts only. */
const LEGACY_ENGLISH_BINDING_RETIRE='english-draft-binding-retired-v1:';
// Never forward service exception messages, response bodies, IDs, property values or tokens.
function legacyEnglishCleanupError_(code){const e=new Error('旧対応付けの整理を停止しました。コード: '+code+'。整理を繰り返さず、このコードを確認してください。');e.cleanupCode=code;return e;}
function legacyEnglishCleanupStep_(code,fn){try{return fn();}catch(e){if(e&&/^LC_[A-Z_]+(?:_[1-5]\d{2})?$/.test(e.cleanupCode||''))throw e;throw legacyEnglishCleanupError_(code);}}
function legacyEnglishCleanupReport_(e,progress){const code=e&&/^LC_[A-Z_]+(?:_[1-5]\d{2})?$/.test(e.cleanupCode||'')?e.cleanupCode:'LC_UNEXPECTED';console.log(JSON.stringify(Object.assign({status:'STOPPED',code:code},progress)));return legacyEnglishCleanupError_(code);}
// Availability observations only, never substitutes for the fresh context/owner checks below.
function legacyEnglishCleanupContextChecks_(){
  const c={activeReadOk:false,activePresent:false,settingsReadOk:false,configuredBookPresent:false,activeMatchesConfigured:false,
    notesConfigReadOk:false,notesConfigured:false,notesConfigMatchesBook:false,structureChecked:false,notesFound:false,ledgerFound:false,structureMatches:false,uiChecked:false,uiAvailable:false};
  let active=null,expected='',config=null;
  try{active=SpreadsheetApp.getActiveSpreadsheet();c.activeReadOk=true;c.activePresent=!!active;}catch(_){}
  try{expected=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')||'';c.settingsReadOk=true;c.configuredBookPresent=!!expected;c.activeMatchesConfigured=!!active&&active.getId()===expected;}catch(_){}
  try{config=notesEnglishConfig_();c.notesConfigReadOk=true;c.notesConfigured=!!config;c.notesConfigMatchesBook=!!config&&!!expected&&config.book===expected;}catch(_){}
  if(active){
    c.uiChecked=true;try{c.uiAvailable=!!SpreadsheetApp.getUi();}catch(_){}
    try{const sheet=active.getSheetByName('Notes'),ledger=active.getSheetByName(NOTES_ENGLISH_LEDGER);c.structureChecked=true;c.notesFound=!!sheet;c.ledgerFound=!!ledger;
      c.structureMatches=!!(config&&sheet&&ledger&&active.getId()===expected&&config.book===expected&&sheet.getSheetId()===config.sheet&&sheet.getMaxColumns()>=9&&ledger.getSheetId()===config.ledger&&ledger.getMaxColumns()===32&&
        ledger.getRange(1,1).getDisplayValues()[0][0]===NOTES_ENGLISH_MARKER&&JSON.stringify(ledger.getRange(2,1,1,32).getDisplayValues()[0])===JSON.stringify(NOTES_ENGLISH_HEADERS)&&sheet.getLastRow()<=NOTES_ENGLISH_MAX_ROWS&&ledger.getLastRow()<=NOTES_ENGLISH_MAX_ROWS);
    }catch(_){}
  }return c;
}
function legacyEnglishBindingsRetired_(){
  const p=PropertiesService.getScriptProperties(),book=p.getProperty('SPREADSHEET_ID');if(!book)return false;
  const raw=p.getProperty(LEGACY_ENGLISH_BINDING_RETIRE+book);if(!raw)return false;
  const r=notesEnglishJson_(raw);
  if(!r||r.schema!==1||r.book!==book||r.script!==ScriptApp.getScriptId()||!r.file||!/^[a-f0-9]{64}$/.test(r.digest))throw new Error('旧対応付けの廃止記録を確認してください。旧処理は再開しません。');
  return true;
}
function legacyEnglishCleanupOwner_(book){
  // Container/editor context only: never fall back to openById in a web app.
  const active=legacyEnglishCleanupStep_('LC_ACTIVE_READ',function(){return SpreadsheetApp.getActiveSpreadsheet();});
  if(!active)throw legacyEnglishCleanupError_('LC_ACTIVE_MISSING');if(active.getId()!==book.getId())throw legacyEnglishCleanupError_('LC_ACTIVE_CHANGED');
  // UI availability is not identity proof. Active bound context and Drive owner equality remain mandatory.
  const token=legacyEnglishCleanupStep_('LC_OWNER_TOKEN',function(){const value=ScriptApp.getOAuthToken();if(!value)throw new Error();return value;}),options={method:'get',headers:{Authorization:'Bearer '+token},muteHttpExceptions:true,followRedirects:false};
  function read(url,part){return legacyEnglishCleanupStep_('LC_OWNER_'+part+'_FETCH',function(){
    const r=UrlFetchApp.fetch(url,options),status=r.getResponseCode();if(status!==200)throw legacyEnglishCleanupError_('LC_OWNER_'+part+'_HTTP'+(Number.isInteger(status)&&status>=100&&status<=599?'_'+status:''));
    return legacyEnglishCleanupStep_('LC_OWNER_'+part+'_RESPONSE',function(){return JSON.parse(r.getContentText());});
  });}
  const me=read('https://www.googleapis.com/drive/v3/about?fields=user(permissionId)','ABOUT'),file=read('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(book.getId())+'?fields=id,owners(permissionId),driveId','FILE');
  if(!me||!me.user||!me.user.permissionId||!file||file.id!==book.getId())throw legacyEnglishCleanupError_('LC_OWNER_RESPONSE');
  if(file.driveId)throw legacyEnglishCleanupError_('LC_SHARED_DRIVE');
  if(!Array.isArray(file.owners)||file.owners.length!==1||file.owners[0].permissionId!==me.user.permissionId)throw legacyEnglishCleanupError_('LC_NOT_OWNER');
}
function legacyEnglishCleanupPlan_(){
  const active=legacyEnglishCleanupStep_('LC_ACTIVE_READ',function(){return SpreadsheetApp.getActiveSpreadsheet();});if(!active)throw legacyEnglishCleanupError_('LC_ACTIVE_MISSING');
  if(!legacyEnglishCleanupStep_('LC_CONFIG',notesEnglishConfig_))throw legacyEnglishCleanupError_('LC_NOT_PREPARED');
  const ctx=legacyEnglishCleanupStep_('LC_STRUCTURE',function(){return notesEnglishContext_(true);});legacyEnglishCleanupOwner_(ctx.book);
  // PREPARING already blocks the old contexts; do not promote it to ACTIVE here.
  if(!legacyEnglishCleanupStep_('LC_CONFIG',notesEnglishOwns_))throw legacyEnglishCleanupError_('LC_OLD_ROUTE_ACTIVE');
  const props=PropertiesService.getScriptProperties(),prefix='english-draft-binding:'+ctx.book.getId()+':',all=legacyEnglishCleanupStep_('LC_PROPERTY_READ',function(){return props.getKeys();}),entries=[],classes={BOUND:0,REGISTERED:0,TAGGED:0,INTENT:0},excluded={invalid:0,otherBookOrPurpose:0};
  all.sort().forEach(function(key){
    if(key.indexOf(prefix)!==0){excluded.otherBookOrPurpose++;return;}
    const id=key.slice(prefix.length);if(!/^EN-\d{6}$/.test(id)){excluded.invalid++;return;}
    const value=legacyEnglishCleanupStep_('LC_PROPERTY_READ',function(){return props.getProperty(key);}),r=notesEnglishJson_(value);
    if(typeof value!=='string'||!r||r.schema!==1||r.book!==ctx.book.getId()||r.id!==id||!Object.prototype.hasOwnProperty.call(classes,r.stage)){excluded.invalid++;return;}
    entries.push([key,value]);classes[r.stage]++;
  });
  const marker=legacyEnglishCleanupStep_('LC_PROPERTY_READ',function(){return props.getProperty(LEGACY_ENGLISH_BINDING_RETIRE+ctx.book.getId())||'';});
  if(marker)legacyEnglishCleanupStep_('LC_RETIRED_MARKER',legacyEnglishBindingsRetired_);
  return {ctx:ctx,props:props,prefix:prefix,entries:entries,classes:classes,excluded:excluded,total:all.length,marker:marker,
    digest:notesEnglishHash_([ctx.book.getId(),ctx.config.phase,prefix,entries,marker])};
}
function legacyEnglishCleanupPrivateFile_(file){
  if(!file||file.isTrashed()||file.getSharingAccess()!==DriveApp.Access.PRIVATE||file.getEditors().length||file.getViewers().length||file.getSize()>5*1024*1024)throw legacyEnglishCleanupError_('LC_BACKUP_PRIVATE');
}
function legacyEnglishCleanupBackup_(plan,progress){
  const script=ScriptApp.getScriptId(),book=plan.ctx.book.getId();let file,archive,digest;
  if(plan.marker){
    const marker=notesEnglishJson_(plan.marker);file=legacyEnglishCleanupStep_('LC_BACKUP_READ',function(){return DriveApp.getFileById(marker.file);});legacyEnglishCleanupPrivateFile_(file);
    const raw=file.getBlob().getDataAsString('UTF-8');archive=notesEnglishJson_(raw);digest=notesEnglishHash_(raw);
    if(digest!==marker.digest||!archive||archive.schema!==1||archive.script!==script||archive.book!==book||archive.prefix!==plan.prefix||!Array.isArray(archive.entries))throw legacyEnglishCleanupError_('LC_BACKUP_CONTENT');
  }else{
    archive={schema:1,script:script,book:book,prefix:plan.prefix,createdAt:new Date().toISOString(),entries:plan.entries};
    const raw=JSON.stringify(archive);digest=notesEnglishHash_(raw);
    const name='Notes旧対応付け控え_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    if(progress)progress.backupWriteAttempted=true;
    file=legacyEnglishCleanupStep_('LC_BACKUP_CREATE',function(){return DriveApp.createFile(Utilities.newBlob(raw,'application/json',name));});legacyEnglishCleanupPrivateFile_(file);
    if(file.getBlob().getDataAsString('UTF-8')!==raw)throw legacyEnglishCleanupError_('LC_BACKUP_READBACK');
  }
  const saved=new Map();archive.entries.forEach(function(e){
    if(!Array.isArray(e)||e.length!==2||typeof e[0]!=='string'||e[0].indexOf(plan.prefix)!==0||typeof e[1]!=='string'||saved.has(e[0]))throw legacyEnglishCleanupError_('LC_BACKUP_CONTENT');saved.set(e[0],e[1]);
  });
  if(plan.entries.some(function(e){return saved.get(e[0])!==e[1];}))throw legacyEnglishCleanupError_('LC_BACKUP_CHANGED');
  return {file:file,digest:digest,saved:saved};
}
// Read-only diagnosis. Never creates a backup/retirement marker, deletes a property or initializes Notes.
function diagnoseLegacyEnglishDraftBindings(){
  const progress={mode:'READ_ONLY',backupWriteAttempted:false,markerWriteAttempted:false,deletionAttempted:false,deleted:0};
  try{
    progress.checks=legacyEnglishCleanupContextChecks_();
    const result=legacyEnglishCleanupStep_('LC_LOCK',function(){return notesEnglishLock_(function(){
      const plan=legacyEnglishCleanupStep_('LC_PREFLIGHT',legacyEnglishCleanupPlan_);
      if(plan.marker)legacyEnglishCleanupStep_('LC_BACKUP_READ',function(){legacyEnglishCleanupBackup_(plan);});
      return {status:'READY',mode:'READ_ONLY',target:plan.entries.length,excludedInvalid:plan.excluded.invalid,scriptPropertyCount:plan.total,notesPreparation:plan.ctx.config.phase==='ACTIVE'?'complete':'preparing',existingBackupChecked:!!plan.marker,writesAttempted:false,ownerVerified:true,checks:progress.checks};
    });});console.log(JSON.stringify(result));return result;
  }catch(e){throw legacyEnglishCleanupReport_(e,progress);}
}
// Explicit owner-run entry point. The owner has authorized this exact prefix; no dialog.
function cleanupLegacyEnglishDraftBindings(){
  const progress={mode:'CLEANUP',backupWriteAttempted:false,markerWriteAttempted:false,deletionAttempted:false,deleted:0};
  try{
    const preview=legacyEnglishCleanupStep_('LC_LOCK',function(){return notesEnglishLock_(function(){return legacyEnglishCleanupStep_('LC_PREFLIGHT',legacyEnglishCleanupPlan_);});});
    console.log(JSON.stringify({target:preview.entries.length,completed:preview.classes.BOUND,incomplete:preview.classes.REGISTERED+preview.classes.TAGGED+preview.classes.INTENT,excludedInvalid:preview.excluded.invalid}));
    if(!preview.entries.length){const empty={target:0,deleted:0,excludedInvalid:preview.excluded.invalid,scriptPropertyCount:preview.total};console.log(JSON.stringify(empty));return empty;}
    const result=legacyEnglishCleanupStep_('LC_LOCK',function(){return notesEnglishLock_(function(){return legacyEnglishCleanupStep_('LC_CLEANUP',function(){
      const plan=legacyEnglishCleanupPlan_();if(plan.digest!==preview.digest)throw legacyEnglishCleanupError_('LC_CONCURRENT_CHANGE');
      const backup=legacyEnglishCleanupStep_('LC_BACKUP',function(){return legacyEnglishCleanupBackup_(plan,progress);}),markerKey=LEGACY_ENGLISH_BINDING_RETIRE+plan.ctx.book.getId();
      if(!plan.marker){
        const record=JSON.stringify({schema:1,script:ScriptApp.getScriptId(),book:plan.ctx.book.getId(),file:backup.file.getId(),digest:backup.digest});
        progress.markerWriteAttempted=true;
        legacyEnglishCleanupStep_('LC_MARKER_SAVE',function(){plan.props.setProperty(markerKey,record);if(plan.props.getProperty(markerKey)!==record)throw new Error();});
      }
      if(!legacyEnglishCleanupStep_('LC_RETIRED_MARKER',legacyEnglishBindingsRetired_))throw legacyEnglishCleanupError_('LC_RETIRED_MARKER');
      const started=Date.now();let deleted=0,changed=0,failed=0;
      for(let i=0;i<plan.entries.length&&i<100&&Date.now()-started<60000;i++){
        const entry=plan.entries[i];if(plan.props.getProperty(entry[0])!==entry[1]){changed++;continue;}
        try{progress.deletionAttempted=true;plan.props.deleteProperty(entry[0]);if(plan.props.getProperty(entry[0])===null){deleted++;progress.deleted=deleted;}else failed++;}catch(_){failed++;break;}
      }
      return {target:plan.entries.length,deleted:deleted,remaining:plan.entries.length-deleted,changed:changed,failed:failed,excludedInvalid:plan.excluded.invalid,
        scriptPropertyCount:legacyEnglishCleanupStep_('LC_POST_DELETE_READ',function(){return plan.props.getKeys().length;}),notesPreparation:plan.ctx.config.phase==='ACTIVE'?'complete':'preparing',backupVerified:true};
    });});});
    console.log(JSON.stringify(result));try{SpreadsheetApp.getActiveSpreadsheet().toast('旧対応付け：削除 '+result.deleted+'件／残り '+result.remaining+'件。対象だけの非公開控えをマイドライブへ保存済み。','プロパティ整理',10);}catch(_){console.log(JSON.stringify({notice:'LC_NOTICE',deleted:result.deleted,remaining:result.remaining}));}return result;
  }catch(e){throw legacyEnglishCleanupReport_(e,progress);}
}
