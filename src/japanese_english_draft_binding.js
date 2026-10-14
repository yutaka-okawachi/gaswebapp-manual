/** New Notes drafts only. Source tags/registry are bound by the explicit PC menu.
 * No timer, cloud control, existing candidate, source value or adoption writes. */
const ENGLISH_DRAFT_MODE='deferred-notes-v1';
const ENGLISH_DRAFT_WAIT='元行の結合確認待ち';
function englishDraftSnapshotsDetached_(){return true;}
function englishDraftPlan_(row){
  let r;try{r=JSON.parse(row[17]);}catch(_){return null;}
  const b=r&&r.binding;
  if(!b||b.schema!==1||b.mode!==ENGLISH_DRAFT_MODE)return null;
  if(!/^EN-\d{6}$/.test(row[0])||Number(row[0].slice(3))<444||Number(row[0].slice(3))>989||row[12]!=='Notes'||
    !Number.isSafeInteger(b.sourceSheetId)||b.sourceSheetId<0||!Number.isSafeInteger(b.plannedRow)||b.plannedRow<2||b.plannedRow>30000||String(b.plannedRow)!==row[13]||
    !Array.isArray(r.row)||!Array.isArray(r.notes)||r.row.length!==3||r.notes.length!==3||r.row.concat(r.notes).some(function(v){return typeof v!=='string';})||
    !r.row[0]||row[1]!==r.row[0]||row[2]!==r.row[1]||row[14]!==r.row[2]||!/^[a-f0-9]{64}$/.test(b.sourceFingerprint)||
    englishReviewDigest_({row:r.row,notes:r.notes})!==b.sourceFingerprint)return null;
  return {row:r.row,notes:r.notes,binding:b};
}
function englishDraftProperty_(book,id){return 'english-draft-binding:'+book+':'+id;}
function englishDraftReceipt_(book,id){
  const raw=PropertiesService.getScriptProperties().getProperty(englishDraftProperty_(book,id));
  if(!raw)return null;try{return JSON.parse(raw);}catch(_){throw new Error('元行結合の保全記録が不正です。');}
}
// A partially bound Q is never enough to bypass the user's binding operation.
function englishDraftUnbound_(book,row){
  let r;try{r=JSON.parse(row[17]);}catch(_){return false;}
  if(!r||!r.binding||r.binding.mode!==ENGLISH_DRAFT_MODE)return false;
  const p=englishDraftReceipt_(book,row[0]);
  return !p||p.stage!=='BOUND'||String(p.metadataId)!==row[16];
}
function englishDraftMeasured_(name,fn){return typeof englishManualMeasure_==='function'?englishManualMeasure_(name,fn):fn();}
function englishDraftCells_(sheet,row,width){return englishDraftMeasured_('validation',function(){const r=sheet.getRange(row,1,1,width);return {values:r.getDisplayValues()[0],formulas:r.getFormulas()[0],notes:r.getNotes()[0]};});}
function englishDraftRawHash_(cells,mobile){return englishReviewDigest_([cells.values.slice(0,26),cells.formulas.slice(0,26),cells.notes.slice(0,26),false,false,mobile,{values:cells.values.slice(26),formulas:cells.formulas.slice(26),notes:cells.notes.slice(26)}]);}
function englishDraftSaveReceipt_(props,key,p){if(typeof legacyEnglishBindingsRetired_==='function'&&legacyEnglishBindingsRetired_())throw new Error('旧対応付けは廃止済みです。再作成しません。');return englishDraftMeasured_('saveFlush',function(){const raw=JSON.stringify(p);if(raw.length>7500)throw new Error('結合記録の上限です。');props.setProperty(key,raw);if(props.getProperty(key)!==raw)throw new Error('結合記録の保存読戻しが不一致です。');});}
function englishDraftRegistry_(row,plan,metadataId,number){
  const v=Array(24).fill(''),f=Array(24).fill('');
  v[0]=row[0];v[1]='Notes';v[3]=row[1];v[4]=row[2];v[6]='未着手';v[7]='本人メニューで元行結合。採用は日英修正案で確認。';v[10]=row[14];v[11]=String(plan.binding.plannedRow);v[12]=v[11];v[18]=row[19];v[19]=String(metadataId);v[20]=JSON.stringify({row:plan.row,notes:plan.notes});
  f[2]='=IF($M'+number+'<2,"要照合",IF(AND(EXACT(INDEX(Notes!$A:$A,$M'+number+'),$D'+number+'),EXACT(INDEX(Notes!$B:$B,$M'+number+'),$E'+number+'),EXACT(INDEX(Notes!$C:$C,$M'+number+'),$K'+number+')),"一致","原文更新・再確認"))';
  f[8]='=IF($M'+number+'>0,INDEX(Notes!$B:$B,$M'+number+'),"")';
  f[9]='=IF($C'+number+'<>"一致","再確認が必要",IF($G'+number+'="採用",IF(LEN(TRIM($F'+number+'))>0,"有効（本番未反映）","英訳未入力"),"未採用"))';
  return {values:v,formulas:f,notes:Array(24).fill('')};
}
function englishDraftSameRegistry_(actual,expected){return actual.values.every(function(v,i){return expected.formulas[i]?actual.formulas[i]===expected.formulas[i]:!actual.formulas[i]&&v===expected.values[i];})&&JSON.stringify(actual.notes)===JSON.stringify(expected.notes);}
// Read the existing same-row completion receipts; never rewrite/clear them.
function englishDraftRetranslationReady_(ctx,number,cells){
  if(typeof englishRetranslationContext_!=='function')throw new Error('再英訳の完了照合が利用できません。');
  const c=englishRetranslationContext_(ctx.book),v=cells.values;
  if(!c||v[26]||!/^完了：/.test(v[27]))throw new Error('再英訳が完了していません。受付・履歴は保持します。');
  const r={row:number,values:v,formulas:cells.formulas,notes:cells.notes,key:v[0]+'/'+v[15],bodyDigest:englishReviewDigest_([v.slice(0,26),cells.formulas.slice(0,26),cells.notes.slice(0,26)])};
  const t=englishRetranslationTicket_(c,r),a=englishRetranslationJson_(v[29]);
  if(!a||v[29].length>4000||a.schema!==2||a.mode!=='same-row-v1'||a.phase!=='COMPLETE'||a.requestId!==t.requestId||a.requestDigest!==englishReviewDigest_(t)||
    !/^[-a-zA-Z0-9]{8,100}$/.test(a.operationId)||!Number.isSafeInteger(a.at)||a.at<t.at||a.at>Date.now()+60000||!englishRetranslationPlan_(r,t,a)||
    !englishRetranslationResult_(r,t,a,englishRetranslationReady_(c,r,t,a)))throw new Error('再英訳の完了・旧版・本文が一致しません。');
}
// Frames live for one cooperative stage only. Every resumed stage discards the
// previous frame, including after a write. Never persist these reads as authority.
function englishDraftFrameRead_(batch,name,read){
  if(!Object.prototype.hasOwnProperty.call(batch.frame,name))batch.frame[name]=
    typeof englishManualMeasure_==='function'?englishManualMeasure_('index',read):read();
  return batch.frame[name];
}
function englishDraftBindOne_(ctx,key,deadline,batch){
  if(batch)return englishDraftBindSteps_(ctx,key,deadline,batch);
  const single={frame:{},nextRegistry:0},steps=englishDraftBindSteps_(ctx,key,deadline,single);
  for(;;){single.frame={};const next=steps.next();if(next.done)return next.value;}
}
function* englishDraftBindSteps_(ctx,key,deadline,batch){
  yield;
  const props=PropertiesService.getScriptProperties(),legacy=englishReviewSheet_().sheet,id=key.split('/')[0],property=englishDraftProperty_(ctx.book.getId(),id);
  let rowNumber,original,expected,plan,receipt=englishDraftReceipt_(ctx.book.getId(),id);
  let expectedReceipt=props.getProperty(property)||'';
  function persist(){if((props.getProperty(property)||'')!==expectedReceipt)throw new Error('結合の保全記録が処理中に変わりました。');englishDraftSaveReceipt_(props,property,receipt);expectedReceipt=JSON.stringify(receipt);}
  const mobile=englishManualMobile_(key);
  function budget(){if(Date.now()>=deadline){const error=new Error('結合確認の時間上限です。未完了分から再開します。');error.englishDraftDeferred=true;throw error;}}
  function candidate(){
    if(englishManualMobile_(key)!==mobile)throw new Error('結合中にスマホの確認受付が変わりました。');
    budget();const ids=englishDraftFrameRead_(batch,'candidateIds',function(){const count=ctx.sheet.getLastRow()-4;return count?ctx.sheet.getRange(5,1,count,1).getDisplayValues():[];}),matches=[];
    ids.forEach(function(r,i){if(r[0]===id)matches.push(i+5);});if(matches.length!==1)throw new Error('候補IDが重複・移動・欠落しています。');
    const n=matches[0],a=englishDraftCells_(ctx.sheet,n,30);
    if(original&&n!==rowNumber)throw new Error('処理中に候補行が移動しました。');
    if(original&&JSON.stringify(a)!==JSON.stringify(expected))throw new Error('処理中に候補・判断・数式・メモが変わりました。');
    if(ctx.sheet.isRowHiddenByUser(n)||ctx.sheet.isRowHiddenByFilter(n))throw new Error('非表示の候補は結合しません。');
    return {number:n,cells:a};
  }
  const first=candidate();
  if(batch.frozenRaw){const raw=englishDraftRawHash_(first.cells,mobile);
    if(raw!==batch.frozenRaw[key])throw new Error('メニュー開始後に候補・判断・履歴・受付が変わりました。');}
  rowNumber=first.number;original=first.cells;expected=JSON.parse(JSON.stringify(original));plan=englishDraftPlan_(original.values);
  if(!plan||original.values[0]+'/'+original.values[15]!==key)throw new Error('下書きの出典・版・指紋が不正です。');
  const v=original.values,hasRetranslation=v.slice(26,30).some(Boolean);
  if(v[8]!=='確認待ち'||!['未確認','採用希望'].includes(v[9])||!['未確認','再確認が必要'].includes(v[24])||v.slice(20,24).some(Boolean)||
    original.formulas.some(function(f,i){return !!f&&!(receipt&&i===10);})||!v[3].trim()||!v[5].trim())throw new Error('保留・既存判断・確認記録・再英訳受付・数式は保持します。');
  const body={id:id,version:v[15],ja:v[3],en:v[5],italian:v[6],changes:v[4],evidence:v[7]};let saved;try{saved=JSON.parse(v[18]);}catch(_){}
  if(!saved||Object.keys(body).some(function(k){return saved[k]!==body[k];}))throw new Error('手編集された案を無断で結合しません。新版の控えを確認してください。');
  // Resume only this exact candidate; fields this operation owns may already match its planned result.
  const boundK='=IFERROR(IF(COUNTIF(\'英訳確認\'!$A:$A,$A'+rowNumber+')=1,INDEX(\'英訳確認\'!$C:$C,MATCH($A'+rowNumber+',\'英訳確認\'!$A:$A,0)),"要照合"),"要照合")';
  const boundZ='元行の結合確認済み（採用は未確認）';
  const initialZ=receipt?receipt.initialZ:v[25];
  const base=JSON.parse(JSON.stringify(original));base.values[10]=ENGLISH_DRAFT_WAIT;base.formulas[10]='';base.values[16]='';base.values[25]=initialZ;
  if(hasRetranslation)englishDraftRetranslationReady_(ctx,rowNumber,base);
  const digest=englishReviewDigest_(base);
  if(receipt){if(receipt.schema!==1||receipt.book!==ctx.book.getId()||receipt.id!==id||receipt.key!==key||receipt.digest!==digest||receipt.sourceFingerprint!==plan.binding.sourceFingerprint||receipt.sourceRow!==plan.binding.plannedRow||receipt.sourceSheetId!==plan.binding.sourceSheetId||!['INTENT','TAGGED','REGISTERED','BOUND'].includes(receipt.stage))throw new Error('以前の結合対象・手編集・版と一致しません。');
    if(typeof initialZ!=='string'||v[16]&&v[16]!==String(receipt.metadataId)||v[10]!==ENGLISH_DRAFT_WAIT&&original.formulas[10]!==boundK||![initialZ,boundZ].includes(v[25]))throw new Error('部分結合のセルが予定値と異なります。');
  }else if(v[16]||v[10]!==ENGLISH_DRAFT_WAIT||!hasRetranslation&&v[25]!==ENGLISH_DRAFT_WAIT)throw new Error('未結合下書きの状態が一致しません。');
  const notes=ctx.book.getSheetByName('Notes');if(!notes||notes.getSheetId()!==plan.binding.sourceSheetId)throw new Error('元タブの識別が一致しません。');
  function source(){
    budget();const data=englishDraftFrameRead_(batch,'notes',function(){
      const count=notes.getLastRow();if(count<2||count>30000)throw new Error('原文の件数が範囲外です。');
      const read=namedSheetRead_(notes,['de','ja','source'],1,count,'raw'),values=read.values,memo=read.notes,formulas=read.formulas,bySource=Object.create(null);
      if(JSON.stringify(values[0])!==JSON.stringify(['de','ja','source'])||values.some(function(row){return row.some(function(x){return typeof x!=='string';});})||formulas.some(function(row){return row.some(Boolean);}))throw new Error('原文の列・型・数式を確認してください。');
      values.forEach(function(row,i){if(i){const fingerprint=JSON.stringify({row:row,notes:memo[i]});(bySource[fingerprint]||(bySource[fingerprint]=[])).push(i+1);}});
      return {bySource:bySource,digest:englishReviewDigest_({values:values,notes:memo})};
    });
    const hits=data.bySource[JSON.stringify({row:plan.row,notes:plan.notes})]||[];
    if(hits.length!==1||hits[0]!==plan.binding.plannedRow)throw new Error('原文・日本語・補足の変更、行移動、同内容の別行を検出しました。推定結合しません。');
    budget();return data.digest;
  }
  const sourceState=source();
  function* checkSource(final){yield;if(final){delete batch.frame.notes;delete batch.frame.candidateIds;delete batch.frame.registryIds;}if((props.getProperty(property)||'')!==expectedReceipt)throw new Error('結合の保全記録が処理中に変わりました。');if(source()!==sourceState)throw new Error('結合処理中に原文が変わりました。');candidate();if(hasRetranslation)englishDraftRetranslationReady_(ctx,rowNumber,base);}
  function tags(){
    return englishDraftMeasured_('validation',function(){
    budget();const found=ctx.book.createDeveloperMetadataFinder().withKey(ENGLISH_REVIEW_METADATA_KEY).withValue(id).find();
    const atRow=notes.getRange(plan.binding.plannedRow,1,1,notes.getMaxColumns()).createDeveloperMetadataFinder().withKey(ENGLISH_REVIEW_METADATA_KEY).withLocationType(SpreadsheetApp.DeveloperMetadataLocationType.ROW).onIntersectingLocations().find();
    if(found.length>1||atRow.length>1)throw new Error('IDまたは予定元行のmetadataが重複しています。');
    if(!found.length){if(atRow.length)throw new Error('予定元行は別IDへ結合済みです。');return null;}
    const tag=found[0],loc=tag.getLocation().getRow();
    if(!loc||loc.getSheet().getSheetId()!==notes.getSheetId()||loc.getRow()!==plan.binding.plannedRow||atRow.length!==1||atRow[0].getId()!==tag.getId()||String(tag.getVisibility())!=='DOCUMENT')throw new Error('metadataの位置・可視性が不一致です。');
    if(!Number.isSafeInteger(tag.getId())||tag.getId()<1)throw new Error('metadata識別が不正です。');budget();return tag;
    });
  }
  function registryRows(){const a=englishDraftFrameRead_(batch,'registryIds',function(){const n=legacy.getLastRow()-1;return n?legacy.getRange(2,1,n,1).getDisplayValues():[];}),hits=[];a.forEach(function(r,i){if(r[0]===id)hits.push(i+2);});if(hits.length>1)throw new Error('旧registryのIDが重複しています。');return hits;}
  if(!englishReviewAutoLayout_(legacy,false))throw new Error('旧registryの管理列がありません。');
  let tag=tags(),registered=registryRows();
  if(!receipt){
    if(tag||registered.length)throw new Error('既存metadata・registryを新規下書きへ推定結合しません。');
    const registryRow=Math.max(legacy.getLastRow()+1,batch.nextRegistry);if(registryRow>20000)throw new Error('旧registryの追記上限です。');batch.nextRegistry=registryRow+1;
    receipt={schema:1,book:ctx.book.getId(),id:id,key:key,digest:digest,initialZ:initialZ,sourceFingerprint:plan.binding.sourceFingerprint,sourceSheetId:plan.binding.sourceSheetId,sourceRow:plan.binding.plannedRow,stage:'INTENT',registryRow:registryRow,metadataId:null};
    // A failure before TAGGED is saved is deliberately not auto-retried: a tag
    // may have been created even if its creation/readback response was lost.
    // Do not leave other staged candidates at INTENT before their own tag attempt.
    yield* checkSource();persist();
    if(tags()||registryRows().length)throw new Error('結合開始後に識別情報が変わりました。');candidate();
    const liveSource=namedSheetRead_(notes,['de','ja','source'],plan.binding.plannedRow,1,'raw');
    if(JSON.stringify({row:liveSource.values[0],notes:liveSource.notes[0]})!==JSON.stringify({row:plan.row,notes:plan.notes})||liveSource.formulas[0].some(Boolean))throw new Error('metadata作成直前に原文・補足が変わりました。');
    englishDraftMeasured_('saveFlush',function(){notes.getRange(plan.binding.plannedRow+':'+plan.binding.plannedRow).addDeveloperMetadata(ENGLISH_REVIEW_METADATA_KEY,id,SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT);});
    tag=tags();if(!tag)throw new Error('metadata作成の読戻しができません。');receipt.metadataId=tag.getId();receipt.stage='TAGGED';persist();
  }else if(receipt.stage==='INTENT')throw new Error('前回のmetadata作成結果が未確定です。再作成せず要確認。');
  if(!tag||tag.getId()!==receipt.metadataId)throw new Error('保存済みmetadata識別と一致しません。');
  yield* checkSource();const rr=receipt.registryRow,desired=englishDraftRegistry_(v,plan,receipt.metadataId,rr);
  registered=registryRows();if(registered.length&&registered[0]!==rr)throw new Error('旧registryの登録位置が変わりました。');
  if(rr>legacy.getMaxRows())legacy.insertRowsAfter(legacy.getMaxRows(),rr-legacy.getMaxRows());
  let actual=englishDraftCells_(legacy,rr,24);
  if(!englishDraftSameRegistry_(actual,desired)){
    if(actual.values.some(Boolean)||actual.formulas.some(Boolean)||actual.notes.some(Boolean))throw new Error('旧registryの追記先が使用中または部分保存です。上書きしません。');
    yield* checkSource();if(tags().getId()!==receipt.metadataId)throw new Error('登録前のmetadataが変わりました。');
    if(registryRows().length||!englishDraftSameRegistry_(englishDraftCells_(legacy,rr,24),actual))throw new Error('登録直前に旧registryの追記先・IDが変わりました。');
    const values=desired.values.map(function(x,i){return desired.formulas[i]||x;});
    // Literal source strings are written as rich text; formulas only to C/I/J.
    englishDraftMeasured_('saveFlush',function(){legacy.getRange(rr,1,1,24).setRichTextValues([desired.values.map(function(x){return SpreadsheetApp.newRichTextValue().setText(x).build();})]);
    [3,9,10].forEach(function(col){legacy.getRange(rr,col,1,1).setFormula(values[col-1]);});SpreadsheetApp.flush();});
    actual=englishDraftCells_(legacy,rr,24);if(!englishDraftSameRegistry_(actual,desired))throw new Error('旧registryの保存読戻しが一致しません。');
  }
  yield* checkSource();if(tags().getId()!==receipt.metadataId||registryRows()[0]!==rr)throw new Error('結合後の識別情報が変わりました。');
  receipt.stage='REGISTERED';persist();
  function* put(col,text,formula){yield* checkSource();englishDraftMeasured_('saveFlush',function(){if(formula){ctx.sheet.getRange(rowNumber,col,1,1).setFormula(text);expected.formulas[col-1]=text;expected.values[col-1]=ctx.sheet.getRange(rowNumber,col,1,1).getDisplayValues()[0][0];}else{englishProposalWrite_(ctx.sheet,rowNumber,col,[text]);expected.values[col-1]=text;}SpreadsheetApp.flush();});candidate();}
  if(v[16]!==String(receipt.metadataId))yield* put(17,String(receipt.metadataId));
  if(expected.formulas[10]!==boundK)yield* put(11,boundK,true);
  if(expected.values[25]!==boundZ)yield* put(26,boundZ);
  // Each BOUND commit gets its own fresh global uniqueness/source check. Sharing
  // earlier stage reads must not hide a change made while another row commits.
  yield* checkSource(true);if(tags().getId()!==receipt.metadataId||registryRows()[0]!==rr||!englishDraftSameRegistry_(englishDraftCells_(legacy,rr,24),desired))throw new Error('結合完了前の再照合が不一致です。');
  receipt.stage='BOUND';persist();
  (batch.completedRaw||(batch.completedRaw=Object.create(null)))[key]=englishDraftRawHash_(expected,mobile);return true;
}
// Called only inside the PC menu's ScriptLock + DocumentLock and frozen <=50 keys.
function englishDraftBindChosen_(ctx,chosen,menuBindingDeadline,frozenRaw){
  const deadline=Math.min(Date.now()+90000,Number.isFinite(menuBindingDeadline)?menuBindingDeadline:Infinity);let failed=0,reason='',limited=false;const results=[],selected=[],groups=[],batch={frame:{},nextRegistry:0,frozenRaw:frozenRaw||null};
  chosen.slice().sort(function(a,b){return a.row-b.row;}).forEach(function(r){const last=groups[groups.length-1];if(last&&last[last.length-1].row+1===r.row)last.push(r);else groups.push([r]);});
  const rows=Object.create(null);groups.forEach(function(g){ctx.sheet.getRange(g[0].row,1,g.length,30).getDisplayValues().forEach(function(v,i){rows[g[i].key]=v;});});
  for(const entry of chosen){
    if(selected.length>=5||Date.now()>=deadline){limited=true;break;}
    const v=rows[entry.key],plan=englishDraftPlan_(v);
    if(!plan||v[0]+'/'+v[15]!==entry.key||!englishDraftUnbound_(ctx.book.getId(),v)||v[8]!=='確認待ち'||!['未確認','採用希望'].includes(v[9]))continue;
    if(ctx.sheet.isRowHiddenByUser(entry.row)||ctx.sheet.isRowHiddenByFilter(entry.row))continue;
    selected.push(entry);const old=englishDraftReceipt_(ctx.book.getId(),entry.id);if(old&&Number.isSafeInteger(old.registryRow)&&old.registryRow>=2&&old.registryRow<=20000)batch.nextRegistry=Math.max(batch.nextRegistry,old.registryRow+1);
  }
  const jobs=selected.map(function(entry){return {entry:entry,steps:englishDraftBindOne_(ctx,entry.key,deadline,batch),done:false};});
  while(jobs.some(function(j){return !j.done;})){
    batch.frame={};
    for(const job of jobs){if(job.done)continue;const entry=job.entry;
    try{const next=job.steps.next();if(next.done){job.done=true;results.push({key:entry.key,status:'bound',rawHash:batch.completedRaw&&batch.completedRaw[entry.key]});}}catch(error){
      job.done=true;
      // A time limit is a continuation, except an uncertain metadata creation:
      // INTENT must still be inspected and must never create a second tag.
      let receipt=null;try{receipt=englishDraftReceipt_(ctx.book.getId(),entry.id);}catch(changed){error=changed;}
      const pending=error.englishDraftDeferred===true&&(!receipt||receipt.stage!=='INTENT');
      reason=pending?'':String(error.message).slice(0,120);
      if(error.englishDraftDeferred===true&&receipt&&receipt.stage==='INTENT')reason='metadata作成結果が未確定です。再作成せず要確認。';
      if(pending)limited=true;else failed++;
      results.push({key:entry.key,status:pending?'pending':'failed',reason:reason});
      if(error.englishDraftDeferred===true){jobs.forEach(function(j){if(!j.done){let saved,bad=false;try{saved=englishDraftReceipt_(ctx.book.getId(),j.entry.id);}catch(_){bad=true;}if(bad||saved&&saved.stage==='INTENT'){failed++;results.push({key:j.entry.key,status:'failed',reason:bad?'結合の保全記録が不正です。':'metadata作成結果が未確定です。再作成せず要確認。'});}else results.push({key:j.entry.key,status:'pending',reason:''});j.done=true;}});break;}
    }
    }
  }
  return {attempted:selected.length,failed:failed,reason:reason,limited:limited,results:results};
}
