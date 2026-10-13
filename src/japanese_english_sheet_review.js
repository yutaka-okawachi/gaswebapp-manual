/** Native-sheet review. No initial HTML/data load, source writes, new scopes or installed triggers. */
const ENGLISH_NATIVE_TTL = 2 * 60 * 60 * 1000;
const ENGLISH_NATIVE_PROMPT_TTL = 5 * 60 * 1000;
const ENGLISH_SIMPLE_HIDDEN = '[auto-hide:owned]';
const ENGLISH_SIMPLE_HIDE_PENDING = '[auto-hide:pending]';

// J is the user's explicit request at execution time. No old browsing-session proof is inferred.
function englishSimpleIndex_(ctx) {
  const sheet=ctx.sheet,count=Math.max(0,sheet.getLastRow()-4);
  if(count>20000)throw new Error('提案が20,000版を超えています。構成を確認してください。');
  if(sheet.getRange(4,1,1,26).getDisplayValues()[0].some(function(v,i){return v!==ENGLISH_PROPOSAL_HEADERS[i];}))throw new Error('日英修正案の列構成が契約と異なります。');
  function column(n,width){return count?sheet.getRange(5,n,count,width||1).getDisplayValues():[];}
  const ids=column(1),versions=column(16),choices=column(9,2),states=column(25,2),seen=new Set();
  return ids.map(function(row,i){
    if(!row[0]&&!versions[i][0])return null;
    const key=row[0]+'/'+versions[i][0];
    if(!/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(key)||seen.has(key))throw new Error('確認ID・提案版が不正または重複しています。');
    seen.add(key);return {key:key,id:row[0],row:i+5,preparation:choices[i][0],decision:choices[i][1],validity:states[i][0],owned:states[i][1].indexOf(ENGLISH_SIMPLE_HIDDEN)>=0,hidePending:states[i][1].indexOf(ENGLISH_SIMPLE_HIDE_PENDING)>=0};
  }).filter(function(r){return r;});
}
function englishSimpleReason_(r) {
  if(!r||!r.latest)return '旧版または対象を特定できません。最新版を確認してください。';
  if(r.blocked)return r.reason;
  if(r.formulas[9]||r.decision!=='採用希望')return 'Jが手入力の「採用希望」ではありません。';
  if(r.preparation==='保留'||!r.ja.trim()||!r.english.trim())return '保留中または日本語・英訳が空欄です。新版の準備を依頼してください。';
  return '';
}
function englishSimpleReceipt_(r) {
  if(englishSimpleReason_(r)||r.validity!=='確認済（本番未反映）')return false;
  return r.row[20]===r.sourceText&&englishProposalProofMatches_(r.row[21],r.proposalText,r.decision)&&!!r.row[22]&&!!r.row[23];
}
function englishSimpleReveal_(sheet,r) {
  const row=englishProposalRow_(sheet,r);
  const text=sheet.getRange(row,26,1,1).getDisplayValues()[0][0];
  if(text.indexOf(ENGLISH_SIMPLE_HIDDEN)<0)return false;
  // Only rows hidden by this feature are shown. Filters and unrelated manual hiding are untouched.
  sheet.showRows(row);
  englishReviewAutoWrite_(sheet,row,26,[text.split(ENGLISH_SIMPLE_HIDDEN).join('').split(ENGLISH_SIMPLE_HIDE_PENDING).join('').trim()]);
  return true;
}
function englishSimpleInvalidate_(sheet,r,reason) {
  if(!r)return;
  const marker=sheet.getRange(englishProposalRow_(sheet,r),26,1,1).getDisplayValues()[0][0].indexOf(ENGLISH_SIMPLE_HIDDEN)>=0?ENGLISH_SIMPLE_HIDDEN+' ':'';
  // Validity and visibility are separate. Only the explicit show menu reverses automatic hiding.
  englishProposalWrite_(sheet,englishProposalRow_(sheet,r),25,['再確認が必要',marker+reason+' 最終検査: '+new Date().toISOString()]);
}
function englishSimpleHide_(sheet,r) {
  const row=englishProposalRow_(sheet,r),decision=sheet.getRange(row,10,1,1).getDisplayValues()[0][0],state=sheet.getRange(row,25,1,2).getDisplayValues()[0];
  if(decision!=='採用希望'||state[0]!=='確認済（本番未反映）')return '表示条件が変わったため非表示は省略';
  if(sheet.isRowHiddenByFilter(row))return '通常フィルタ中のため自動非表示は省略';
  if(sheet.isRowHiddenByUser(row)){
    if(state[1].indexOf(ENGLISH_SIMPLE_HIDE_PENDING)>=0)englishProposalWrite_(sheet,row,26,[state[1].split(ENGLISH_SIMPLE_HIDE_PENDING).join('').trim()]);
    return state[1].indexOf(ENGLISH_SIMPLE_HIDDEN)>=0?'自動非表示済み':'手動非表示を維持';
  }
  const text=state[1].split(ENGLISH_SIMPLE_HIDDEN).join('').split(ENGLISH_SIMPLE_HIDE_PENDING).join('').trim();
  englishProposalWrite_(sheet,row,26,[text+' '+ENGLISH_SIMPLE_HIDDEN+' '+ENGLISH_SIMPLE_HIDE_PENDING]);
  if(englishProposalRow_(sheet,r)!==row)throw new Error('表示操作中に行位置が変わりました。');
  sheet.hideRows(row);
  englishProposalWrite_(sheet,englishProposalRow_(sheet,r),26,[text+' '+ENGLISH_SIMPLE_HIDDEN]);
  return '非表示';
}
function englishSimpleRun_(selection) {
  return englishNativeLock_(function(){
    const started=Date.now();
    const ctx=englishNativeContext_();
    if(selection&&selection.isCurrent&&!selection.isCurrent())return {totalRequests:0,queue:0,checked:0,results:[]};
    if(selection&&(!Array.isArray(selection.keys)||!selection.keys.length||selection.keys.length>20||typeof selection.check!=='function'))throw new Error('編集対象が不正です。');
    if(!selection&&ctx.book.getActiveSheet().getSheetId()!==ctx.sheet.getSheetId())throw new Error('「日英修正案」タブから実行してください。');
    const index=englishSimpleIndex_(ctx),queue=index.filter(function(r){return selection?selection.keys.indexOf(r.key)>=0:r.decision==='採用希望'&&(r.validity!=='確認済（本番未反映）'||!r.owned||r.hidePending);}),property='english-simple-cursor:'+ctx.book.getId();
    const last=ctx.props.getProperty(property),start=(queue.findIndex(function(r){return r.key===last;})+1)%Math.max(1,queue.length);
    const chosen=(selection?queue:queue.slice(start).concat(queue.slice(0,start))).slice(0,20),keys=chosen.filter(function(r){return selection||r.validity!=='確認済（本番未反映）';}).map(function(r){return r.key;});
    const summary={totalRequests:index.filter(function(r){return r.decision==='採用希望';}).length,queue:queue.length,checked:chosen.length,results:[]};
    if(!chosen.length)return summary;
    // Advance independently of failures so a blocked first batch never starves later requests.
    if(!selection)ctx.props.setProperty(property,chosen[chosen.length-1].key);
    const operation=selection?selection.operation:Utilities.getUuid(),results=summary.results;
    // Existing J/Y matches are display-only, regardless of source/proposal/version consistency.
    chosen.filter(function(r){return !selection&&r.validity==='確認済（本番未反映）';}).forEach(function(entry){
      const r={id:entry.id,version:entry.key.split('/')[1],rowNumber:entry.row};
      try{results.push({key:entry.key,status:'saved',reason:englishSimpleHide_(ctx.sheet,r)+'（既存の確認済表示・内容未再照合）'});}
      catch(_){results.push({key:entry.key,status:'display-error',reason:'確認済の判断は保持。非表示に失敗しました。再実行または再表示メニューを使ってください。'});}
    });
    if(!keys.length)return summary;
    let data;try{data=englishProposalRead_(keys);}catch(error){keys.forEach(function(key){results.push({key:key,status:'failed',reason:error.message||'新規確認の照合に失敗しました。'});});return summary;}
    let map=englishNativeMap_(data),active=[];
    // The explicit manual menu may promote one frozen, revalidated J while holding this lock.
    if(selection&&selection.prepare){
      if(keys.length!==1)throw new Error('手動の判断変更は1件ずつ検証します。');
      map[keys[0]]=selection.prepare(map[keys[0]]);
    }
    function failure(item,reason){
      const r=map[item.key];
      if(selection&&selection.isCurrent&&!selection.isCurrent()){results.push({key:item.key,status:'cancelled',reason:'後の編集を保持しました。'});return;}
      try{englishSimpleInvalidate_(ctx.sheet,r,reason);}catch(_){reason+=' 状態表示・再表示を更新できませんでした。';}
      results.push({key:item.key,status:'failed',reason:reason});
    }
    keys.forEach(function(key){const r=map[key],reason=englishSimpleReason_(r)||(selection&&!selection.check(r)?'受付後に内容または判断が変わりました。Jを選び直してください。':'');
      if(reason){failure({key:key},reason);return;}
      const proof=englishProposalProof_(r.proposalText,'採用希望');
      if(proof.length>45000||r.sourceText.length>45000){failure({key:key},'確認記録の保存上限を超えています。');return;}
      active.push({key:key,hash:englishNativeHash_(r),previous:englishNativeProofHash_(r),proof:proof,source:r.sourceText,existing:englishSimpleReceipt_(r),operation:operation+'-'+englishReviewDigest_(key).slice(0,12)});
    });
    function same(r,item){return !englishSimpleReason_(r)&&englishNativeHash_(r)===item.hash&&(!selection||selection.check(r));}
    function proofMatches(r,item){return r&&r.row[20]===item.source&&r.row[21]===item.proof&&!!r.row[22]&&(item.existing?englishNativeProofHash_(r)===item.previous:r.row[23]===item.operation);}
    function stage(check,write){
      if(!active.length)return;
      try{data=englishProposalRead_(keys);map=englishNativeMap_(data);}catch(_){active.forEach(function(item){failure(item,'再照合できません。入力を保持しています。');});active=[];return;}
      active=active.filter(function(item){const r=map[item.key];
        if(Date.now()-started>180000){failure(item,'処理時間の上限に近づいたため中断しました。同じメニューで再実行してください。');return false;}
        if(!same(r,item)||!check(r,item)){failure(item,'処理中に原文・提案・判断・確認記録が変わりました。内容を読み直してください。');return false;}
        try{write(r,item);return true;}catch(_){failure(item,'保存または非表示に失敗しました。同じメニューで再実行できます。');return false;}
      });SpreadsheetApp.flush();
    }
    stage(function(r,item){return englishNativeProofHash_(r)===item.previous;},function(r,item){
      if(!item.existing)englishProposalWrite_(ctx.sheet,englishProposalRow_(ctx.sheet,r),21,[item.source,item.proof,new Date().toISOString(),item.operation]);
    });
    stage(proofMatches,function(r,item){
      if(!item.existing)englishProposalWrite_(ctx.sheet,englishProposalRow_(ctx.sheet,r),25,['確認済（本番未反映）',(r.row[25].indexOf(ENGLISH_SIMPLE_HIDDEN)>=0?ENGLISH_SIMPLE_HIDDEN+' ':'')+'Jの採用希望を実行時に照合。最終検証: '+new Date().toISOString()]);
    });
    stage(function(r,item){return proofMatches(r,item)&&englishSimpleReceipt_(r);},function(r,item){
      // Saving is verified before display-only hiding. Hiding does not certify current validity.
      try{results.push({key:item.key,status:'saved',reason:englishSimpleHide_(ctx.sheet,r)});}
      catch(_){results.push({key:item.key,status:'display-error',reason:'確認済の保存は確認。非表示に失敗しました。再実行または再表示メニューを使ってください。'});}
    });
    return summary;
  });
}
function processJapaneseEnglishAdoptions() {
  return reviewJapaneseEnglishBatch();
}
function showJapaneseEnglishConfirmedRows() {
  const ui=SpreadsheetApp.getUi();
  try{const result=englishNativeLock_(function(){const ctx=englishNativeContext_(),owned=englishSimpleIndex_(ctx).filter(function(r){return r.owned;}),property='english-simple-show-cursor:'+ctx.book.getId();
    if(!owned.length)return {shown:0,left:0,errors:[]};
    const last=ctx.props.getProperty(property),start=(owned.findIndex(function(r){return r.key===last;})+1)%owned.length,chosen=owned.slice(start).concat(owned.slice(0,start)).slice(0,20);
    ctx.props.setProperty(property,chosen[chosen.length-1].key);
    const errors=[];let shown=0;
    chosen.forEach(function(entry){const r={id:entry.id,version:entry.key.split('/')[1],rowNumber:entry.row};try{englishSimpleReveal_(ctx.sheet,r);shown++;}catch(_){errors.push(entry.key);}});
    return {shown:shown,left:owned.length-shown,errors:errors};});
    ui.alert(result.shown+'件の自動非表示を解除しました。残り '+result.left+'件。'+(result.errors.length?'再試行が必要：'+result.errors.join(', '):'')+'\n残りがあれば同じメニューを再実行します。フィルタや利用者が手動で非表示にした行は変更しません。');
  }catch(error){ui.alert(error.message||'再表示できませんでした。');}
}
function showJapaneseEnglishReviewStatus() {
  const ui=SpreadsheetApp.getUi();
  try{const ctx=englishNativeContext_(),index=englishSimpleIndex_(ctx),legacy=englishReviewSheet_().sheet,count=Math.max(0,legacy.getLastRow()-1),ids=new Set((count?legacy.getRange(2,1,count,1).getDisplayValues():[]).map(function(r){return r[0];}).filter(Boolean)),prepared=new Set(index.map(function(r){return r.id;}));
    let missing=0;ids.forEach(function(id){if(!prepared.has(id))missing++;});
    ui.alert('日英修正案の準備状況', '既存候補 '+ids.size+'項目／改訂案あり '+prepared.size+'項目／未準備 '+missing+'項目／提案 '+index.length+'版。\nJ採用希望 '+index.filter(function(r){return r.decision==='採用希望';}).length+'件／自動非表示 '+index.filter(function(r){return r.owned;}).length+'件。\n\nPCで本文・根拠を読み、「候補を確認・非表示」を実行します。メニューを選ぶと最大50件を内部で固定・再検査し、追加確認なしで処理します。結果は件数と要対応だけを表示します。J未確認と既存の採用希望が対象です。修正希望・見送り・保留・不一致・非表示行は変更しません。\n最大50件ずつ巡回します。未準備は未完了、保留・旧版・変更ありは未確定のまま残します。文言を直す場合はID・版と修正内容を添えて新版を依頼してください。原文更新後は再確認、本番転記・公開は別工程です。',ui.ButtonSet.OK);
  }catch(error){ui.alert(error.message);}
}

