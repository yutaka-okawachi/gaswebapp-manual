/** Private retranslation requests. No translation, candidate writes, adoption or new triggers. */
const ENGLISH_RETRANSLATION_HEADERS=['再英訳依頼','再英訳の処理状況','再英訳受付JSON','再英訳応答JSON'];
const ENGLISH_RETRANSLATION_HISTORY='再英訳依頼履歴';
const ENGLISH_RETRANSLATION_MARKER='english-retranslation-history-v1';
const ENGLISH_RETRANSLATION_ARCHIVE_HEADERS=['元セル数式JSON','元セルメモJSON','履歴保存日時','元タブ','元行（保存時）','保存理由','保存操作ID','元セル構造JSON'];
function englishRetranslationJson_(text){try{return JSON.parse(text);}catch(_){return null;}}
function englishRetranslationWrite_(sheet,row,col,values){
  sheet.getRange(row,col,1,values.length).setRichTextValues([values.map(function(v){return SpreadsheetApp.newRichTextValue().setText(v).build();})]);
}
function englishRetranslationContext_(book){
  if(typeof legacyEnglishBindingsRetired_==='function'&&legacyEnglishBindingsRetired_())return null;
  if(typeof notesEnglishOwns_==='function'&&notesEnglishOwns_())return null;
  if(!book||book.getId()!==PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'))throw new Error('対象ブックが不一致です。');
  const sheet=book.getSheetByName('日英修正案'),history=book.getSheetByName(ENGLISH_RETRANSLATION_HISTORY);
  // Provisioning belongs to the cloud writer. Existing or unrelated columns are never adopted.
  if(!sheet||sheet.getMaxColumns()<30||!history)return null;
  const headers=ENGLISH_PROPOSAL_HEADERS.concat(ENGLISH_RETRANSLATION_HEADERS);
  if(JSON.stringify(sheet.getRange(4,1,1,30).getDisplayValues()[0])!==JSON.stringify(headers)||
    history.getMaxColumns()<31||history.getRange(1,1,1,1).getDisplayValues()[0][0]!==ENGLISH_RETRANSLATION_MARKER||
    JSON.stringify(history.getRange(2,1,1,31).getDisplayValues()[0])!==JSON.stringify(['依頼JSON'].concat(headers)))throw new Error('再英訳依頼の列・履歴契約が不一致です。');
  if(sheet.getLastRow()>20004||history.getLastRow()>=5002)throw new Error('再英訳依頼の件数上限です。');
  return {book:book,sheet:sheet,history:history};
}
function englishRetranslationRow_(sheet,row){
  const range=sheet.getRange(row,1,1,30),values=range.getDisplayValues()[0],formulas=range.getFormulas()[0],notes=range.getNotes()[0];
  return {row:row,values:values,formulas:formulas,notes:notes,key:values[0]+'/'+values[15],
    bodyDigest:englishReviewDigest_([values.slice(0,26),formulas.slice(0,26),notes.slice(0,26)])};
}
function englishRetranslationIndex_(sheet){
  const count=Math.max(0,sheet.getLastRow()-4),ids=count?sheet.getRange(5,1,count,1).getDisplayValues():[],versions=count?sheet.getRange(5,16,count,1).getDisplayValues():[];
  const byKey=Object.create(null),latest=Object.create(null);
  ids.forEach(function(v,i){const id=v[0],version=versions[i][0];if(!id&&!version)return;
    if(!/^EN-\d{6}$/.test(id)||!/^v[1-9]\d{0,5}$/.test(version)||latest[id])throw new Error('ID・版が不正または同じIDが重複しています。');
    byKey[id+'/'+version]=i+5;latest[id]=Math.max(latest[id]||0,Number(version.slice(1)));
  });return {byKey:byKey,latest:latest};
}
function englishRetranslationTicket_(ctx,r){
  const t=englishRetranslationJson_(r.values[28]);
  if(!t||t.schema!==1||!/^[-a-zA-Z0-9]{16,100}$/.test(t.requestId)||t.id!==r.values[0]||!/^v[1-9]\d{0,5}$/.test(t.version)||
    t.sheetId!==ctx.sheet.getSheetId()||!Number.isSafeInteger(t.historyRow)||t.historyRow<3||t.historyRow>ctx.history.getLastRow()||
    !Number.isSafeInteger(t.at)||t.at<=0||t.at>Date.now()+60000||!Number.isSafeInteger(t.rowHint)||t.rowHint<5||
    ![t.bodyDigest,t.jaDigest,t.snapshotDigest].every(function(v){return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);}))throw new Error('受付記録が不正です。');
  const archiveRange=ctx.history.getRange(t.historyRow,1,1,31),saved=archiveRange.getDisplayValues()[0];
  if(saved[0]!==r.values[28]||archiveRange.getFormulas()[0].some(Boolean)||englishReviewDigest_(saved.slice(1))!==t.snapshotDigest||
    saved[1]!==t.id||saved[16]!==t.version||englishReviewDigest_(saved[4])!==t.jaDigest)throw new Error('依頼時の控えと受付が不一致です。');
  return t;
}
function englishRetranslationHistory_(ctx,event,values){
  const row=ctx.history.getLastRow()+1;if(row>ctx.history.getMaxRows()||row>5002)throw new Error('依頼履歴の空き行・上限を確認してください。');
  const saved=[JSON.stringify(event)].concat(values),range=ctx.history.getRange(row,1,1,31);
  if([range.getDisplayValues(),range.getFormulas(),range.getNotes()].some(function(g){return g[0].some(Boolean);}))throw new Error('依頼履歴の保存先が空欄ではありません。');
  englishRetranslationWrite_(ctx.history,row,1,saved);SpreadsheetApp.flush();
  if(JSON.stringify(range.getDisplayValues()[0])!==JSON.stringify(saved))throw new Error('依頼履歴の読戻しが不一致です。');
  return {row:row,digest:englishReviewDigest_(saved)};
}
function englishRetranslationArchive_(ctx,r,t,a){
  const sheet=ctx.book.getSheetByName('日英修正案_履歴');
  if(!sheet||sheet.getSheetId()!==a.archiveSheetId||sheet.getMaxColumns()<34||!Number.isSafeInteger(a.archiveRow)||a.archiveRow<2||a.archiveRow>sheet.getLastRow()||
    JSON.stringify(sheet.getRange(1,1,1,34).getDisplayValues()[0])!==JSON.stringify(ENGLISH_PROPOSAL_HEADERS.concat(ENGLISH_RETRANSLATION_ARCHIVE_HEADERS)))throw new Error('旧版履歴の列・保存先が不一致です。');
  const range=sheet.getRange(a.archiveRow,1,1,34),v=range.getDisplayValues()[0],snapshot=ctx.history.getRange(t.historyRow,2,1,30).getDisplayValues()[0];
  if(range.getFormulas()[0].some(Boolean)||englishReviewDigest_(v)!==a.archiveDigest||JSON.stringify(v.slice(0,26))!==JSON.stringify(snapshot.slice(0,26))||
    v[29]!=='日英修正案'||Number(v[30])!==a.sourceRow||v[32]!==a.operationId||!v[31]||!Number.isFinite(Date.parse(v[28])))throw new Error('旧版・判断履歴の控えが不一致です。');
  function expand(text){const o=englishRetranslationJson_(text),dense=Array(26).fill('');if(!o||Array.isArray(o)||typeof o!=='object')throw new Error('旧版の数式・メモ控えが不正です。');
    Object.keys(o).forEach(function(k){if(!/^(?:[1-9]|1\d|2[0-6])$/.test(k)||typeof o[k]!=='string')throw new Error('旧版の数式・メモ控えが不正です。');dense[Number(k)-1]=o[k];});return dense;}
  const formulas=expand(v[26]),notes=expand(v[27]),structure=englishRetranslationJson_(v[33]);
  if(!structure||typeof structure!=='object'||Array.isArray(structure)||Array.from({length:26},function(_,i){return String(i+1);}).some(function(k){return !structure[k]||typeof structure[k]!=='object';})||
    englishReviewDigest_([v.slice(0,26),formulas,notes])!==t.bodyDigest)throw new Error('旧版の本文・数式・メモ指紋が不一致です。');
  return {values:v.slice(0,26),formulas:formulas,notes:notes};
}
function englishRetranslationPlan_(r,t,a){
  return a.sourceRow===r.row&&a.resultKey===t.id+'/v'+(Number(t.version.slice(1))+1)&&
    Number.isSafeInteger(a.archiveSheetId)&&Number.isSafeInteger(a.archiveRow)&&
    [a.resultBodyDigest,a.archiveDigest].every(function(v){return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);});
}
function englishRetranslationReady_(ctx,r,t,a){
  if(!Number.isSafeInteger(a.readyHistoryRow)||a.readyHistoryRow<=t.historyRow||a.readyHistoryRow>ctx.history.getLastRow())throw new Error('更新準備の受付控えがありません。');
  const range=ctx.history.getRange(a.readyHistoryRow,1,1,31),v=range.getDisplayValues()[0],event=englishRetranslationJson_(v[0]),prepared=englishRetranslationJson_(v[30]);
  if(range.getFormulas()[0].some(Boolean)||englishReviewDigest_(v)!==a.readyDigest||!event||event.schema!==2||event.event!=='INPLACE_READY'||event.requestId!==t.requestId||
    event.requestDigest!==a.requestDigest||event.operationId!==a.operationId||!prepared||prepared.phase!=='PREPARED'||event.preparedDigest!==englishReviewDigest_(prepared)||v[29]!==r.values[28]||
    ['schema','mode','requestId','requestDigest','operationId','sourceRow','resultKey','resultBodyDigest','archiveSheetId','archiveRow','archiveDigest'].some(function(k){return prepared[k]!==a[k];}))throw new Error('更新準備の段階・指紋が不一致です。');
  const old=englishRetranslationArchive_(ctx,r,t,a);
  if(old.values[8]!=='確認待ち'||JSON.stringify(v.slice(1,27))!==JSON.stringify(old.values))throw new Error('保留または更新前の本文が不一致です。');
  return old;
}
function englishRetranslationPrepare_(ctx,r,t,a){
  const old=englishRetranslationArchive_(ctx,r,t,a);
  if(r.key!==t.id+'/'+t.version||r.bodyDigest!==t.bodyDigest||old.values[8]!=='確認待ち')throw new Error('保留または受付後の編集があります。更新準備を停止しました。');
  const now=englishRetranslationRow_(ctx.sheet,r.row);
  if(JSON.stringify(now)!==JSON.stringify(r))throw new Error('更新準備中に内容が変わりました。');
  const receipt=englishRetranslationHistory_(ctx,{schema:2,event:'INPLACE_READY',requestId:t.requestId,requestDigest:a.requestDigest,operationId:a.operationId,at:Date.now(),preparedDigest:englishReviewDigest_(a)},r.values);
  if(JSON.stringify(englishRetranslationRow_(ctx.sheet,r.row))!==JSON.stringify(r))throw new Error('更新準備の履歴保存中に内容が変わりました。');
  const ready=Object.assign({},a,{phase:'READY',at:Date.now(),readyHistoryRow:receipt.row,readyDigest:receipt.digest}),text=JSON.stringify(ready);
  if(text.length>4000)throw new Error('更新準備の応答JSONが上限です。');
  englishRetranslationWrite_(ctx.sheet,r.row,30,[text]);SpreadsheetApp.flush();
  const after=englishRetranslationRow_(ctx.sheet,r.row);
  if(after.bodyDigest!==r.bodyDigest||after.values[28]!==r.values[28]||after.values[29]!==text||after.values[27]!==r.values[27])throw new Error('更新準備受付の読戻しが不一致です。');
  englishRetranslationStatus_(ctx,after,'処理中：同じ行の更新準備ができました');return {prepared:true};
}
function englishRetranslationResult_(r,t,a,old){
  const v=r.values,creation=englishRetranslationJson_(v[18]);
  return r.key===a.resultKey&&r.bodyDigest===a.resultBodyDigest&&v[3]===old.values[3]&&!!v[5].trim()&&v[11]===old.values[5]&&
    [0,1,2,6,10,12,13,14,16,17].every(function(i){return v[i]===old.values[i];})&&
    JSON.stringify(r.formulas.slice(0,26))===JSON.stringify(old.formulas)&&JSON.stringify(r.notes.slice(0,26))===JSON.stringify(old.notes)&&
    !r.formulas.slice(26).some(Boolean)&&v[8]==='確認待ち'&&v[9]==='未確認'&&v[24]==='未確認'&&!v.slice(20,24).some(Boolean)&&
    !!creation&&creation.id===v[0]&&creation.version===v[15]&&creation.ja===v[3]&&creation.en===v[5]&&creation.italian===v[6]&&creation.changes===v[4]&&creation.evidence===v[7];
}
function englishRetranslationStatus_(ctx,r,text){
  const result=typeof text==='object'?text:null;if(result)text=result.text;
  const now=englishRetranslationRow_(ctx.sheet,r.row);
  if(now.key!==r.key||now.values[27]!==r.values[27]||now.values[28]!==r.values[28]||now.values[29]!==r.values[29])return false;
  if(now.bodyDigest!==r.bodyDigest)text='要確認：受付後に本文・判断が変わりました。再依頼してください。';
  function resultMatches(){if(!result)return true;const fresh=englishRetranslationRow_(ctx.sheet,result.row);return fresh.key===result.key&&fresh.bodyDigest===result.digest&&fresh.values[29]===result.origin;}
  if(!resultMatches())text='要確認：完了表示の直前に新版が変わりました。';
  if(now.values[27]!==text)englishRetranslationWrite_(ctx.sheet,r.row,28,[text]);
  if(result&&!resultMatches()){const again=englishRetranslationRow_(ctx.sheet,r.row);if(again.values[28]===r.values[28]&&again.values[29]===r.values[29])englishRetranslationWrite_(ctx.sheet,r.row,28,['要確認：完了表示中に新版が変わりました。']);}
  return true;
}
function englishRetranslationAccept_(ctx,row){
  const r=englishRetranslationRow_(ctx.sheet,row),v=r.values;
  if(v[26]!=='再英訳を依頼'||r.formulas[26])return;
  const index=englishRetranslationIndex_(ctx.sheet);
  if(index.byKey[r.key]!==row||index.latest[v[0]]!==Number(v[15].slice(1)))throw new Error('最新の提案版で依頼してください。');
  if(!v[3].trim()||v[3].length>45000||r.formulas.slice(0,30).some(function(f,i){return !!f&&i!==10;}))throw new Error('日本語が空欄・上限超過、またはK以外に数式を含む行です。');
  // Repeated clicks do not replace an active ticket, even if an earlier response is delayed.
  if(v[28]&&/^(受付|処理中)/.test(v[27])){
    const old=englishRetranslationTicket_(ctx,r);
    if(old.version===v[15]&&old.bodyDigest===r.bodyDigest){englishRetranslationWrite_(ctx.sheet,row,27,['']);return;}
    throw new Error('受付後に本文・判断が変わりました。要確認を確認して再依頼してください。');
  }
  const historyRow=ctx.history.getLastRow()+1;
  if(historyRow>ctx.history.getMaxRows())throw new Error('依頼履歴の空き行がありません。');
  const t={schema:1,requestId:Utilities.getUuid(),id:v[0],version:v[15],sheetId:ctx.sheet.getSheetId(),rowHint:row,
    at:Date.now(),historyRow:historyRow,bodyDigest:r.bodyDigest,jaDigest:englishReviewDigest_(v[3]),snapshotDigest:englishReviewDigest_(v)};
  const text=JSON.stringify(t);
  if(englishRetranslationRow_(ctx.sheet,row).bodyDigest!==r.bodyDigest)throw new Error('受付直前に本文・判断が変わりました。');
  englishRetranslationWrite_(ctx.history,historyRow,1,[text].concat(v));SpreadsheetApp.flush();
  if(JSON.stringify(ctx.history.getRange(historyRow,1,1,31).getDisplayValues()[0])!==JSON.stringify([text].concat(v)))throw new Error('依頼履歴の保存を確認できません。');
  const latest=englishRetranslationRow_(ctx.sheet,row);
  if(latest.bodyDigest!==r.bodyDigest||JSON.stringify(latest.values.slice(26))!==JSON.stringify(v.slice(26)))throw new Error('受付中に本文・依頼欄が変わりました。');
  // A complete immutable history precedes acknowledgement. Orphan history is never executable.
  englishRetranslationWrite_(ctx.sheet,row,27,['','受付：クラウド処理待ち',text,'']);SpreadsheetApp.flush();
  const after=englishRetranslationRow_(ctx.sheet,row);
  if(after.bodyDigest!==r.bodyDigest||after.values[28]!==text||after.values[29]){
    if(after.values[28]===text)englishRetranslationStatus_(ctx,after,'要確認：受付保存中に内容が変わりました。');
    throw new Error('受付の読戻しが一致しません。');
  }
  englishRetranslationTicket_(ctx,after);
}
// Existing simple onEdit only. No installed mobile handler is enabled or recreated.
function englishRetranslationEdited_(e){
  const range=e&&e.range;if(!range||!e.source||range.getSheet().getName()!=='日英修正案'||range.getLastRow()<5)return false;
  const onlyRequest=range.getColumn()===27&&range.getLastColumn()===27;
  if(range.getColumn()>27)return false;
  const sheet=range.getSheet(),row=range.getRow();let ctx,script,doc;
  try{
    ctx=englishRetranslationContext_(e.source);if(!ctx||sheet.getSheetId()!==ctx.sheet.getSheetId())return false;
    if(!onlyRequest){
      // This is a latch: editing then undoing never revives an old request.
      const first=Math.max(5,row),last=Math.min(sheet.getLastRow(),range.getLastRow());
      if(first>last)return false;
      const controls=sheet.getRange(first,28,last-first+1,2).getDisplayValues();
      if(controls.some(function(c){return !!c[1];}))sheet.getRange(first,28,controls.length,1).setRichTextValues(controls.map(function(c){return [SpreadsheetApp.newRichTextValue().setText(c[1]?'要確認：依頼後の編集を検出しました。再依頼してください。':c[0]).build()];}));
      return false; // Keep the pre-existing proposal invalidator in the same onEdit.
    }
    if(row<5||range.getNumRows()!==1||range.getNumColumns()!==1){try{e.source.toast('再英訳依頼はAAを1行ずつ選択してください。','再英訳依頼',8);}catch(_){}return true;}
    if(e.value!=='再英訳を依頼')return true;
    if(sheet.getRange(row,27,1,1).getDisplayValues()[0][0]!==e.value)return true;
    script=LockService.getScriptLock();if(!script||!script.tryLock(1)){script=null;throw new Error('別処理中です。AAを空欄にして選び直してください。');}
    doc=LockService.getDocumentLock();if(!doc||!doc.tryLock(1)){doc=null;throw new Error('別処理中です。AAを空欄にして選び直してください。');}
    englishRetranslationAccept_(ctx,row);
  }catch(error){
    // Never substitute a new body for the event. Failure is visible and needs a fresh choice.
    if(ctx&&onlyRequest&&range.getNumRows()===1){try{const r=englishRetranslationRow_(sheet,row);englishRetranslationStatus_(ctx,r,'要確認：'+String(error.message).slice(0,150));}catch(_) {}}
    try{e.source.toast('再英訳依頼を受け付けられませんでした。ABを確認し、AAを空欄にして選び直してください。','再英訳依頼',8);}catch(_){}
  }finally{if(doc)doc.releaseLock();if(script)script.releaseLock();}
  return onlyRequest;
}
function englishRetranslationOutcome_(ctx,r,index){
  const t=englishRetranslationTicket_(ctx,r);
  const unchanged=t.bodyDigest===r.bodyDigest&&r.key===t.id+'/'+t.version;
  if(!r.values[29])return unchanged?'受付：クラウド処理待ち':'要確認：受付後に本文・判断が変わりました。再依頼してください。';
  const a=englishRetranslationJson_(r.values[29]);
  if(!a||r.values[29].length>4000||a.schema!==2||a.mode!=='same-row-v1'||a.requestId!==t.requestId||a.requestDigest!==englishReviewDigest_(t)||
    !/^[-a-zA-Z0-9]{8,100}$/.test(a.operationId)||!Number.isSafeInteger(a.at)||a.at<t.at||a.at>Date.now()+60000||
    !['PROCESSING','PREPARED','READY','WRITING','COMPLETE','REVIEW'].includes(a.phase))return '要確認：writer応答が現在の依頼と不一致です。';
  if(a.phase==='REVIEW'){
    englishRetranslationHistory_(ctx,{schema:2,event:'INPLACE_REVIEW',requestId:t.requestId,operationId:a.operationId,at:Date.now(),responseDigest:englishReviewDigest_(a)},r.values);
    return '要確認：クラウド側で停止しました。履歴と内容を確認してください。';
  }
  if(a.phase!=='COMPLETE'&&Date.now()-a.at>30*60000)return '要確認：処理中のまま30分経過しました。保存先を確認してください。';
  if(a.phase==='PROCESSING')return unchanged?'処理中：クラウドが再英訳しています':'要確認：受付後に本文・判断が変わりました。再依頼してください。';
  if(!englishRetranslationPlan_(r,t,a))return '要確認：同じ行の更新計画が不一致です。';
  if(a.phase==='PREPARED')return englishRetranslationPrepare_(ctx,r,t,a);
  const old=englishRetranslationReady_(ctx,r,t,a),valid=englishRetranslationResult_(r,t,a,old);
  if(a.phase==='READY')return unchanged?'処理中：同じ行の更新準備ができました':'要確認：更新準備後に本文が変わりました。';
  if(a.phase==='WRITING')return unchanged||valid?'処理中：同じ行の更新を確認しています':'要確認：更新途中の本文・判断が不一致です。';
  if(!valid||index.byKey[a.resultKey]!==r.row)return '要確認：同じ行の新版・D・未確認状態が一致しません。';
  englishRetranslationHistory_(ctx,{schema:2,event:'INPLACE_COMPLETE',requestId:t.requestId,operationId:a.operationId,at:Date.now(),responseDigest:englishReviewDigest_(a)},r.values);
  return {text:'完了：同じ行の改訂英訳を確認してください（未採用）',row:r.row,key:r.key,digest:r.bodyDigest,origin:r.values[29]};
}
// A bounded observer shares the existing timer; it never captures unacknowledged AA choices.
function englishRetranslationPoll_(e){
  let script,doc;const began=Date.now();
  try{
    const state=englishMetadataAutoState_();
    if(!state||!e||String(e.triggerUid)!==state.triggerUid)return;
    script=LockService.getScriptLock();if(!script||!script.tryLock(1)){script=null;return;}
    doc=LockService.getDocumentLock();if(!doc||!doc.tryLock(1)){doc=null;return;}
    const book=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')),ctx=englishRetranslationContext_(book);if(!ctx)return;
    const count=Math.max(0,ctx.sheet.getLastRow()-4);if(!count)return;
    const controls=ctx.sheet.getRange(5,27,count,4).getDisplayValues(),props=PropertiesService.getScriptProperties(),cursorKey='english-retranslation-cursor-v1';
    let cursor=Number(props.getProperty(cursorKey)||0);if(!Number.isSafeInteger(cursor)||cursor<0)cursor=0;
    let visited=0,checked=0,index;
    while(visited<count&&checked<2&&Date.now()-began<5000){
      const i=(cursor+visited++)%count,c=controls[i];if(!c[2]||! /^(受付|処理中)/.test(c[1]))continue;
      const r=englishRetranslationRow_(ctx.sheet,i+5);if(r.values[28]!==c[2]||! /^(受付|処理中)/.test(r.values[27]))continue;
      checked++;let status;
      try{if(!index)index=englishRetranslationIndex_(ctx.sheet);status=englishRetranslationOutcome_(ctx,r,index);}catch(_){status='要確認：依頼記録・履歴・版を確認できません。';}
      if(!status||!status.prepared)englishRetranslationStatus_(ctx,r,status);
    }
    if(checked)props.setProperty(cursorKey,String((cursor+visited)%count));
  }catch(_){console.log('再英訳依頼の状態確認を見送りました。候補は変更していません。');}
  finally{if(doc)doc.releaseLock();if(script)script.releaseLock();}
}
