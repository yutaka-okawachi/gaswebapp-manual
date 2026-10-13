/** Read source metadata/Notes; append evidence only to one owned hidden helper sheet. */
const ENGLISH_METADATA_EXPORT_NAME='英訳元行照合_補助';
const ENGLISH_METADATA_EXPORT_PROPERTY='english-metadata-export-tab-v1';
const ENGLISH_METADATA_EXPORT_MAGIC='english-metadata-snapshot-v1';
const ENGLISH_METADATA_EXPORT_RUN_MS=270000;
const ENGLISH_METADATA_EXPORT_HEADERS=['snapshotId','recordType','status','capturedAt','workbookId','notesSheetId','sourceRow','candidateId','rowKeyCount','idGlobalCount','metadataId','metadataKey','metadataValue','visibility','locationJson','sourceFingerprint','notesLastRow','recordCount','bundleFingerprint','detail'];
function englishMetadataTargetId_(id,target){return /^EN-\d{6}$/.test(id)&&Number(id.slice(3))>=(target?target.firstId:261)&&Number(id.slice(3))<=(target?target.lastId:400);}
function englishMetadataEvidence_(e,target){
  if(!e||e.schema!==3||!Array.isArray(e.items)||e.items.length<1||e.items.length>20)throw new Error('照合計画はschema 3の1〜20件を指定してください。');
  let prior='';const rows=new Set();
  const items=e.items.map(function(x){
    if(!x||!englishMetadataTargetId_(x.id,target)||x.id<=prior||!Number.isSafeInteger(x.sourceRow)||x.sourceRow<2||x.sourceRow>30000||rows.has(x.sourceRow)||typeof x.sourceFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(x.sourceFingerprint))throw new Error('照合計画のID・元行・指紋が不正または重複しています。');
    prior=x.id;rows.add(x.sourceRow);return {id:x.id,sourceRow:x.sourceRow,sourceFingerprint:x.sourceFingerprint};
  });return {schema:3,items:items};
}
function englishMetadataLocation_(tag) {
  const location=tag.getLocation(),row=location.getRow();
  // getRow returns null for every non-ROW location. A1 gives both row bounds in
  // one call; getGridId avoids getSheet().getSheetId(). No cross-read cache.
  if(row){
    const a1=row.getA1Notation(),match=/^[A-Z]*([1-9]\d*)(?::[A-Z]*([1-9]\d*))?$/.exec(a1),sheetId=row.getGridId();
    if(!match||!Number.isSafeInteger(Number(match[1]))||Number(match[1])!==Number(match[2]||match[1])||!Number.isSafeInteger(sheetId)||sheetId<0)throw new Error('行metadataの位置・範囲を確定できません。');
    return {dimensionRange:{sheetId:sheetId,dimension:'ROWS',startIndex:Number(match[1])-1,endIndex:Number(match[1])}};
  }
  const type=String(location.getLocationType());
  if(type==='COLUMN'){
    const range=location.getColumn();
    if(!range)throw new Error('metadataの位置を取得できません。');
    const start=range.getColumn()-1,count=range.getNumColumns();
    return {dimensionRange:{sheetId:range.getGridId(),dimension:'COLUMNS',startIndex:start,endIndex:start+count}};
  }
  if(type==='SHEET')return {sheetId:location.getSheet().getSheetId()};
  if(type==='SPREADSHEET')return {spreadsheet:true};
  throw new Error('metadataの位置種別が未対応です。');
}
function englishMetadataReadAll_(book,timing,deadline){
  const began=Date.now();let fieldsStarted=0;
  function budget(){if(deadline&&Date.now()>=deadline)throw new Error('metadata読取りで時間上限に達しました。未完成です。');}
  try{
    budget();const found=book.createDeveloperMetadataFinder().withKey(ENGLISH_REVIEW_METADATA_KEY).find();
    fieldsStarted=Date.now();if(timing){timing.metadataFindMs=fieldsStarted-began;timing.metadataCount=found.length;timing.metadataLocationStrategy='row-a1-grid-v1';}
    if(found.length>30000)throw new Error('metadata件数が検証上限を超えています。');budget();
    const metadata=found.map(function(tag,i){if(i%32===0)budget();return {metadataId:tag.getId(),metadataKey:tag.getKey(),metadataValue:tag.getValue(),visibility:String(tag.getVisibility()),location:englishMetadataLocation_(tag)};}).sort(function(a,b){return a.metadataId-b.metadataId;});
    budget();
    if(metadata.some(function(m){return m.metadataKey!==ENGLISH_REVIEW_METADATA_KEY||!Number.isSafeInteger(m.metadataId);})||new Set(metadata.map(function(m){return m.metadataId;})).size!==metadata.length)throw new Error('metadataの識別を確定できません。');
    return metadata;
  }finally{if(timing){timing.metadataReadMs=Date.now()-began;if(fieldsStarted)timing.metadataFieldsMs=Date.now()-fieldsStarted;}}
}
// Two independent query families: target IDs anywhere in this book, and exact
// planned ROW locations with the source key. Never substitute a global key scan.
function englishMetadataReadSelected_(book,notes,evidence,timing,deadline){
  const began=Date.now(),stats=timing||{},all=new Map(),idQueries=[],rowQueries=[];
  const notesSheetId=notes.getSheetId(),gridColumns=notes.getMaxColumns();
  Object.assign(stats,{metadataScope:'target-id-or-planned-row-union-v1',metadataLocationStrategy:'row-a1-grid-v1',metadataFindMs:0,metadataFieldsMs:0,idSearchMs:0,rowSearchMs:0,idQueries:0,rowQueries:0,metadataReturnedCount:0,metadataAttributeReads:0,metadataCount:0});
  function budget(){if(deadline&&Date.now()>=deadline)throw new Error('metadata読取りで時間上限に達しました。未完成です。');}
  function query(make,kind,expected){
    budget();const beganFind=Date.now();let found;
    try{found=make().find();}finally{const elapsed=Date.now()-beganFind;stats.metadataFindMs+=elapsed;stats[kind+'SearchMs']+=elapsed;stats[kind+'Queries']++;}
    stats.metadataReturnedCount+=found.length;
    // Bound before the first slow attribute getter. No truncated success.
    if(found.length>20||stats.metadataReturnedCount>80)throw new Error('対象metadataの一致件数が検証上限を超えています。');
    budget();const ids=[],fieldsStarted=Date.now();
    try{found.forEach(function(tag){
      budget();const m={metadataId:tag.getId(),metadataKey:tag.getKey(),metadataValue:tag.getValue(),visibility:String(tag.getVisibility()),location:englishMetadataLocation_(tag)};stats.metadataAttributeReads++;budget();
      const d=m.location.dimensionRange;
      if(!Number.isSafeInteger(m.metadataId)||m.metadataId<0||m.metadataKey!==ENGLISH_REVIEW_METADATA_KEY||typeof m.metadataValue!=='string'||!['DOCUMENT','PROJECT'].includes(m.visibility)||
        (kind==='id'?m.metadataValue!==expected:!d||d.dimension!=='ROWS'||d.sheetId!==notesSheetId||d.startIndex!==expected-1||d.endIndex!==expected))throw new Error('対象metadataの検索条件と位置が一致しません。');
      if(ids.includes(m.metadataId))throw new Error('対象metadataの識別が重複しています。');ids.push(m.metadataId);
      if(all.has(m.metadataId)&&JSON.stringify(all.get(m.metadataId))!==JSON.stringify(m))throw new Error('検索中に対象metadataが変わりました。');
      all.set(m.metadataId,m);stats.metadataCount=all.size;
    });}finally{stats.metadataFieldsMs+=Date.now()-fieldsStarted;}
    return ids.sort(function(a,b){return a-b;});
  }
  try{
    evidence.items.forEach(function(x){idQueries.push({id:x.id,metadataIds:query(function(){return book.createDeveloperMetadataFinder().withKey(ENGLISH_REVIEW_METADATA_KEY).withValue(x.id);},'id',x.id)});});
    evidence.items.slice().sort(function(a,b){return a.sourceRow-b.sourceRow;}).forEach(function(x){rowQueries.push({sourceRow:x.sourceRow,metadataIds:query(function(){return notes.getRange(x.sourceRow,1,1,gridColumns).createDeveloperMetadataFinder().withKey(ENGLISH_REVIEW_METADATA_KEY).withLocationType(SpreadsheetApp.DeveloperMetadataLocationType.ROW).onIntersectingLocations();},'row',x.sourceRow)});});
    const metadata=Array.from(all.values()).sort(function(a,b){return a.metadataId-b.metadataId;});
    // The two query families overlap. Require identical membership where they do.
    idQueries.forEach(function(q){const ids=metadata.filter(function(m){return m.metadataValue===q.id;}).map(function(m){return m.metadataId;});if(JSON.stringify(ids)!==JSON.stringify(q.metadataIds))throw new Error('検索中に対象IDのmetadataが変わりました。');});
    rowQueries.forEach(function(q){const ids=metadata.filter(function(m){const d=m.location.dimensionRange;return d&&d.dimension==='ROWS'&&d.sheetId===notesSheetId&&d.startIndex===q.sourceRow-1;}).map(function(m){return m.metadataId;});if(JSON.stringify(ids)!==JSON.stringify(q.metadataIds))throw new Error('検索中に予定元行のmetadataが変わりました。');});
    budget();return {metadata:metadata,queries:{schema:1,idQueries:idQueries,rowQueries:rowQueries}};
  }finally{stats.metadataReadMs=Date.now()-began;}
}
function englishMetadataCapture_(book,previous,evidence,timing,deadline) {
  const readStarted=Date.now();
  const notes=book.getSheetByName('Notes');if(!notes)throw new Error('Notesがありません。');
  const lastRow=notes.getLastRow();if(lastRow<1||lastRow>30000)throw new Error('Notesの行数が検証範囲外です。');
  const range=notes.getRange(1,1,lastRow,3),rows=range.getValues(),cellNotes=range.getNotes(),formulas=range.getFormulas(),gridRowCount=notes.getMaxRows();
  if(rows.some(function(row){return row.length!==3||row.some(function(value){return typeof value!=='string';});})||cellNotes.some(function(row){return row.length!==3||row.some(function(value){return typeof value!=='string';});})||formulas.some(function(row){return row.some(function(value){return value!=='';});}))throw new Error('Notes A:Cに文字列以外・数式・メモの型変更があります。変換せず停止しました。');
  if(JSON.stringify(rows[0])!==JSON.stringify(['de','ja','source']))throw new Error('Notesの列構成が契約と異なります。');
  if(timing)timing.sourceReadMs=Date.now()-readStarted;
  // Evidence jobs use the explicit ID/row union; legacy exports retain their full-key contract.
  const selected=evidence?englishMetadataReadSelected_(book,notes,evidence,timing,deadline):null;
  const metadata=selected?selected.metadata:englishMetadataReadAll_(book,timing,deadline),hashStarted=Date.now();
  if(evidence){
    const rowHash=[];
    evidence.items.forEach(function(x){if(x.sourceRow>lastRow||rows[x.sourceRow-1].every(function(v){return v==='';}))throw new Error('照合計画の元行が存在しないか空行です。');
      const hash=englishReviewDigest_({row:rows[x.sourceRow-1],notes:cellNotes[x.sourceRow-1]});if(hash!==x.sourceFingerprint)throw new Error('照合計画と現在の原文・メモが一致しません。');rowHash[x.sourceRow-1]=hash;});
    // All Notes source cells remain covered. Unrelated metadata is intentionally
    // outside this contract; ID duplicates anywhere and planned-row conflicts are covered.
    const fingerprint=englishReviewDigest_({schema:'notes-values-notes-target-metadata-sha256-v3',notesSheetId:notes.getSheetId(),lastRow:lastRow,gridRowCount:gridRowCount,rows:rows,notes:cellNotes,queries:selected.queries,metadata:metadata});
    if(timing)timing.hashMs=Date.now()-hashStarted;
    return {notesSheetId:notes.getSheetId(),lastRow:lastRow,gridRowCount:gridRowCount,rowHash:rowHash,metadata:metadata,fingerprint:fingerprint,evidence:evidence,queries:selected.queries};
  }
  // Re-read every value/note/formula/metadata entry. Reuse a hash only for byte-identical
  // JSON input from this invocation's first read; no persistent source cache is used.
  const inputs=rows.map(function(row,i){return JSON.stringify({row:row,notes:cellNotes[i]});});
  const rowHash=rows.map(function(row,i){return previous&&previous.inputs&&previous.inputs[i]===inputs[i]?previous.rowHash[i]:englishReviewDigest_({row:row,notes:cellNotes[i]});});
  return {notesSheetId:notes.getSheetId(),lastRow:lastRow,gridRowCount:gridRowCount,rowHash:rowHash,metadata:metadata,inputs:inputs,
    fingerprint:englishReviewDigest_({notesSheetId:notes.getSheetId(),lastRow:lastRow,gridRowCount:gridRowCount,rowHash:rowHash,metadata:metadata})};
}
function englishMetadataWrite_(sheet,row,values) {
  if(!values.length)return;
  const range=sheet.getRange(row,1,values.length,20);
  if([range.getDisplayValues(),range.getFormulas(),range.getNotes()].some(function(grid){return grid.some(function(line){return line.some(function(value){return value!=='';});});}))throw new Error('出力先に既存データがあります。上書きせず停止しました。');
  // RichTextValue is immutable. Share repeated blanks/IDs within this one write.
  const literal=new Map();
  range.setRichTextValues(values.map(function(line){return Array.from({length:20},function(_,i){const text=String(line[i]===undefined?'':line[i]);if(!literal.has(text))literal.set(text,SpreadsheetApp.newRichTextValue().setText(text).build());return literal.get(text);});}));
}
function englishMetadataEnsureRows_(sheet,lastRow) {
  if(lastRow>150000)throw new Error('補助タブの履歴上限です。履歴を削除せず、運用を確認してください。');
  if(sheet.getMaxRows()<lastRow)sheet.insertRowsAfter(sheet.getMaxRows(),lastRow-sheet.getMaxRows());
}
function englishMetadataOwnedSheet_(book) {
  const props=PropertiesService.getScriptProperties(),raw=props.getProperty(ENGLISH_METADATA_EXPORT_PROPERTY),named=book.getSheetByName(ENGLISH_METADATA_EXPORT_NAME);
  if(raw){
    let owner;try{owner=JSON.parse(raw);}catch(_){throw new Error('補助タブの管理記録が不正です。既存データは変更しません。');}
    if(owner.book!==book.getId()||!named||named.getSheetId()!==owner.sheet||!owner.token)throw new Error('補助タブの名前または識別が一致しません。既存データは変更しません。');
    const identity=named.getRange(1,1,1,4).getDisplayValues()[0];
    if(JSON.stringify(identity)!==JSON.stringify([ENGLISH_METADATA_EXPORT_MAGIC,book.getId(),owner.token,'APPEND_ONLY'])||JSON.stringify(named.getRange(2,1,1,20).getDisplayValues()[0])!==JSON.stringify(ENGLISH_METADATA_EXPORT_HEADERS))throw new Error('補助タブの所有印・列構成が一致しません。');
    if(!named.isSheetHidden())named.hideSheet();return named;
  }
  if(named)throw new Error('同名のタブが既にあります。上書き・流用せず停止しました。');
  const sheet=book.insertSheet(ENGLISH_METADATA_EXPORT_NAME),token=Utilities.getUuid();
  if(sheet.getMaxColumns()<20)sheet.insertColumnsAfter(sheet.getMaxColumns(),20-sheet.getMaxColumns());
  // A partial initialization is deliberately not adopted by a later run.
  englishMetadataWrite_(sheet,1,[[ENGLISH_METADATA_EXPORT_MAGIC,book.getId(),token,'APPEND_ONLY'],ENGLISH_METADATA_EXPORT_HEADERS]);
  props.setProperty(ENGLISH_METADATA_EXPORT_PROPERTY,JSON.stringify({book:book.getId(),sheet:sheet.getSheetId(),token:token}));
  sheet.hideSheet();return sheet;
}
function englishMetadataRecords_(snapshot,id,started,target) {
  const records=[],byRow=Object.create(null),byId=Object.create(null);
  snapshot.metadata.forEach(function(m){
    (byId[m.metadataValue]||(byId[m.metadataValue]=[])).push(m);
    const d=m.location.dimensionRange;
    if(d&&d.dimension==='ROWS'&&d.sheetId===snapshot.notesSheetId)(byRow[d.startIndex+1]||(byRow[d.startIndex+1]=[])).push(m);
  });
  function line(type){const row=Array(20).fill('');row[0]=id;row[1]=type;row[3]=started;return row;}
  const selected=snapshot.evidence,selectedIds=selected&&new Set(selected.items.map(function(x){return x.id;}));
  const sourceRows=selected?selected.items.map(function(x){return x.sourceRow;}).sort(function(a,b){return a-b;}):Array.from({length:snapshot.lastRow-1},function(_,i){return i+2;});
  for(const n of sourceRows){
    const row=line('NOTES_ROW');row[5]=snapshot.notesSheetId;row[6]=n;row[8]=(byRow[n]||[]).length;row[15]=snapshot.rowHash[n-1];records.push(row);
  }
  for(let n=target?target.firstId:261;n<=(target?target.lastId:400);n++){
    if(selectedIds&&!selectedIds.has('EN-'+String(n).padStart(6,'0')))continue;
    const key='EN-'+String(n).padStart(6,'0'),matches=byId[key]||[],row=line('TARGET_ID');row[2]='CLOUD_PLAN_REQUIRED';row[7]=key;row[9]=matches.length;
    if(matches.length===1){const m=matches[0],d=m.location.dimensionRange;row[10]=m.metadataId;row[11]=m.metadataKey;row[12]=m.metadataValue;row[13]=m.visibility;row[14]=JSON.stringify(m.location);
      if(d&&d.dimension==='ROWS'&&d.sheetId===snapshot.notesSheetId){row[5]=snapshot.notesSheetId;row[6]=d.startIndex+1;row[8]=selected&&!sourceRows.includes(row[6])?'':(byRow[row[6]]||[]).length;row[15]=snapshot.rowHash[d.startIndex]||'';}}
    row[19]=matches.length?'現在の観測位置です。予定元行・確定metadataIdはクラウドの非公開計画と照合':'該当IDなし。予定元行のNOTES_ROWとクラウドの非公開計画を照合';records.push(row);
  }
  snapshot.metadata.forEach(function(m){
    const d=m.location.dimensionRange,inNotes=!!d&&d.dimension==='ROWS'&&d.sheetId===snapshot.notesSheetId;
    if(!selected&&!englishMetadataTargetId_(m.metadataValue,target))return;
    const row=line('METADATA');row[6]=inNotes?d.startIndex+1:'';row[7]=englishMetadataTargetId_(m.metadataValue,target)?m.metadataValue:'';
    row[9]=selectedIds&&!selectedIds.has(m.metadataValue)?'':(byId[m.metadataValue]||[]).length;row[10]=m.metadataId;row[11]=m.metadataKey;row[12]=m.metadataValue;row[13]=m.visibility;row[14]=JSON.stringify(m.location);records.push(row);
  });
  if(records.length>60000)throw new Error('照合結果の件数が上限を超えています。');return records;
}
function refreshEnglishReviewMetadataSnapshotFromEditor() {
  if(typeof englishMetadataAutoManualGuard_==='function')englishMetadataAutoManualGuard_();
  return englishMetadataExport_();
}
// The automatic wrapper supplies only a verified book and a fail-closed guard.
// The default 20-column EN261-400 contract is unchanged; trusted Notes jobs can select a later range.
function englishMetadataExport_(options) {
  if(typeof englishDraftSnapshotsDetached_==='function'&&englishDraftSnapshotsDetached_())throw new Error('metadata snapshotは停止しました。新規下書きは本人のPC確認メニューで元行を結合します。');
  const ownsLock=!!(options&&options.documentLockHeld),lock=ownsLock?null:LockService.getDocumentLock();
  if(!ownsLock&&(!lock||!lock.tryLock(10000)))throw new Error('ほかの処理中です。後で実行してください。');
  let sheet,id='',start=0,started='';const timing={firstRead:{},secondRead:{}};let phase=Date.now();
  function guard(){if(options&&options.guard)options.guard();}
  try{
    const target=options&&options.target;
    if(target&&(!Number.isSafeInteger(target.firstId)||!Number.isSafeInteger(target.lastId)||target.firstId<(options.evidence?321:401)||target.lastId>989||target.lastId<target.firstId||target.lastId-target.firstId>=80))throw new Error('後続Notesの対象範囲が不正です。');
    const evidence=options&&options.evidence?englishMetadataEvidence_(options.evidence,target):null;
    const book=options&&options.book?options.book:SpreadsheetApp.getActiveSpreadsheet();
    if(!book||PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')!==book.getId())throw new Error('対象ブックとSPREADSHEET_IDが一致しません。');
    guard();
    sheet=englishMetadataOwnedSheet_(book);id=Utilities.getUuid();started=new Date().toISOString();const clock=Date.now();start=sheet.getLastRow()+1;
    englishMetadataEnsureRows_(sheet,start+1);
    const begin=Array(20).fill('');begin[0]=id;begin[1]='BEGIN';begin[2]='BUILDING';begin[3]=started;begin[4]=book.getId();
    if(options&&options.controlSchema===2)guard();
    englishMetadataWrite_(sheet,start,[begin]);SpreadsheetApp.flush();
    if(options&&options.controlSchema===2)guard();
    const snapshot=englishMetadataCapture_(book,null,evidence,timing.firstRead,clock+ENGLISH_METADATA_EXPORT_RUN_MS),records=englishMetadataRecords_(snapshot,id,started,target),end=start+records.length+1;
    phase=Date.now();
    englishMetadataEnsureRows_(sheet,end);
    for(let i=0;i<records.length;i+=200){
      if(Date.now()-clock>ENGLISH_METADATA_EXPORT_RUN_MS)throw new Error('照合出力が時間上限に達しました。未完成です。');
      englishMetadataWrite_(sheet,start+1+i,records.slice(i,i+200));
    }
    SpreadsheetApp.flush();
    timing.writeMs=Date.now()-phase;phase=Date.now();
    const read=sheet.getRange(start+1,1,records.length,20).getDisplayValues();
    const expected=records.map(function(r){return r.map(String);});
    if(JSON.stringify(read)!==JSON.stringify(expected))throw new Error('照合結果の保存読戻しが一致しません。');
    timing.readbackMs=Date.now()-phase;
    if(Date.now()-clock>ENGLISH_METADATA_EXPORT_RUN_MS)throw new Error('最終照合前に時間上限へ達しました。未完成です。');
    guard();
    const latest=englishMetadataCapture_(book,snapshot,evidence,timing.secondRead,clock+ENGLISH_METADATA_EXPORT_RUN_MS);
    if(latest.fingerprint!==snapshot.fingerprint)throw new Error('取得中にNotesまたはmetadataが変わりました。未完成です。');
    if(Date.now()-clock>ENGLISH_METADATA_EXPORT_RUN_MS)throw new Error('最終照合で時間上限に達しました。未完成です。');
    guard();
    if(!sheet.isSheetHidden()||sheet.getName()!==ENGLISH_METADATA_EXPORT_NAME)throw new Error('補助タブの名前・非表示状態が変わりました。');
    const completed=new Date().toISOString(),finish=Array(20).fill('');finish[0]=id;finish[1]='END';finish[2]='VERIFYING';finish[3]=completed;finish[4]=book.getId();finish[5]=snapshot.notesSheetId;finish[16]=snapshot.lastRow;finish[17]=records.length;finish[18]=englishReviewDigest_(expected);finish[19]=JSON.stringify({schema:1,startedAt:started,metadataCount:snapshot.metadata.length,notesGridRowCount:snapshot.gridRowCount,sourceAndMetadataFingerprint:snapshot.fingerprint,sourceFingerprintSchema:'notes-abc-notes-sha256-v1',validUntil:new Date(Date.now()+10*60*1000).toISOString(),atomic:false});
    if(target){const detail=JSON.parse(finish[19]);Object.assign(detail,{schema:2,scope:'Notes',target:target,jobId:options.jobId,requestId:options.requestId});finish[19]=JSON.stringify(detail);}
    if(evidence){const detail=JSON.parse(finish[19]);Object.assign(detail,{schema:4,protocol:'demand-v3',controlSchema:options.controlSchema,scope:options.scope,target:target,evidence:evidence,evidenceDigest:englishReviewDigest_(evidence),metadataCountScope:'target-id-or-planned-row-union-v1',metadataQueries:snapshot.queries,metadataQueryLimits:{perQuery:20,totalReturned:80},sourceAndMetadataFingerprintSchema:'notes-values-notes-target-metadata-sha256-v3',timing:timing});finish[19]=JSON.stringify(detail);}
    englishMetadataWrite_(sheet,end,[finish]);SpreadsheetApp.flush();
    if(JSON.stringify(sheet.getRange(end,1,1,20).getDisplayValues()[0])!==JSON.stringify(finish.map(String)))throw new Error('完成印の読戻しが一致しません。');
    // Commit one cell only after the payload and manifest have both been read back.
    if(Date.now()-clock>ENGLISH_METADATA_EXPORT_RUN_MS)throw new Error('完成印保存前に時間上限に達しました。未完成です。');
    guard();
    sheet.getRange(end,3,1,1).setRichTextValues([[SpreadsheetApp.newRichTextValue().setText('COMPLETE').build()]]);SpreadsheetApp.flush();
    const report={status:'COMPLETE',sheet:ENGLISH_METADATA_EXPORT_NAME,snapshotId:id,range:'A'+start+':T'+end,startedAt:started,completedAt:completed,notesLastRow:snapshot.lastRow,metadataCount:snapshot.metadata.length,records:records.length,notice:'取得時点の照合控えです。最新BEGINからCOMPLETEまでを再読し、10分以内でも保存直前に原文・行位置を照合してください。'};
    if(evidence){report.metadataCountScope='target-id-or-planned-row-union-v1';report.evidenceDigest=englishReviewDigest_(evidence);report.timing=timing;}console.log(JSON.stringify(report));return report;
  }catch(error){
    error.metadataTiming=timing;
    if(sheet&&id&&start){try{
      const failed=Array(20).fill('');failed[0]=id;failed[1]='ERROR';failed[2]='FAILED';failed[3]=new Date().toISOString();failed[19]='このsnapshotは未完成です。古い完成snapshotへ戻さず再実行してください。';
      const row=sheet.getLastRow()+1;englishMetadataEnsureRows_(sheet,row);englishMetadataWrite_(sheet,row,[failed]);SpreadsheetApp.flush();
    }catch(_){} }
    console.log(JSON.stringify({status:'FAILED',snapshotId:id,timing:timing,notice:'完成印だけで判断せず最新snapshot全体を確認してください。'}));throw error;
  }finally{if(lock)lock.releaseLock();}
}