function englishNativeContext_() {
  if (typeof notesEnglishLegacyGuard_ === 'function') notesEnglishLegacyGuard_();
  const book=SpreadsheetApp.getActiveSpreadsheet(),sheet=book&&book.getSheetByName('日英修正案');
  if(!book||!sheet)throw new Error('対象の「日英修正案」シートを開いてください。');
  return {book:book,sheet:sheet,property:'english-native-review:'+book.getId(),props:PropertiesService.getUserProperties()};
}
function englishNativeLock_(fn) {
  const lock=LockService.getDocumentLock();
  if(!lock||!lock.tryLock(10000))throw new Error('ほかの確認処理が実行中です。少し待ってください。');
  try{return fn();}finally{lock.releaseLock();}
}
function englishNativePut_(ctx,session) {
  const text=JSON.stringify(session);
  // Properties limit is 9 KB per value. Store hashes, never candidate bodies, with an 8 KB ceiling.
  if(encodeURIComponent(text).replace(/%[A-F0-9]{2}/g,'x').length>8000)throw new Error('確認セッションの容量を超えています。対象を減らしてください。');
  ctx.props.setProperty(ctx.property,text);
}
function englishNativeGet_(ctx,required) {
  const raw=ctx.props.getProperty(ctx.property);
  if(!raw){if(required)throw new Error('この利用者の確認開始記録がありません。先に「選択行の確認を開始」を実行してください。');return null;}
  let s;try{s=JSON.parse(raw);}catch(_){throw new Error('確認開始記録を読めません。「シート確認を中止」で解除してください。');}
  if(s.v!==1||s.book!==ctx.book.getId()||s.sheet!==ctx.sheet.getSheetId()||!Array.isArray(s.items)||s.items.length>20||
      !/^[a-zA-Z0-9-]{16,80}$/.test(s.id)||!Number.isFinite(s.expires))throw new Error('確認開始記録が不正です。「シート確認を中止」で解除してください。');
  return s;
}
function englishNativeLive_(ctx,s) {
  if(s.phase==='expired')throw new Error('確認開始記録は失効しています。Jの入力は残っています。確認を開始し直してください。');
  if(s.expires<=Date.now()){
    s.phase='expired';englishNativePut_(ctx,s);throw new Error('確認開始から2時間が経過しました。Jの入力は残っています。確認を開始し直してください。');
  }
}
function englishNativeSelection_(ctx) {
  if(ctx.book.getActiveSheet().getSheetId()!==ctx.sheet.getSheetId())throw new Error('「日英修正案」タブで対象行を選んでください。');
  const list=ctx.book.getSelection().getActiveRangeList(),ranges=list?list.getRanges():[];
  const rows=new Set();
  ranges.forEach(function (r) {
    // Filter views are not exposed by isRowHiddenByFilter. Never expand a rectangle across hidden rows.
    if(r.getSheet().getSheetId()!==ctx.sheet.getSheetId()||r.getNumRows()!==1||r.getNumColumns()!==1||r.getRow()<5||r.getColumn()>26)
      throw new Error('各行のセルを1つずつ選んでください。複数行はCtrlを押して個別選択します。複数行をまたぐ範囲は、非表示行を含む恐れがあるため使えません。');
    const n=r.getRow();
    if(ctx.sheet.isRowHiddenByFilter(n)||ctx.sheet.isRowHiddenByUser(n))throw new Error('非表示の行が選択されています。表示中の行を選び直してください。');
    rows.add(n);
  });
  if(!rows.size||rows.size>20)throw new Error('表示中の対象行を1〜20件選んでください。');
  const keys=Array.from(rows).map(function (n) {
    return ctx.sheet.getRange(n,1,1,1).getDisplayValues()[0][0]+'/'+ctx.sheet.getRange(n,16,1,1).getDisplayValues()[0][0];
  });
  if(new Set(keys).size!==keys.length||keys.some(function (k) {return !/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(k);}))throw new Error('選択行のID・版が不正または重複しています。');
  return keys.sort();
}
function englishNativeMap_(data){const map=Object.create(null);data.records.forEach(function (r){map[r.key]=r;});return map;}
function englishNativeRead_(ctx,s,keys) {
  try{return englishProposalRead_(keys);}
  catch(error){
    // Structural/duplicate failures must latch too; removing the duplicate must not revive this review.
    s.phase='expired';englishNativePut_(ctx,s);
    throw new Error((error.message||'原文・提案を照合できません。')+' この確認開始記録は失効しました。入力を保持しています。構成を確認し、開始し直してください。');
  }
}
function englishNativeHash_(r) {
  return englishReviewDigest_([r.row.slice(0,9),r.row.slice(10,20),r.formulas.slice(0,20),r.proposalNotes.slice(0,20),r.sourceText]);
}
function englishNativeProofHash_(r){return englishReviewDigest_(r.row.slice(20,24));}
function englishNativeMarker_(s,state){return '[sheet-review:'+s.id+':'+state+']';}
function englishNativeOwn_(r,s){return !!r&&r.row[25].indexOf('[sheet-review:'+s.id+':')===0;}
function englishNativeReady_(r,s){return !!r&&r.row[24]==='再確認が必要'&&r.row[25].indexOf(englishNativeMarker_(s,'ready'))===0;}
function englishNativeOperation_(s,e){return s.id+'-'+englishReviewDigest_(e.k).slice(0,12);}
function englishNativeReason_(r,e,s,proof) {
  if(!r||!r.latest)return 'missing';
  if(r.blocked||r.formulas[9]||englishNativeHash_(r)!==e.h)return 'changed';
  if(!englishNativeReady_(r,s))return 'session';
  if(!proof&&englishNativeProofHash_(r)!==e.p)return 'other';
  return '';
}
function englishNativeFailure_(ctx,s,e,data,code) {
  e.state='failed';e.code=code;englishNativePut_(ctx,s); // Persist the latch before attempting another sheet write.
  const r=englishNativeMap_(data)[e.k];
  if(!englishNativeOwn_(r,s))return; // Never overwrite another reviewer's confirmation.
  try{const row=englishProposalRow_(ctx.sheet,r),current=ctx.sheet.getRange(row,26,1,1).getDisplayValues()[0][0];
    if(current.indexOf('[sheet-review:'+s.id+':')!==0)return;
    englishProposalWrite_(ctx.sheet,row,25,['再確認が必要',englishNativeMarker_(s,'invalid')+' '+englishNativeError_(code)+' 最終検査: '+new Date().toISOString()]);}
  catch(_){e.code='unknown';englishNativePut_(ctx,s);}
}
function englishNativeError_(code) {
  return {missing:'対象行・最新版の対応が変わりました。',changed:'原文・提案・版・数式・メモが変わりました。',session:'確認開始記録が失効、または別の確認に切り替わっています。',other:'別の確認記録が保存されています。',decision:'Jの判断が変更、未確認、または不正です。',hold:'保留中または日本語・英訳が空欄のため採用希望を確定できません。',write:'保存途中に失敗しました。',unknown:'保存または失効の結果を確認できません。'}[code]||'再確認が必要です。';
}
function englishNativeReceipt_(r,e,s) {
  if(!r||!r.latest||r.blocked||englishNativeHash_(r)!==e.h||r.decision!==e.d||r.validity!=='確認済（本番未反映）'||r.row[23]!==englishNativeOperation_(s,e))return false;
  return r.row[20]===r.sourceText&&englishProposalProofMatches_(r.row[21],r.proposalText,e.d);
}

