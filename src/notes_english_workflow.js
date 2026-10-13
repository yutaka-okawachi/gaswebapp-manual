/** Private Notes draft workflow. Only validated English results write Notes F; no production source writes. */
const NOTES_ENGLISH_PROPERTY='notes-english-workflow-v1';
const NOTES_ENGLISH_META='NOTES_ENGLISH_ROW_V1';
const NOTES_ENGLISH_LEDGER='Notes英訳内部履歴';
const NOTES_ENGLISH_MARKER='notes-english-ledger-v1';
const NOTES_ENGLISH_HEADERS=['記録JSON'].concat('ABCDEFGHI'.split('').map(function(c){return 'Notes '+c;}),
  'ABCDEFGHI'.split('').map(function(c){return 'Notes '+c+' メモ';}),
  'ABCDEFGHI'.split('').map(function(c){return 'Notes '+c+' 数式';}),['結果英訳','結果根拠','結果保留理由','応答JSON']);
const NOTES_ENGLISH_MAX_ROWS=20000;
const NOTES_ENGLISH_SETTLE_MS=120000;
function notesEnglishHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value),Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function notesEnglishJson_(text){try{return JSON.parse(text);}catch(_){return null;}}
function notesEnglishConfig_(){
  const raw=PropertiesService.getScriptProperties().getProperty(NOTES_ENGLISH_PROPERTY);if(!raw)return null;
  const c=notesEnglishJson_(raw);
  if(!c||c.schema!==1||!c.book||!Number.isSafeInteger(c.sheet)||!Number.isSafeInteger(c.ledger)||!['PREPARING','ACTIVE'].includes(c.phase))throw new Error('Notes英訳の設定が不正です。自動修復せず停止しました。');
  return c;
}
function notesEnglishOwns_(){return !!notesEnglishConfig_();}
function notesEnglishLegacyGuard_(){if((typeof legacyEnglishBindingsRetired_==='function'&&legacyEnglishBindingsRetired_())||notesEnglishOwns_())throw new Error('Notes方式へ切替中または旧方式を廃止済みです。旧2タブの更新を止めています。Notesのメニューを使用してください。');}
function notesEnglishLock_(fn){
  const script=LockService.getScriptLock(),doc=LockService.getDocumentLock();let a=false,b=false;
  try{a=script&&script.tryLock(1);if(!a)throw new Error('別の処理中です。少し待って再実行してください。');b=doc&&doc.tryLock(1);if(!b)throw new Error('別の保存処理中です。再実行してください。');return fn();}
  finally{if(b)doc.releaseLock();if(a)script.releaseLock();}
}
function notesEnglishBook_(){
  const expected=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(!expected)throw new Error('対象ブックが設定されていません。');
  const book=SpreadsheetApp.getActiveSpreadsheet()||SpreadsheetApp.openById(expected);
  if(!book||book.getId()!==expected)throw new Error('対象ブックが設定と一致しません。');return book;
}
function notesEnglishContext_(allowDirect){
  const book=notesEnglishBook_(),c=notesEnglishConfig_();if(!c||c.book!==book.getId())throw new Error('Notes英訳の準備を先に実行してください。');
  if(c.mode==='direct-english-v2'&&!allowDirect)throw new Error('直接英訳へ切替済みです。旧ダイアログ・履歴処理は使用できません。');
  const sheet=book.getSheetByName('Notes'),ledger=book.getSheetByName(NOTES_ENGLISH_LEDGER);
  if(!sheet||sheet.getSheetId()!==c.sheet||sheet.getMaxColumns()<9||!ledger||ledger.getSheetId()!==c.ledger||ledger.getMaxColumns()!==32||
    ledger.getRange(1,1).getDisplayValues()[0][0]!==NOTES_ENGLISH_MARKER||JSON.stringify(ledger.getRange(2,1,1,32).getDisplayValues()[0])!==JSON.stringify(NOTES_ENGLISH_HEADERS))throw new Error('Notesまたは内部履歴の構成が変わっています。');
  if(sheet.getLastRow()>NOTES_ENGLISH_MAX_ROWS||ledger.getLastRow()>NOTES_ENGLISH_MAX_ROWS)throw new Error('Notes英訳の件数上限です。');
  return {book:book,sheet:sheet,ledger:ledger,config:c};
}
function notesEnglishWrite_(range,values){
  if(values.some(function(v){return typeof v!=='string'||v.length>45000;}))throw new Error('履歴のセル上限を超えています。切り詰めず停止しました。');
  range.setRichTextValues([values.map(function(v){return SpreadsheetApp.newRichTextValue().setText(v).build();})]);
}
// A full grid-width rectangle is still column-bounded. Metadata needs an actual ROW range.
function notesEnglishMetadataRowRange_(sheet,row){
  if(!Number.isSafeInteger(row)||row<2||row>sheet.getMaxRows())throw new Error('行IDの対象行が不正です。');
  const range=sheet.getRange(row+':'+row);
  if(range.getRow()!==row||range.getNumRows()!==1||range.isStartColumnBounded()||range.isEndColumnBounded())throw new Error('行IDの対象が行全体ではありません。');
  return range;
}
function notesEnglishSnapshot_(sheet,row){
  const range=sheet.getRange(row,1,1,9),v=range.getDisplayValues()[0],n=range.getNotes()[0],f=range.getFormulas()[0];
  if(v.concat(n,f).some(function(x){return typeof x!=='string'||x.length>45000;}))throw new Error('Notesのセルを安全に固定できません。');
  return {values:v,notes:n,formulas:f,digest:notesEnglishHash_([v,n,f]),source:notesEnglishHash_([v.slice(0,3),n.slice(0,3),f.slice(0,3)])};
}
function notesEnglishIndex_(ctx){
  const byId=Object.create(null),byRow=Object.create(null);
  ctx.book.createDeveloperMetadataFinder().withKey(NOTES_ENGLISH_META).find().forEach(function(tag){
    const loc=tag.getLocation().getRow();if(!loc||loc.getSheet().getSheetId()!==ctx.sheet.getSheetId())throw new Error('Notes行IDの場所が不正です。');
    const id=tag.getValue(),row=loc.getRow();if(!/^NE-[a-f0-9-]{36}$/.test(id)||row<2||byId[id]||byRow[row])throw new Error('Notes行IDが不正または重複しています。');
    byId[id]=row;byRow[row]=id;
  });return {byId:byId,byRow:byRow};
}
function notesEnglishRecords_(ctx){
  const count=Math.max(0,ctx.ledger.getLastRow()-2);if(!count)return [];
  const range=ctx.ledger.getRange(3,1,count,32),values=range.getDisplayValues(),formulas=range.getFormulas();
  const revisions=Object.create(null),events=new Set(),requests=new Set();
  return values.map(function(v,i){
    if(formulas[i].some(Boolean))throw new Error('内部履歴に数式があります。');
    const e=notesEnglishJson_(v[0]);
    if(!e||e.schema!==1||e.mode!=='notes-v1'||!['BASE','OBSERVE','REQUEST','RESERVED','STAGED','WRITE_INTENT','WRITTEN','HOLD','CONFLICT','COPIED','CONFIRMED'].includes(e.kind)||
      !/^NE-[a-f0-9-]{36}$/.test(e.id)||!/^[-a-f0-9]{36}$/.test(e.eventId)||e.sheetId!==ctx.sheet.getSheetId()||!Number.isSafeInteger(e.at)||
      !Number.isSafeInteger(e.revision)||e.revision!==(revisions[e.id]||0)+1||events.has(e.eventId)||
      e.sourceDigest!==notesEnglishHash_([v.slice(1,4),v.slice(10,13),v.slice(19,22)])||
      e.snapshotDigest!==notesEnglishHash_([v.slice(1,10),v.slice(10,19),v.slice(19,28)]))throw new Error('内部履歴が不正または途中保存です。行 '+(i+3)+' を確認してください。');
    if(['REQUEST','RESERVED'].includes(e.kind)&&(!/^[-a-f0-9]{36}$/.test(e.requestId)||!Number.isSafeInteger(e.notBefore)||e.notBefore<1))throw new Error('依頼ID・待ち時間が不正です。');
    if(e.kind==='REQUEST'){if(requests.has(e.requestId))throw new Error('依頼IDが重複しています。');requests.add(e.requestId);}
    revisions[e.id]=e.revision;events.add(e.eventId);
    return {row:i+3,event:e,values:v,snapshot:{values:v.slice(1,10),notes:v.slice(10,19),formulas:v.slice(19,28),digest:e.snapshotDigest,source:e.sourceDigest}};
  });
}
function notesEnglishLatest_(records,id){const rows=records.filter(function(r){return r.event.id===id;});return rows.length?rows[rows.length-1]:null;}
function notesEnglishAppend_(ctx,records,id,kind,snapshot,extra,result){
  const latest=notesEnglishLatest_(records,id),e=Object.assign({schema:1,mode:'notes-v1',kind:kind,eventId:Utilities.getUuid(),id:id,sheetId:ctx.sheet.getSheetId(),
    revision:latest?latest.event.revision+1:1,at:Date.now(),snapshotDigest:snapshot.digest,sourceDigest:snapshot.source},extra||{});
  const values=[JSON.stringify(e)].concat(snapshot.values,snapshot.notes,snapshot.formulas,result||['','','','']);
  if(values.length!==32)throw new Error('内部履歴の列数が不正です。');
  const row=ctx.ledger.getLastRow()+1;if(row>NOTES_ENGLISH_MAX_ROWS)throw new Error('内部履歴が上限です。');
  if(row>ctx.ledger.getMaxRows())ctx.ledger.insertRowsAfter(ctx.ledger.getMaxRows(),Math.min(500,NOTES_ENGLISH_MAX_ROWS-ctx.ledger.getMaxRows()));
  const range=ctx.ledger.getRange(row,1,1,32);
  if(range.getDisplayValues()[0].some(Boolean)||range.getFormulas()[0].some(Boolean)||range.getNotes()[0].some(Boolean))throw new Error('履歴の追記先が空欄ではありません。');
  notesEnglishWrite_(range,values);SpreadsheetApp.flush();
  if(JSON.stringify(range.getDisplayValues()[0])!==JSON.stringify(values)||range.getFormulas()[0].some(Boolean))throw new Error('内部履歴の読戻し不一致です。自動再試行しません。');
  const record={row:row,event:e,values:values,snapshot:snapshot};records.push(record);return record;
}
// I is a user-managed sheet status. Its approval never approves a newly generated English revision.
function notesEnglishRequestable_(snapshot){return ['確認待ち','承認'].includes(snapshot.values[8])&&!!snapshot.values[0].trim()&&!!snapshot.values[3].trim()&&!snapshot.formulas.some(Boolean);}
// Preparation is explicit and bounded. Existing drafts are baselines, not 988 automatic requests.
function prepareNotesEnglishWorkflow(){
  if(typeof sourceEnglishDirect_==='function'&&sourceEnglishDirect_())throw new Error('直接英訳へ切替済みです。旧初期化は使用できません。');
  const outcome=notesEnglishLock_(function(){
    const book=notesEnglishBook_(),sheet=book.getSheetByName('Notes');if(!sheet||sheet.getMaxColumns()<9)throw new Error('Notes A:Iを先に準備してください。');
    let config=notesEnglishConfig_();
    if(!config){
      // Migration-only dependency: refuse cutover while the old writer has acknowledged work.
      const old=book.getSheetByName('日英修正案');
      if(old&&old.getMaxColumns()>=30&&old.getLastRow()>4&&old.getRange(5,28,old.getLastRow()-4,1).getDisplayValues().some(function(r){return /^(受付|処理中)/.test(r[0]);}))throw new Error('旧方式に未完了の受付があります。先にwriterと処理状況を整理してください。');
      if(book.getSheetByName(NOTES_ENGLISH_LEDGER))throw new Error('同名の内部タブがあります。内容を確認せず再利用しません。');
      const ledger=book.insertSheet(NOTES_ENGLISH_LEDGER);if(ledger.getMaxColumns()<32)ledger.insertColumnsAfter(ledger.getMaxColumns(),32-ledger.getMaxColumns());
      notesEnglishWrite_(ledger.getRange(1,1,1,1),[NOTES_ENGLISH_MARKER]);notesEnglishWrite_(ledger.getRange(2,1,1,32),NOTES_ENGLISH_HEADERS);ledger.hideSheet();SpreadsheetApp.flush();
      config={schema:1,book:book.getId(),sheet:sheet.getSheetId(),ledger:ledger.getSheetId(),phase:'PREPARING'};
      PropertiesService.getScriptProperties().setProperty(NOTES_ENGLISH_PROPERTY,JSON.stringify(config));
    }
    const ctx=notesEnglishContext_(),index=notesEnglishIndex_(ctx),records=notesEnglishRecords_(ctx),started=Date.now();let added=0,remaining=0;
    const drafts=sheet.getLastRow()>1?sheet.getRange(2,4,sheet.getLastRow()-1,1).getDisplayValues():[];
    for(let row=2;row<=sheet.getLastRow();row++){
      if(!drafts[row-2][0].trim())continue;
      let id=index.byRow[row];if(id&&notesEnglishLatest_(records,id))continue;
      if(added>=25||Date.now()-started>15000){remaining++;continue;}
      if(!id){id='NE-'+Utilities.getUuid();notesEnglishMetadataRowRange_(sheet,row).addDeveloperMetadata(NOTES_ENGLISH_META,id,SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT);SpreadsheetApp.flush();
        const fresh=notesEnglishIndex_(ctx);if(fresh.byId[id]!==row)throw new Error('行IDの保存場所が不一致です。');}
      notesEnglishAppend_(ctx,records,id,'BASE',notesEnglishSnapshot_(sheet,row));added++;
    }
    if(!remaining&&config.phase==='PREPARING'){config.phase='ACTIVE';PropertiesService.getScriptProperties().setProperty(NOTES_ENGLISH_PROPERTY,JSON.stringify(config));}
    return {added:added,remaining:remaining,phase:config.phase};
  });
  return outcome;
}
function notesEnglishObserve_(ctx,records,index,id,reason){
  const row=index.byId[id];if(!row)return null;const current=notesEnglishSnapshot_(ctx.sheet,row),last=notesEnglishLatest_(records,id);
  if(!last)return notesEnglishAppend_(ctx,records,id,'BASE',current);
  if(current.digest===last.snapshot.digest){
    if(reason==='EDIT'&&['REQUEST','RESERVED','STAGED','WRITE_INTENT','WRITTEN','COPIED','CONFIRMED'].includes(last.event.kind))return notesEnglishAppend_(ctx,records,id,'OBSERVE',current,{reason:'編集イベントを検出。元の値へ戻っていても以前の依頼・確認は再利用しません。'});
    return last;
  }
  const old=last.snapshot,jaChanged=current.values[3]!==old.values[3]||current.notes[3]!==old.notes[3]||current.formulas[3]!==old.formulas[3];
  if(last.event.kind==='WRITE_INTENT')return notesEnglishAppend_(ctx,records,id,'CONFLICT',current,{requestId:last.event.requestId,reason:'F保存の完了記録がありません。履歴と現行Fを確認してください。自動再保存しません。'},last.values.slice(28,32));
  const fChanged=current.values[5]!==old.values[5]||current.notes[5]!==old.notes[5]||current.formulas[5]!==old.formulas[5];
  // Matching a staged English value is not adoption; every other cell must still match.
  const expected=old.values.slice();if(last.event.kind==='STAGED')expected[5]=last.values[28];
  if(last.event.kind==='STAGED'&&current.digest===notesEnglishHash_([expected,old.notes,old.formulas]))return notesEnglishAppend_(ctx,records,id,'COPIED',current,{requestId:last.event.requestId,resultDigest:last.event.resultDigest,reason:'本人によるF貼付けを照合。未採用。'});
  const eligible=jaChanged&&!fChanged&&current.source===old.source&&notesEnglishRequestable_(current);
  return notesEnglishAppend_(ctx,records,id,eligible?'REQUEST':'OBSERVE',current,{requestId:eligible?Utilities.getUuid():'',notBefore:eligible?Date.now()+NOTES_ENGLISH_SETTLE_MS:0,
    reason:eligible?'D変更。未採用。':(fChanged?'F手修正を保持。':current.values[8]==='保留'?'保留を保持。':'原文・補足・状態等の変更。再確認が必要。')+(reason&&reason!=='EDIT'?reason:'')});
}
function notesEnglishEdited_(e){
  const range=e&&e.range;if(!range)return false;
  if(typeof legacyEnglishBindingsRetired_==='function'&&legacyEnglishBindingsRetired_()&&['日英修正案','英訳確認'].includes(range.getSheet().getName()))return true;
  if(!notesEnglishOwns_())return false;
  const name=range.getSheet().getName();if(['日英修正案','英訳確認'].includes(name))return true;
  if(name!=='Notes')return false;
  if(typeof sourceEnglishDirect_==='function'&&sourceEnglishDirect_())return sourceEnglishEdited_(e);
  if(range.getLastRow()<2||range.getColumn()>9)return true;
  try{notesEnglishLock_(function(){const ctx=notesEnglishContext_();if(ctx.config.phase!=='ACTIVE')return;
    const index=notesEnglishIndex_(ctx),records=notesEnglishRecords_(ctx),first=Math.max(2,range.getRow()),last=range.getLastRow(),started=Date.now();let processed=0;
    for(let row=first;row<=last;row++){if(processed>=20||Date.now()-started>8000)break;const id=index.byRow[row];if(id){notesEnglishObserve_(ctx,records,index,id,'EDIT');processed++;}}
  });}catch(_){try{e.source.toast('Notes英訳の受付を完了できませんでした。状態確認メニューで再照合してください。入力は保持しています。','Notes英訳',8);}catch(ignore){}}
  return true;
}
function notesEnglishResponse_(request){
  const v=request.values,a=notesEnglishJson_(v[31]);if(!v.slice(28).some(Boolean))return null;
  if(!a||a.schema!==1||a.mode!=='notes-v1'||a.requestId!==request.event.requestId||a.requestDigest!==notesEnglishHash_(request.event)||
    !['READY','HOLD'].includes(a.status)||typeof a.operationId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(a.operationId)||
    typeof a.engine!=='string'||!a.engine||a.engine.length>100||!Number.isSafeInteger(a.at)||a.at<request.event.at||a.at>Date.now()+60000||
    a.resultDigest!==notesEnglishHash_(v.slice(28,31))||v.slice(28,31).some(function(x){return x.length>45000;})||
    (a.status==='READY'&&(!v[28].trim()||!v[29].trim()||v[30]))||(a.status==='HOLD'&&!v[30].trim()))throw new Error('応答が未完成または受付と不一致です。Fへ反映しません。');
  return a;
}
function notesEnglishAccept_(ctx,records,index,id){
  let latest=notesEnglishLatest_(records,id);if(!latest||!['REQUEST','RESERVED'].includes(latest.event.kind))return;
  const row=index.byId[id];if(!row)return;
  const current=notesEnglishSnapshot_(ctx.sheet,row);
  if(current.digest!==latest.snapshot.digest){notesEnglishObserve_(ctx,records,index,id,'');return;}
  if(Date.now()<latest.event.notBefore||!notesEnglishRequestable_(current))return;
  // Re-read the entire request after reading Notes. The external writer never touches Notes.
  latest=notesEnglishRecords_(ctx).find(function(r){return r.event.eventId===latest.event.eventId;});
  const response=notesEnglishResponse_(latest);if(!response)return;
  const again=notesEnglishSnapshot_(ctx.sheet,notesEnglishIndex_(ctx).byId[id]);
  if(again.digest!==current.digest)throw new Error('応答確認中にNotesが変わりました。結果は保留しています。');
  const staged=notesEnglishAppend_(ctx,records,id,response.status==='READY'?'STAGED':'HOLD',again,{requestId:latest.event.requestId,resultDigest:response.resultDigest,
    operationId:response.operationId,reason:response.status==='READY'?'F反映前の結果・旧Fを保全。未採用。':'翻訳側で保留。Iは未変更。'},latest.values.slice(28,32));
  if(response.status==='READY')notesEnglishApply_(ctx,records,staged);
}
function notesEnglishApply_(ctx,records,staged){
  const id=staged.event.id,index=notesEnglishIndex_(ctx),row=index.byId[id];if(!row)throw new Error('反映対象の行IDが失われました。');
  const before=notesEnglishSnapshot_(ctx.sheet,row);
  if(before.digest!==staged.snapshot.digest||!notesEnglishRequestable_(before))throw new Error('F反映前に内容が変わりました。結果は保留しています。');
  // Preserve old F and the planned result before any write. Never retry an uncertain WRITE_INTENT.
  const intent=notesEnglishAppend_(ctx,records,id,'WRITE_INTENT',before,{requestId:staged.event.requestId,resultDigest:staged.event.resultDigest,
    operationId:staged.event.operationId,reason:'旧Fと結果を保存済み。F反映の開始記録。'},staged.values.slice(28,32));
  const currentIndex=notesEnglishIndex_(ctx),currentRow=currentIndex.byId[id];
  const fresh=currentRow?notesEnglishSnapshot_(ctx.sheet,currentRow):null;
  if(!fresh||currentRow!==row||fresh.digest!==before.digest){
    if(fresh)notesEnglishAppend_(ctx,records,id,'CONFLICT',fresh,{requestId:intent.event.requestId,reason:'保存直前に内容・行位置が変わりました。Fは書き換えていません。'},intent.values.slice(28,32));
    throw new Error('保存直前の競合で停止しました。');
  }
  // This is a checked write, NOT a compare-and-swap. Human/API edits do not honor GAS locks.
  notesEnglishWrite_(ctx.sheet.getRange(row,6,1,1),[staged.values[28]]);SpreadsheetApp.flush();
  const finalIndex=notesEnglishIndex_(ctx),finalRow=finalIndex.byId[id];if(!finalRow)throw new Error('F保存後に対象行を確認できません。自動再保存しません。');
  const after=notesEnglishSnapshot_(ctx.sheet,finalRow),expected=before.values.slice();expected[5]=staged.values[28];
  if(finalRow!==row||after.digest!==notesEnglishHash_([expected,before.notes,before.formulas])){
    notesEnglishAppend_(ctx,records,id,'CONFLICT',after,{requestId:intent.event.requestId,reason:'保存後の内容・位置が不一致。旧Fと結果を保持し、自動復元・再保存しません。'},intent.values.slice(28,32));return;
  }
  notesEnglishAppend_(ctx,records,id,'WRITTEN',after,{requestId:intent.event.requestId,resultDigest:intent.event.resultDigest,operationId:intent.event.operationId,
    reason:'Fへ改訂英訳を保存・読戻し済み。本人未確認、本番未反映。'},intent.values.slice(28,32));
}
// No new trigger. Menu/dialog callers can reconcile API edits and missed edit events in chunks.
function reconcileNotesEnglishWorkflow(){return notesEnglishLock_(function(){
  const ctx=notesEnglishContext_();if(ctx.config.phase!=='ACTIVE')return {phase:ctx.config.phase,processed:0};
  const index=notesEnglishIndex_(ctx),records=notesEnglishRecords_(ctx),ids=Object.keys(index.byId),props=PropertiesService.getScriptProperties(),key='notes-english-cursor-v1';
  let cursor=Number(props.getProperty(key)||0);if(!Number.isSafeInteger(cursor)||cursor<0)cursor=0;
  const start=Date.now();let n=0;while(n<ids.length&&n<20&&Date.now()-start<10000){const id=ids[(cursor+n)%ids.length];notesEnglishObserve_(ctx,records,index,id,'');notesEnglishAccept_(ctx,records,index,id);n++;}
  props.setProperty(key,String((cursor+n)%Math.max(1,ids.length)));return {phase:'ACTIVE',processed:n,total:ids.length};
});}
function showNotesEnglishWorkflow(){notesEnglishBook_();SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('notes_english_dialog').setWidth(1050).setHeight(780),'Notes 改訂英訳');}
function getNotesEnglishWorkflow(id){return notesEnglishLock_(function(){
  if(!notesEnglishConfig_())return {phase:'UNPREPARED',entries:[],record:null};
  const ctx=notesEnglishContext_(),index=notesEnglishIndex_(ctx),records=notesEnglishRecords_(ctx);
  const ids=Object.keys(index.byId);if(id&&(!/^NE-[a-f0-9-]{36}$/.test(id)||!index.byId[id]))throw new Error('対象行が移動・削除・変更されています。');
  if(id){notesEnglishObserve_(ctx,records,index,id,'');notesEnglishAccept_(ctx,records,index,id);}
  const entries=ids.map(function(key){const r=notesEnglishLatest_(records,key);return {id:key,row:index.byId[key],state:r?r.event.kind:'UNPREPARED'};});
  const chosen=id||((entries.find(function(x){return ['WRITTEN','STAGED','COPIED','HOLD','CONFLICT','REQUEST'].includes(x.state);})||entries[0]||{}).id);
  if(!chosen)return {entries:[],record:null,phase:ctx.config.phase};
  const last=notesEnglishLatest_(records,chosen),snap=notesEnglishSnapshot_(ctx.sheet,index.byId[chosen]);
  const valid=last&&last.snapshot.digest===snap.digest,origin=last&&records.find(function(r){return r.event.kind==='REQUEST'&&r.event.requestId===last.event.requestId;});
  return {phase:ctx.config.phase,entries:entries,record:{id:chosen,row:index.byId[chosen],values:snap.values,notes:snap.notes,
    state:valid?last.event.kind:'CHANGED',eventId:valid?last.event.eventId:'',digest:snap.digest,
    previousEnglish:origin?origin.snapshot.values[5]:'',english:valid&&['STAGED','WRITTEN'].includes(last.event.kind)?last.values[28]:'',evidence:valid&&['STAGED','WRITTEN','HOLD','CONFLICT'].includes(last.event.kind)?last.values[29]:'',
    reason:valid?(last.values[30]||last.event.reason||''):'最新の内容で再確認してください。',confirmed:!!(valid&&last.event.kind==='CONFIRMED')}};
});}
function requestNotesEnglishWorkflow(input){return notesEnglishLock_(function(){
  const ctx=notesEnglishContext_();if(ctx.config.phase!=='ACTIVE')throw new Error('準備が完了していません。');
  const index=notesEnglishIndex_(ctx),records=notesEnglishRecords_(ctx);if(!input||!index.byId[input.id])throw new Error('対象行を特定できません。');
  const current=notesEnglishSnapshot_(ctx.sheet,index.byId[input.id]);if(current.digest!==input.digest)throw new Error('画面表示後に変更されています。入力を保持して再読込みしてください。');
  if(!notesEnglishRequestable_(current))throw new Error('保留・空欄・数式を確認してください。');
  const latest=notesEnglishLatest_(records,input.id);if(latest&&['REQUEST','RESERVED'].includes(latest.event.kind)&&latest.snapshot.digest===current.digest)return {status:latest.event.kind};
  notesEnglishAppend_(ctx,records,input.id,'REQUEST',current,{requestId:Utilities.getUuid(),notBefore:Date.now()+NOTES_ENGLISH_SETTLE_MS,reason:'本人の再依頼。Fは保持・未採用。'});return {status:'REQUEST'};
});}
function confirmNotesEnglishWorkflow(input){return notesEnglishLock_(function(){
  const ctx=notesEnglishContext_(),index=notesEnglishIndex_(ctx),records=notesEnglishRecords_(ctx);if(!input||!index.byId[input.id])throw new Error('対象行を特定できません。');
  notesEnglishObserve_(ctx,records,index,input.id,'');const last=notesEnglishLatest_(records,input.id),current=notesEnglishSnapshot_(ctx.sheet,index.byId[input.id]);
  if(last&&last.event.kind==='CONFIRMED'&&last.event.confirmedFrom===input.eventId&&current.digest===input.digest&&last.snapshot.digest===current.digest)return {status:'CONFIRMED'};
  if(!last||last.event.eventId!==input.eventId||current.digest!==input.digest||last.snapshot.digest!==current.digest)throw new Error('画面が古くなりました。同じ項目で再確認してください。');
  if(!['COPIED','WRITTEN'].includes(last.event.kind)||!notesEnglishRequestable_(current)||!current.values[5].trim())throw new Error('最新のDとF、保存状態を確認してください。');
  notesEnglishAppend_(ctx,records,input.id,'CONFIRMED',current,{requestId:last.event.requestId,resultDigest:last.event.resultDigest,confirmedFrom:input.eventId,reason:'本人がこのDとFを確認。本番未反映。'});return {status:'CONFIRMED'};
});}
// Explicit menu request: selected Notes rows only; unchanged D and hand-edited F are valid new baselines.
function regenerateSelectedNotesEnglish(){
  const result=notesEnglishLock_(function(){const ctx=notesEnglishContext_();if(ctx.config.phase!=='ACTIVE')throw new Error('初期準備が未完了です。');
    const range=ctx.book.getActiveRange();if(!range||range.getSheet().getSheetId()!==ctx.sheet.getSheetId()||range.getRow()<2||range.getNumRows()>20)throw new Error('Notesで対象の1〜20行を選択してください。');
    const index=notesEnglishIndex_(ctx),records=notesEnglishRecords_(ctx),selection=[];
    for(let row=range.getRow();row<=range.getLastRow();row++){const id=index.byRow[row];if(!id)throw new Error('ID未登録の行があります。初期準備で登録してください。');selection.push({id:id,snapshot:notesEnglishSnapshot_(ctx.sheet,row)});}
    let accepted=0,existing=0,held=0;
    selection.forEach(function(item){const freshIndex=notesEnglishIndex_(ctx),row=freshIndex.byId[item.id],current=row&&notesEnglishSnapshot_(ctx.sheet,row);
      if(!current||current.digest!==item.snapshot.digest||!notesEnglishRequestable_(current)){held++;return;}
      const last=notesEnglishLatest_(records,item.id);
      if(last&&['REQUEST','RESERVED'].includes(last.event.kind)&&last.snapshot.digest===current.digest){existing++;return;}
      notesEnglishAppend_(ctx,records,item.id,'REQUEST',current,{requestId:Utilities.getUuid(),notBefore:Date.now()+NOTES_ENGLISH_SETTLE_MS,reason:'選択行の英訳再生成。現在のDとFを基準に再依頼。未採用。'});accepted++;
    });return {accepted:accepted,existing:existing,held:held};});
  SpreadsheetApp.getUi().alert('英訳を再生成：受付 '+result.accepted+'件、受付済み '+result.existing+'件、要確認 '+result.held+'件。');return result;
}
