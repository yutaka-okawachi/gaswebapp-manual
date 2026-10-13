/** Private, opt-in mobile review. No trigger creation, new scopes, translation or publication. */
const ENGLISH_MOBILE_CONFIG='english-mobile-config';
const ENGLISH_MOBILE_PREFIX='english-mobile-request:';
const ENGLISH_MOBILE_LATEST='english-mobile-latest:';
function englishMobileEnabled_() {
  try{const props=PropertiesService.getDocumentProperties(),raw=props&&props.getProperty(ENGLISH_MOBILE_CONFIG),book=SpreadsheetApp.getActiveSpreadsheet();
    if(!raw||!book)return false;const c=JSON.parse(raw),sheet=book.getSheetByName('日英修正案');
    return c.v===1&&c.enabled===true&&c.book===book.getId()&&sheet&&c.sheet===sheet.getSheetId();
  }catch(_){return false;}
}
// Fail closed if this execution cannot resolve the bound document and its property store.
function englishMobileSetupContext_() {
  const ctx=englishNativeContext_(),configured=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(!configured||configured!==ctx.book.getId())throw new Error('対象ブックと既存のSPREADSHEET_ID設定が一致しません。有効化せず、対象プロジェクトを確認してください。');
  const props=PropertiesService.getDocumentProperties();
  if(!props)throw new Error('対象ブックのDocument Propertiesを利用できません。有効化せず、ブックに紐づくプロジェクトから実行してください。');
  return {book:ctx.book,sheet:ctx.sheet,props:props};
}
// Read-only preflight; never creates triggers, enables processing or reads candidate bodies.
function inspectJapaneseEnglishMobileReviewFromEditor() {
  const ctx=englishMobileSetupContext_(),state={targetVerified:true,sheet:ctx.sheet.getName(),enabled:englishMobileEnabled_(),pendingReceipts:Object.keys(ctx.props.getProperties()).filter(function(k){return k.indexOf(ENGLISH_MOBILE_PREFIX)===0;}).length,triggers:'管理者が同じアカウントで2つの設定を確認してください（この関数では検証しません）'};
  console.log(JSON.stringify(state));return state;
}
function englishMobileEnable_(ctx) {
  ctx.props.setProperty(ENGLISH_MOBILE_CONFIG,JSON.stringify({v:1,enabled:true,book:ctx.book.getId(),sheet:ctx.sheet.getSheetId()}));
  if(!englishMobileEnabled_())throw new Error('有効化状態を確認できません。状態確認関数で確認してください。');
  console.log('スマホ確認を有効化しました。既存のJ採用希望は取り込んでいません。');
  return {enabled:true};
}
// Explicit editor action: running this named function is consent to enable processing.
// Run only after inspecting the target and separately confirming both installed triggers.
function enableJapaneseEnglishMobileReviewFromEditor() {
  return englishMobileEnable_(englishMobileSetupContext_());
}
// Spreadsheet UI entry only. Never silently falls back to editor activation on a UI error.
function enableJapaneseEnglishMobileReview() {
  const ui=SpreadsheetApp.getUi(),ctx=englishNativeContext_();
  if(ui.alert('スマホ確認を有効化','インストール型編集トリガー handleJapaneseEnglishMobileEdit と、1分ごとの processJapaneseEnglishMobileQueue を同じ管理者で設定済みですか？\nこの関数はトリガーを作成・検証しません。設定済みの場合だけ有効化してください。既存のJ採用希望は取り込みません。',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  return englishMobileEnable_(englishMobileSetupContext_());
}
function disableJapaneseEnglishMobileReview() {
  const ui=SpreadsheetApp.getUi();
  if(ui.alert('スマホ確認を停止','スマホ用の未処理受付だけを破棄します。J・確認履歴・従来の開始記録は変更しません。続けますか？',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  return disableJapaneseEnglishMobileReviewFromEditor();
}
// Explicit editor stop action; candidate decisions and confirmation records are preserved.
function disableJapaneseEnglishMobileReviewFromEditor() {
  const props=englishMobileSetupContext_().props;props.deleteProperty(ENGLISH_MOBILE_CONFIG);
  Object.keys(props.getProperties()).filter(function(k){return k.indexOf(ENGLISH_MOBILE_PREFIX)===0||k.indexOf(ENGLISH_MOBILE_LATEST)===0;}).forEach(function(k){props.deleteProperty(k);});
  console.log('スマホ確認を停止しました。スマホ用の未処理受付だけを破棄しました。');
  return {enabled:false};
}
function englishMobileBody_(row,formulas,notes) {
  return englishReviewDigest_([row.slice(0,9),row.slice(10,20),formulas.slice(0,20),notes.slice(0,20)]);
}
function englishMobileProperty_(key,token){return ENGLISH_MOBILE_PREFIX+key+':'+token;}
function englishMobileSame_(props,ticket) {
  try{const current=JSON.parse(props.getProperty(englishMobileProperty_(ticket.key,ticket.token))||'null');return current&&current.token===ticket.token&&props.getProperty(ENGLISH_MOBILE_LATEST+ticket.key)===ticket.token;}catch(_){return false;}
}
function englishMobileStatus_(sheet,record,text) {
  englishSimpleInvalidate_(sheet,record,text);
}
function englishMobileToast_(book,text){try{book.toast(text,'日英修正案',8);}catch(_){}}

function handleJapaneseEnglishMobileEdit(e) {
  // Serialize receipt/status changes with the manual batch's per-item save.
  if(!e||!e.triggerUid||!e.range||!e.source||!englishMobileEnabled_())return;
  return englishNativeLock_(function(){return englishMobileEdit_(e);});
}
function englishMobileEdit_(e) {
  if(!e||!e.triggerUid||!e.range||!e.source||!englishMobileEnabled_())return;
  const ctx=englishNativeContext_(),range=e.range,sheet=range.getSheet();
  if(e.source.getId()!==ctx.book.getId()||sheet.getSheetId()!==ctx.sheet.getSheetId()||range.getLastRow()<5||range.getColumn()>26)return;
  const props=PropertiesService.getDocumentProperties(),first=Math.max(5,range.getRow()),last=Math.min(sheet.getLastRow(),range.getLastRow());
  if(first>last)return;
  // A stale single-cell event must not undo a newer input or create a fresh request from it.
  if(range.getNumRows()===1&&range.getNumColumns()===1&&range.getColumn()===10&&e.value!==undefined&&sheet.getRange(first,10,1,1).getDisplayValues()[0][0]!==String(e.value))return;
  const onlyJ=range.getColumn()===10&&range.getLastColumn()===10&&range.getRow()>=5;
  if(!onlyJ||range.getNumRows()>20){
    const ids=sheet.getRange(first,1,last-first+1,1).getDisplayValues(),versions=sheet.getRange(first,16,last-first+1,1).getDisplayValues();
    ids.forEach(function(r,i){const key=r[0]+'/'+versions[i][0];if(/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(key))props.setProperty(ENGLISH_MOBILE_LATEST+key,Utilities.getUuid());});
    // No inference from a multi-column paste or a large edit. The old invalidator is bounded to A/Y:Z.
    englishNativeProposalEdited(e);
    englishMobileToast_(ctx.book,'自動確認はJ列だけを1〜20行ずつ変更してください。今回の編集は自動確定しません。');return;
  }
  const data=sheet.getRange(first,1,last-first+1,26),rows=data.getDisplayValues(),formulas=data.getFormulas(),notes=data.getNotes();
  rows.forEach(function(row,i){
    const key=row[0]+'/'+row[15],r={id:row[0],version:row[15],rowNumber:first+i};
    if(!/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(key)){englishMobileToast_(ctx.book,'ID・版を特定できない行は自動確認しません。');return;}
    if(row[9]!=='採用希望'||formulas[i][9]){
      props.setProperty(ENGLISH_MOBILE_LATEST+key,Utilities.getUuid());
      try{englishMobileStatus_(sheet,r,'Jの判断変更を受け付けました。採用希望以外は自動確定しません。');}catch(_){englishMobileToast_(ctx.book,'状態表示を更新できません。Jの入力は保持しています。');}return;
    }
    const ticket={v:1,key:key,token:Utilities.getUuid(),body:englishMobileBody_(row,formulas[i],notes[i]),at:Date.now(),tries:0,next:0};
    const property=englishMobileProperty_(key,ticket.token);
    try{
      // One small receipt per edited ID; no bodies, user names or email addresses are persisted.
      const pending=Object.keys(props.getProperties()).filter(function(k){return k.indexOf(ENGLISH_MOBILE_PREFIX)===0;});
      if(pending.length>=400)throw new Error('Queue limit');
      props.setProperty(property,JSON.stringify(ticket));
      props.setProperty(ENGLISH_MOBILE_LATEST+key,ticket.token);
      englishMobileStatus_(sheet,r,'自動確認を受け付けました。定期処理待ちです。処理されない場合はJを選び直してください。');
    }catch(_){
      if(englishMobileSame_(props,ticket))props.deleteProperty(property);
      try{englishMobileStatus_(sheet,r,'自動確認を受け付けられませんでした。Jを選び直してください。');}catch(_){englishMobileToast_(ctx.book,'受付・状態表示に失敗しました。Jの入力は保持しています。再選択してください。');}
    }
  });
}

function processJapaneseEnglishMobileQueue() {
  if(!englishMobileEnabled_())return {disabled:true};
  const lock=LockService.getScriptLock();if(!lock||!lock.tryLock(1000))return {busy:true};
  try{return englishMobileProcess_();}finally{lock.releaseLock();}
}
function englishMobileProcess_() {
  if(!englishMobileEnabled_())return {disabled:true};
  const props=PropertiesService.getDocumentProperties(),all=props.getProperties(),started=Date.now(),results=[];
  const tickets=Object.keys(all).filter(function(k){return k.indexOf(ENGLISH_MOBILE_PREFIX)===0;}).map(function(property){
    try{const t=JSON.parse(all[property]);if(t.v!==1||property!==englishMobileProperty_(t.key,t.token)||!/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(t.key)||!/^[-a-zA-Z0-9]{16,80}$/.test(t.token)||!/^[a-f0-9]{64}$/.test(t.body)||!Number.isFinite(t.at)||!Number.isFinite(t.next)||!Number.isInteger(t.tries)||t.tries<0||t.tries>3)return null;if(!englishMobileSame_(props,t)){props.deleteProperty(property);return null;}return t;}catch(_){return null;}
  }).filter(function(t){return t&&t.next<=Date.now();}).sort(function(a,b){return a.at-b.at;}).slice(0,5);
  tickets.forEach(function(ticket){
    if(Date.now()-started>180000||!englishMobileSame_(props,ticket))return;
    function status(text){try{const ctx=englishNativeContext_(),entry=englishSimpleIndex_(ctx).find(function(r){return r.key===ticket.key;});if(entry&&englishMobileSame_(props,ticket))englishMobileStatus_(ctx.sheet,{id:entry.id,version:entry.key.split('/')[1],rowNumber:entry.row},text);}catch(_){englishMobileToast_(SpreadsheetApp.getActiveSpreadsheet(),'自動確認の状態を更新できません。Jを選び直して再実行してください。');}}
    const property=englishMobileProperty_(ticket.key,ticket.token);
    if(Date.now()-ticket.at>24*60*60*1000||ticket.tries>=3){status('自動確認の受付期限または再試行回数を超えました。Jを選び直してください。');props.deleteProperty(property);return;}
    ticket.tries++;ticket.next=Date.now()+60000;props.setProperty(property,JSON.stringify(ticket));
    try{
      const result=englishSimpleRun_({keys:[ticket.key],operation:ticket.token,isCurrent:function(){return englishMobileSame_(props,ticket);},check:function(r){return englishMobileSame_(props,ticket)&&r.decision==='採用希望'&&englishMobileBody_(r.row,r.formulas,r.proposalNotes)===ticket.body;}});
      if(englishMobileSame_(props,ticket)){
        if(!result.results.length)status('対象のID・版が移動または更新されました。最新版のJを選び直してください。');
        else if(result.results[0].status==='failed')status(result.results[0].reason||'自動確認できませんでした。Jを選び直してください。');
        else if(result.results[0].status==='display-error'){status('確認記録は保存しましたが、非表示に失敗しました。Jを選び直して再照合してください。');}
        props.deleteProperty(property);
      }
      results.push({key:ticket.key,status:result.results.length?result.results[0].status:'missing'});
    }catch(_){
      status('自動確認を完了できませんでした。受付済みの対象だけを再試行します。3回失敗した場合はJを選び直してください。');
      results.push({key:ticket.key,status:'retry'});
    }
  });return {results:results};
}