function englishNativePrepareStart_() {
  return englishNativeLock_(function () {
    const ctx=englishNativeContext_(),old=englishNativeGet_(ctx,false);
    if(old&&old.expires>Date.now()&&['done','expired'].indexOf(old.phase)<0)throw new Error('この利用者には開始済みの確認があります。続けるか「シート確認を中止」で解除してください。');
    const keys=englishNativeSelection_(ctx),data=englishProposalRead_(keys),map=englishNativeMap_(data);
    const s={v:1,id:Utilities.getUuid(),book:ctx.book.getId(),sheet:ctx.sheet.getSheetId(),expires:Date.now()+ENGLISH_NATIVE_TTL,phase:'starting',until:Date.now()+ENGLISH_NATIVE_PROMPT_TTL,items:[]};
    keys.forEach(function (key) {
      const r=map[key];if(!r||!r.latest||r.blocked||r.formulas[9])throw new Error(key+'：原文・提案・版の確認が必要です。Jの入力は変更していません。');
      s.items.push({k:key,h:englishNativeHash_(r),p:englishNativeProofHash_(r),b:r.decision,state:'ready',initial:r.revision});
    });
    englishNativePut_(ctx,s);return {id:s.id,keys:keys,previousConfirmed:data.records.filter(function (r){return r.validity==='確認済（本番未反映）';}).length};
  });
}
function englishNativeFinishStart_(id,accepted) {
  return englishNativeLock_(function () {
    const ctx=englishNativeContext_(),s=englishNativeGet_(ctx,true);
    if(s.id!==id||s.phase!=='starting')throw new Error('確認開始の操作が切り替わりました。');
    if(!accepted){ctx.props.deleteProperty(ctx.property);return {cancelled:true};}
    englishNativeLive_(ctx,s);
    if(s.until<Date.now()){s.phase='expired';englishNativePut_(ctx,s);throw new Error('確認メッセージの期限が切れました。開始し直してください。');}
    const keys=s.items.map(function (e){return e.k;});
    if(JSON.stringify(englishNativeSelection_(ctx))!==JSON.stringify(keys))throw new Error('選択が変わりました。「シート確認を中止」後に開始し直してください。');
    let data=englishNativeRead_(ctx,s,keys),map=englishNativeMap_(data);
    if(s.items.some(function (e){return !map[e.k]||map[e.k].revision!==e.initial;})){
      s.phase='expired';englishNativePut_(ctx,s);throw new Error('確認メッセージの間に内容が変わりました。入力を保っています。開始し直してください。');
    }
    s.phase='initializing';englishNativePut_(ctx,s);
    try{
      s.items.forEach(function (e){const r=map[e.k];englishProposalWrite_(ctx.sheet,englishProposalRow_(ctx.sheet,r),25,['再確認が必要',englishNativeMarker_(s,'ready')+' 確認中・未確定。Jの入力だけでは確定しません。開始時照合: '+new Date().toISOString()]);delete e.initial;});
      SpreadsheetApp.flush();data=englishProposalRead_(keys);map=englishNativeMap_(data);
      s.items.forEach(function(e){const code=englishNativeReason_(map[e.k],e,s,false);if(code)englishNativeFailure_(ctx,s,e,data,code);});
      s.phase='ready';delete s.until;englishNativePut_(ctx,s);
      return {count:s.items.filter(function(e){return e.state==='ready';}).length,failed:s.items.filter(function(e){return e.state==='failed';}).length};
    }catch(error){s.phase='expired';englishNativePut_(ctx,s);throw error;}
  });
}

function englishNativePrepareConfirm_() {
  return englishNativeLock_(function () {
    const ctx=englishNativeContext_(),s=englishNativeGet_(ctx,true);englishNativeLive_(ctx,s);
    if(s.phase==='confirming'&&s.until<Date.now()){s.phase='ready';delete s.ticket;delete s.pending;englishNativePut_(ctx,s);}
    if(['ready','done','saving'].indexOf(s.phase)<0)throw new Error('別の確認メッセージまたは開始処理が実行中です。閉じるか「シート確認を中止」を実行してください。');
    const keys=englishNativeSelection_(ctx),entries=keys.map(function(k){return s.items.find(function(e){return e.k===k;});});
    if(entries.some(function(e){return !e;}))throw new Error('確認開始していない行が含まれます。開始した対象だけを選んでください。');
    const data=englishNativeRead_(ctx,s,keys),map=englishNativeMap_(data),pending=[],results=[];
    entries.forEach(function(e){const r=map[e.k];
      if(e.state==='saved'||e.state==='saving'){
        if(englishNativeReceipt_(r,e,s)){e.state='saved';results.push({key:e.k,status:'saved'});return;}
        englishNativeFailure_(ctx,s,e,data,'unknown');
      }
      if(e.state==='failed'){results.push({key:e.k,status:'failed',reason:englishNativeError_(e.code)});return;}
      let code=englishNativeReason_(r,e,s,false);
      if(!code&&['採用希望','修正希望','見送り'].indexOf(r.decision)<0)code='decision';
      if(!code&&r.decision==='採用希望'&&(r.preparation==='保留'||!r.ja.trim()||!r.english.trim()))code='hold';
      if(code){englishNativeFailure_(ctx,s,e,data,code);results.push({key:e.k,status:'failed',reason:englishNativeError_(code)});return;}
      pending.push({k:e.k,d:r.decision,unchanged:r.decision===e.b});
    });
    if(!pending.length){
      if(results.some(function(r){return r.status==='saved';})&&results.some(function(r){return r.status!=='saved';})){
        let fresh;try{fresh=englishProposalRead_(keys);}catch(_){fresh=null;}
        const checked=fresh?englishNativeMap_(fresh):{};
        results.forEach(function(r){if(r.status!=='saved')return;const e=s.items.find(function(item){return item.k===r.key;});if(!englishNativeReceipt_(checked[r.key],e,s)){englishNativeFailure_(ctx,s,e,fresh||data,'unknown');r.status='failed';r.reason=englishNativeError_('unknown');}});
      }
      s.phase=s.items.some(function(e){return e.state==='ready';})?'ready':'done';englishNativePut_(ctx,s);return {results:results,pending:[]};
    }
    s.phase='confirming';s.ticket=Utilities.getUuid();s.until=Date.now()+ENGLISH_NATIVE_PROMPT_TTL;s.pending=pending.map(function(p){return {k:p.k,d:p.d};});
    s.receipts=results.filter(function(r){return r.status==='saved';}).map(function(r){return r.key;});
    englishNativePut_(ctx,s);return {id:s.id,ticket:s.ticket,pending:pending,results:results};
  });
}
function englishNativeConfirm_(id,ticket,accepted) {
  return englishNativeLock_(function () {
    const ctx=englishNativeContext_(),s=englishNativeGet_(ctx,true);englishNativeLive_(ctx,s);
    if(s.id!==id||s.ticket!==ticket||s.phase!=='confirming')throw new Error('確定操作が切り替わりました。保存していません。');
    if(!accepted){s.phase='ready';delete s.pending;delete s.ticket;englishNativePut_(ctx,s);return {cancelled:true,results:[]};}
    if(s.until<Date.now()){s.phase='ready';delete s.pending;delete s.ticket;englishNativePut_(ctx,s);throw new Error('確認メッセージの期限が切れました。もう一度「選択行の確認を確定」を実行してください。');}
    // The confirmation fixes IDs/decisions, independent of a later active-cell move.
    const choices=s.pending,keys=choices.map(function(p){return p.k;}).concat(s.receipts||[]);let data=englishNativeRead_(ctx,s,keys),map=englishNativeMap_(data),active=[],results=[],finalChecked=false;
    choices.forEach(function(p){const e=s.items.find(function(item){return item.k===p.k;}),r=map[e.k];let code=englishNativeReason_(r,e,s,false);
      if(!code&&r.decision!==p.d)code='decision';
      if(!code&&p.d==='採用希望'&&(r.preparation==='保留'||!r.ja.trim()||!r.english.trim()))code='hold';
      if(code){englishNativeFailure_(ctx,s,e,data,code);return;}
      e.d=p.d;e.state='saving';active.push(e);
    });
    s.phase='saving';englishNativePut_(ctx,s);
    function proof(r,e){return englishProposalProof_(r.proposalText,e.d);}
    function matches(r,e){return !!r&&r.row[20]===r.sourceText&&r.row[21]===proof(r,e)&&r.row[23]===englishNativeOperation_(s,e);}
    function stage(check,write){
      if(!active.length)return;
      try{data=englishProposalRead_(keys);map=englishNativeMap_(data);}catch(_){active.forEach(function(e){englishNativeFailure_(ctx,s,e,data,'unknown');});active=[];return;}
      active=active.filter(function(e){const r=map[e.k];const code=englishNativeReason_(r,e,s,true);
        if(code||r.decision!==e.d||!check(r,e)){englishNativeFailure_(ctx,s,e,data,code||'decision');return false;}
        try{write(r,e);return true;}catch(_){englishNativeFailure_(ctx,s,e,data,'write');return false;}
      });SpreadsheetApp.flush();
    }
    stage(function(r,e){return englishNativeProofHash_(r)===e.p;},function(r,e){
      const text=proof(r,e);if(text.length>45000||r.sourceText.length>45000)throw new Error('確認記録の上限');
      englishProposalWrite_(ctx.sheet,englishProposalRow_(ctx.sheet,r),21,[r.sourceText,text,new Date().toISOString(),englishNativeOperation_(s,e)]);
    });
    stage(matches,function(r,e){
      englishProposalWrite_(ctx.sheet,englishProposalRow_(ctx.sheet,r),25,['確認済（本番未反映）',englishNativeMarker_(s,'done')+' 最終検証: '+new Date().toISOString()+'。この時点の確認記録です。次の変更時は再確認が必要です。']);
    });
    if(active.length){
      try{data=englishProposalRead_(keys);map=englishNativeMap_(data);finalChecked=true;active.forEach(function(e){if(englishNativeReceipt_(map[e.k],e,s))e.state='saved';else englishNativeFailure_(ctx,s,e,data,'changed');});}
      catch(_){active.forEach(function(e){englishNativeFailure_(ctx,s,e,data,'unknown');});}
    }
    choices.forEach(function(p){const e=s.items.find(function(item){return item.k===p.k;});results.push({key:e.k,status:e.state==='saved'?'saved':'failed',reason:e.state==='saved'?'':englishNativeError_(e.code)});});
    if((s.receipts||[]).length){
      if(!finalChecked){try{data=englishProposalRead_(keys);map=englishNativeMap_(data);}catch(_){map={};}}
      s.receipts.forEach(function(key){const e=s.items.find(function(item){return item.k===key;});if(!englishNativeReceipt_(map[key],e,s))englishNativeFailure_(ctx,s,e,data,'unknown');results.push({key:key,status:e.state==='saved'?'saved':'failed',reason:e.state==='saved'?'':englishNativeError_(e.code)});});
    }
    s.phase=s.items.some(function(e){return e.state==='ready';})?'ready':'done';delete s.ticket;delete s.pending;delete s.until;delete s.receipts;englishNativePut_(ctx,s);
    return {results:results};
  });
}

function englishNativeReport_(results){return results.map(function(r){return r.key+'：'+(r.status==='saved'?'確認済（本番未反映）':r.reason+' Jの入力は保持。中止して確認開始からやり直してください。');}).join('\n');}
function startJapaneseEnglishSheetReview() {
  const ui=SpreadsheetApp.getUi();
  try{const prepared=englishNativePrepareStart_();
    const yes=ui.alert('選択行の確認を開始',prepared.keys.length+'件：\n'+prepared.keys.join('\n')+'\n\n既に確認済みの対象は'+prepared.previousConfirmed+'件です。選択した対象のYを「再確認が必要」にし、Jの入力と過去の確認記録U:Xを残します。これから本文・版・根拠を読み直しますか？',ui.ButtonSet.YES_NO)===ui.Button.YES;
    const result=englishNativeFinishStart_(prepared.id,yes);if(result.cancelled)return;
    ui.alert(result.count+'件の確認を開始しました（失効 '+result.failed+'件）。期限は2時間です。\n本文・版・根拠を読み、Jで判断してください。確定する行を個別に選び直し、「選択行の確認を確定」を実行します。');
  }catch(error){ui.alert(error.message||'確認開始に失敗しました。入力は保持しています。');}
}
function confirmJapaneseEnglishSheetReview() {
  const ui=SpreadsheetApp.getUi();
  try{const prepared=englishNativePrepareConfirm_();if(!prepared.pending.length){ui.alert(englishNativeReport_(prepared.results));return;}
    const counts={};prepared.pending.forEach(function(p){counts[p.d]=(counts[p.d]||0)+1;});
    const text=prepared.pending.length+'件を今回の判断として確定します。\n'+Object.keys(counts).map(function(d){return d+' '+counts[d]+'件';}).join(' ／ ')+'\n'+prepared.pending.map(function(p){return p.k+'：'+p.d;}).join('\n')+'\n\n開始前と同じJの値は'+prepared.pending.filter(function(p){return p.unchanged;}).length+'件です。既存の値も含め、開始後に本文・版・根拠を読み直し、上記を今回の判断として確認しましたか？ 本番には反映しません。';
    const yes=ui.alert('選択分の確認版を登録',text,ui.ButtonSet.YES_NO)===ui.Button.YES;
    const result=englishNativeConfirm_(prepared.id,prepared.ticket,yes);if(!result.cancelled)ui.alert(englishNativeReport_(prepared.results.filter(function(r){return r.status!=='saved';}).concat(result.results)));
  }catch(error){ui.alert((error.message||'保存結果を確認できません。')+'\nJの入力は変更していません。自動再送はしません。');}
}
function cancelJapaneseEnglishSheetReview() {
  const ui=SpreadsheetApp.getUi();
  const ctx=englishNativeContext_(),raw=ctx.props.getProperty(ctx.property);
  if(!raw){ui.alert('この利用者の確認開始記録はありません。');return;}
  if(ui.alert('シート確認を中止','この利用者の開始記録を解除します。Jと確認履歴は変更せず、未確定のYは再確認のままです。続けますか？',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  try{englishNativeLock_(function(){if(ctx.props.getProperty(ctx.property)!==raw)throw new Error('確認処理が進んだため中止していません。状態を確認してください。');ctx.props.deleteProperty(ctx.property);});ui.alert('確認開始記録を解除しました。Jの入力は保持しています。');}
  catch(error){ui.alert(error.message);}
}
function inspectAllJapaneseEnglishProposals() {
  const ui=SpreadsheetApp.getUi();
  if(ui.alert('全件の有効性を点検','全提案と正本を照合します。件数により時間がかかります。変更を検出した確認は失効させます。Jの判断・候補本文・正本は変更しません。続けますか？',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  try{const result=getJapaneseEnglishProposals();ui.alert('全'+result.records.length+'版を点検しました。再確認が必要：'+result.records.filter(function(r){return r.validity==='再確認が必要';}).length+'件。判定は最終検証時点のものです。本番反映前にも必ず再照合します。');}
  catch(error){ui.alert(error.message);}
}

// Extends the existing onEdit; no new installed trigger. API/script writes still require explicit revalidation.
function englishNativeProposalEdited(e) {
  const range=e&&e.range;if(!range)return false;const sheet=range.getSheet();
  if(sheet.getName()!=='日英修正案')return false;
  // When explicitly enabled, the installed handler owns proposal edit invalidation/receipts.
  // The simple trigger must not race it and invalidate a just-completed mobile confirmation.
  if(!e.triggerUid&&typeof englishMobileEnabled_==='function'&&englishMobileEnabled_())return true;
  if(range.getLastRow()<5||range.getColumn()>26)return true;
  const first=Math.max(5,range.getRow()),last=Math.min(sheet.getLastRow(),range.getLastRow());if(first>last)return true;
  const count=last-first+1,ids=sheet.getRange(first,1,count,1).getDisplayValues(),states=sheet.getRange(first,25,count,2).getDisplayValues();
  const onlyJ=range.getColumn()===10&&range.getLastColumn()===10;
  let block=[];function flush(start){if(block.length){sheet.getRange(start,25,block.length,2).setRichTextValues(block.map(function(row){return row.map(function(v){return SpreadsheetApp.newRichTextValue().setText(v).build();});}));block=[];}}
  let blockStart=first;
  ids.forEach(function(row,i){if(!row[0]){flush(blockStart);blockStart=first+i+1;return;}
    const autoMarker=states[i][1].indexOf(ENGLISH_SIMPLE_HIDDEN)>=0?ENGLISH_SIMPLE_HIDDEN+' ':'';
    const match=/^\[sheet-review:([a-zA-Z0-9-]{16,80}):(ready|invalid|done)\]/.exec(states[i][1]);
    const pending=onlyJ&&match&&match[2]==='ready'&&states[i][0]==='再確認が必要';
    const marker=autoMarker+(match?'[sheet-review:'+match[1]+':'+(pending?'ready':'invalid')+'] ':'');
    block.push(['再確認が必要',marker+(pending?'確認中・Jの入力は未確定です。':'直接編集を検出しました。以前の確認は有効に戻しません。')+' 最終検査: '+new Date().toISOString()]);
  });flush(blockStart);return true;
}
