/** Explicit PC-menu execution with internal frozen selection. No source writes or triggers. */
const ENGLISH_MANUAL_PREFIX='english-manual-batch:';
const ENGLISH_MANUAL_LIMIT=50;
const ENGLISH_MANUAL_GROUP_LIMIT=10;
const ENGLISH_MANUAL_BUDGET=180000;
// One menu-wide budget includes selection, binding, confirmation and bookkeeping.
// Stop work 30 seconds early; a blocking service call can still overrun the reserve.
const ENGLISH_MANUAL_MENU_BUDGET=240000;
const ENGLISH_MANUAL_CLEANUP_RESERVE=30000;
const ENGLISH_MANUAL_BIND_GROUP=5;
let englishManualTiming_=null;
function englishManualMeasure_(name,fn){
  const timing=englishManualTiming_;if(!timing)return fn();const start=Date.now();
  try{return fn();}finally{const value=timing.phases[name]||(timing.phases[name]={calls:0,inclusiveMs:0});value.calls++;value.inclusiveMs+=Math.max(0,Date.now()-start);}
}
function englishManualContext_() {
  const ctx=englishNativeContext_();
  if(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')!==ctx.book.getId())throw new Error('対象ブックとSPREADSHEET_IDが一致しません。');
  if(ctx.book.getActiveSheet().getSheetId()!==ctx.sheet.getSheetId())throw new Error('「日英修正案」タブから実行してください。');
  ctx.property=ENGLISH_MANUAL_PREFIX+ctx.book.getId();return ctx;
}
function englishManualMobile_(key) {
  const props=PropertiesService.getDocumentProperties();
  if(!props)throw new Error('共有受付状態を確認できません。');
  return props.getProperty('english-mobile-latest:'+key)||'';
}
function englishManualRawHash_(ctx,r) {
  return englishReviewDigest_([r.row,r.formulas,r.proposalNotes,ctx.sheet.isRowHiddenByUser(r.rowNumber),ctx.sheet.isRowHiddenByFilter(r.rowNumber),englishManualMobile_(r.key),r.request||null]);
}
function englishManualBodyHash_(r){return englishReviewDigest_([englishNativeHash_(r),r.latest,r.blocked]);}
function englishManualSnapshotHash_(ctx,r){return englishReviewDigest_([englishManualRawHash_(ctx,r),englishManualBodyHash_(r)]);}
function englishManualReason_(ctx,r) {
  if(!r||!r.latest)return '旧版または対象不明';
  if(r.blocked)return r.reason||'原文・案・元行が不一致';
  if(r.row[20]&&r.row[20]!==r.sourceText)return '過去の確認原文と不一致';
  if(r.row[24]==='確認済（本番未反映）'&&!englishSimpleReceipt_(r))return '過去の確認記録と不一致';
  if(r.preparation!=='確認待ち')return 'Iが確認待ちではありません（保留等）';
  if(!['未確認','採用希望'].includes(r.decision)||r.formulas[9])return 'Jの判断・数式を保持';
  if(!r.ja.trim()||!r.english.trim())return '日本語または英訳が空欄';
  if(ctx.sheet.isRowHiddenByUser(r.rowNumber)||ctx.sheet.isRowHiddenByFilter(r.rowNumber))return '非表示・フィルタ内（表示してから確認）';
  if(r.sourceText.length>45000||englishProposalProof_(r.proposalText,'採用希望').length>45000)return '確認記録の保存上限';
  return '';
}
function englishManualPut_(ctx,s){englishNativePut_(ctx,s);}
function englishManualGet_(ctx,id) {
  let s;try{s=JSON.parse(ctx.props.getProperty(ctx.property)||'null');}catch(_){}
  if(!s||s.v!==2||s.id!==id||s.book!==ctx.book.getId()||s.sheet!==ctx.sheet.getSheetId()||!Array.isArray(s.items)||s.items.length>ENGLISH_MANUAL_LIMIT||!Number.isFinite(s.expires)||
    new Set(s.items.map(function(i){return i.key;})).size!==s.items.length||s.items.some(function(i){return !/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(i.key)||!['未確認','採用希望'].includes(i.decision)||!/^[a-f0-9]{64}$/.test(i.hash);})||
    !Array.isArray(s.pending)||s.pending.length+s.items.length>50||s.pending.some(function(k){return typeof k!=='string'||!/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(k);})||new Set(s.pending.concat(s.items.map(function(i){return i.key;}))).size!==s.pending.length+s.items.length)throw new Error('プレビュー記録が不正・別の画面です。やり直してください。');
  return s;
}
function englishManualQueue_(ctx) {
  const index=englishManualMeasure_('index',function(){return englishSimpleIndex_(ctx);});
  // The owned marker is historical: ordinary Sheets unhide leaves it intact.
  // Skip completed rows only when they are still hidden; visible rows must revalidate.
  // Holds in either I or J never enter the frozen 50-item window or binding batch.
  return index.filter(function(r){return r.preparation!=='保留'&&r.decision!=='保留'&&!(r.decision==='採用希望'&&r.validity==='確認済（本番未反映）'&&r.owned&&!r.hidePending&&ctx.sheet.isRowHiddenByUser(r.row));});
}
// Continuation is an ordering hint, never an adoption authorization. A new invocation
// freezes and validates every item again. Ignore the old cursor once, to recover rows
// skipped by the previous binding limit. Keep at most one 50-key unfinished window.
function englishManualProgress_(ctx) {
  const raw=ctx.props.getProperty(ctx.property+':progress');if(!raw)return {schema:1,pending:[],cursor:''};
  let p;try{p=JSON.parse(raw);}catch(_){}
  const valid=function(k){return typeof k==='string'&&/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(k);};
  if(!p||p.schema!==1||!Array.isArray(p.pending)||p.pending.length>50||p.pending.some(function(k){return !valid(k);})||new Set(p.pending).size!==p.pending.length||p.cursor!==''&&!valid(p.cursor))throw new Error('続行記録が不正です。入力を保持して停止しました。');
  return p;
}
function englishManualProgressPut_(ctx,pending,cursor){
  const p={schema:1,pending:pending,cursor:cursor};
  ctx.props.setProperty(ctx.property+':progress',JSON.stringify(p));
}
function englishManualPreview_(bindDrafts,window) {
  return englishNativeLock_(function(){
    const ctx=englishManualContext_();
    const prior=ctx.props.getProperty(ctx.property);if(prior){let old;try{old=JSON.parse(prior);}catch(_){}if(old&&old.phase==='running'&&old.expires>Date.now())throw new Error('この利用者の処理が実行中です。完了後に再プレビューしてください。');}
    const queue=englishManualQueue_(ctx),progress=englishManualProgress_(ctx),byKey=Object.create(null);queue.forEach(function(r){byKey[r.key]=r;});
    const pending=progress.pending.filter(function(k){return !!byKey[k];}),pendingSet=new Set(pending);
    const start=(queue.findIndex(function(r){return r.key===progress.cursor;})+1)%Math.max(1,queue.length);
    const chosen=window?window.entries.map(function(r){return byKey[r.key]||r;}):pending.map(function(k){return byKey[k];}).concat(queue.slice(start).concat(queue.slice(0,start)).filter(function(r){return !pendingSet.has(r.key);})).slice(0,ENGLISH_MANUAL_LIMIT);
    const cursor=window?window.cursor:(chosen.length?chosen[chosen.length-1].key:progress.cursor);
    // Save before binding: even a hard service interruption must not lose this window.
    if(!window)englishManualProgressPut_(ctx,chosen.map(function(r){return r.key;}),cursor);
    // Recheck the original menu snapshot before any binding. A later group must
    // not silently adopt edits/new versions made after this menu was selected.
    const changed=new Set(),rawHashes=Object.create(null);
    if(window){
      const before=englishManualMeasure_('validation',function(){return englishNativeMap_(englishProposalRead_(chosen.map(function(r){return r.key;}),true));});
      chosen.forEach(function(r){if(!before[r.key]||englishManualSnapshotHash_(ctx,before[r.key])!==window.hashes[r.key])changed.add(r.key);else rawHashes[r.key]=englishManualRawHash_(ctx,before[r.key]);});
    }
    const binding=bindDrafts===true&&typeof englishDraftBindChosen_==='function'?englishManualMeasure_('binding',function(){return englishDraftBindChosen_(ctx,chosen.filter(function(r){return !changed.has(r.key);}),window&&window.bindingDeadline,window?rawHashes:null);}):null;
    const bindingResults=Object.create(null);if(binding)(binding.results||[]).forEach(function(r){bindingResults[r.key]=r;});
    const map=chosen.length?englishManualMeasure_('validation',function(){return englishNativeMap_(englishProposalRead_(chosen.map(function(r){return r.key;}),true));}):{};
    const s={v:2,id:Utilities.getUuid(),book:ctx.book.getId(),sheet:ctx.sheet.getSheetId(),expires:Date.now()+10*60*1000,phase:'ready',items:[],pending:[],cursor:cursor},excluded=[],attention=[];
    chosen.forEach(function(entry){const r=map[entry.key],reason=englishManualReason_(ctx,r),bound=bindingResults[entry.key];
      // Completed binding must match the engine's own final cells. A partial
      // binding can only remain pending; its changed Q/K/Z never authorizes adoption.
      if(window&&r&&(bound&&bound.status==='bound'?englishManualRawHash_(ctx,r)!==bound.rawHash:!bound&&englishManualSnapshotHash_(ctx,r)!==window.hashes[entry.key]))changed.add(entry.key);
      const skip=!r||!r.latest||r.preparation!=='確認待ち'||!['未確認','採用希望'].includes(r.decision)||r.formulas[9]||ctx.sheet.isRowHiddenByUser(r.rowNumber)||ctx.sheet.isRowHiddenByFilter(r.rowNumber);
      if(skip){excluded.push({key:entry.key,reason:reason});return;}
      if(changed.has(entry.key)){attention.push({key:entry.key,reason:'メニュー開始後に原文・提案・版・判断・表示・受付が変わりました。再確認してください。'});return;}
      if(bound&&bound.status==='failed'){attention.push({key:entry.key,reason:bound.reason});return;}
      if((reason&&typeof ENGLISH_DRAFT_WAIT!=='undefined'&&reason===ENGLISH_DRAFT_WAIT)||(bound&&bound.status==='pending'&&!reason)){s.pending.push(entry.key);return;}
      if(reason){attention.push({key:entry.key,reason:reason});return;}
      s.items.push({key:r.key,decision:r.decision,hash:englishManualSnapshotHash_(ctx,r)});
    });
    englishManualPut_(ctx,s);
    const waiting=new Set(s.pending.concat(s.items.map(function(i){return i.key;})));
    const scope=new Set(chosen.map(function(r){return r.key;}));
    englishManualProgressPut_(ctx,window?progress.pending.filter(function(k){return !scope.has(k)||waiting.has(k);}):chosen.filter(function(r){return waiting.has(r.key);}).map(function(r){return r.key;}),cursor);
    const frozen=chosen.filter(function(r){return waiting.has(r.key);}).map(function(r){return {key:r.key,id:r.id,row:r.row,hash:englishManualSnapshotHash_(ctx,map[r.key])};});
    return {frozen:frozen,cursor:cursor,id:s.id,selected:s.items.map(function(i){return {key:i.key,decision:i.decision};}),pending:s.pending,attention:attention,binding:binding,excluded:excluded,scanned:chosen.length,remaining:queue.length,expires:new Date(s.expires).toISOString()};
  });
}
// Group only adjacent selected rows; never span an unselected or excluded row.
function englishManualGroups_(records) {
  const groups=[];
  records.slice().sort(function(a,b){return a.rowNumber-b.rowNumber;}).forEach(function(r){
    const last=groups[groups.length-1];
    if(last&&last[last.length-1].rowNumber+1===r.rowNumber)last.push(r);else groups.push([r]);
  });return groups;
}
// A previous interrupted run may already have a matching U:X receipt. Revalidate it,
// but preserve its original timestamp/operation instead of rewriting history.
function englishManualProof_(record) {
  const row=record.row.slice();row[24]='確認済（本番未反映）';
  return englishSimpleReceipt_(Object.assign({},record,{row:row,validity:row[24]}));
}
// Narrow readback is allowed only between an intention write and the next full
// source/metadata/identity validation. It never authorizes Y or final completion.
function englishManualReadback_(ctx,keys,previous){
  const next=Object.create(null);
  englishManualGroups_(keys.map(function(k){return previous[k];})).forEach(function(group){
    const range=ctx.sheet.getRange(group[0].rowNumber,1,group.length,30),v=range.getDisplayValues(),f=range.getFormulas(),n=range.getNotes();
    group.forEach(function(old,i){next[old.key]=Object.assign({},old,{row:v[i].slice(0,26),formulas:f[i].slice(0,26),proposalNotes:n[i].slice(0,26),decision:v[i][9],validity:v[i][24],request:{values:v[i].slice(26),formulas:f[i].slice(26),notes:n[i].slice(26)}});});
  });return next;
}
function englishManualConfirm_(id,yes,entryOwnsLock,menuDeadline) {
  const lock=entryOwnsLock===true?null:LockService.getScriptLock();if(entryOwnsLock!==true&&(!lock||!lock.tryLock(1000)))throw new Error('スマホまたは別の確認処理中です。同じメニューから再実行してください。');
  try{return englishNativeLock_(function(){
    const ctx=englishManualContext_(),s=englishManualGet_(ctx,id),started=Date.now(),deadline=Math.min(started+ENGLISH_MANUAL_BUDGET,Number.isFinite(menuDeadline)?menuDeadline:Infinity);
    if(s.phase!=='ready'||s.expires<=started)throw new Error('プレビューが期限切れ・実行済みです。再プレビューしてください。');
    s.phase='spent';englishManualPut_(ctx,s);if(!yes)return {cancelled:true};
    const allKeys=s.items.map(function(i){return i.key;}),initial=allKeys.length?englishManualMeasure_('validation',function(){return englishNativeMap_(englishProposalRead_(allKeys,true));}):{};
    s.items.forEach(function(i){const r=initial[i.key];if(englishManualReason_(ctx,r)||englishManualSnapshotHash_(ctx,r)!==i.hash)throw new Error('プレビュー後に原文・提案・版・判断・履歴・表示・受付が変わりました。書込みせず停止しました。');});
    const states=Object.create(null),shared=PropertiesService.getDocumentProperties();
    s.items.forEach(function(i){const r=initial[i.key];
      states[i.key]={row:r.row.slice(),formulas:r.formulas,notes:r.proposalNotes,request:r.request||null,body:englishManualBodyHash_(r),token:englishManualMobile_(i.key),hidden:false,existing:englishManualProof_(r),source:r.sourceText,
        proof:englishProposalProof_(r.proposalText,'採用希望'),operation:'manual-batch-'+s.id+'-'+englishReviewDigest_(i.key).slice(0,12)};
    });
    const chunks=[];
    englishManualGroups_(allKeys.map(function(key){return initial[key];})).forEach(function(group){
      for(let n=0;n<group.length;n+=ENGLISH_MANUAL_GROUP_LIMIT)chunks.push(group.slice(n,n+ENGLISH_MANUAL_GROUP_LIMIT).map(function(r){return r.key;}));
    });
    s.phase='running';englishManualPut_(ctx,s);
    let keys=[],touched=new Set(),map=initial,stopped='',deferred=false,results=[],stage='開始前',longestChunk=0;
    function current(){
      const live=englishManualGet_(ctx,id);
      if(live.phase!=='running'||live.expires<=Date.now())throw new Error('内部の対象記録が失効しました。');
      if(Date.now()>=deadline)throw new Error((deadline===menuDeadline?'メニュー全体の時間上限':'処理の180秒上限')+'（'+stage+'）。この組は再確認が必要です。');
    }
    function read(narrow){
      current();const next=keys.length?englishManualMeasure_(narrow?'readback':'validation',function(){return narrow?englishManualReadback_(ctx,keys,map):englishNativeMap_(englishProposalRead_(keys,true));}):{};
      keys.forEach(function(key){const r=next[key],x=states[key];
        const expected=englishReviewDigest_([x.row,x.formulas,x.notes,x.hidden,false,x.token,x.request]);
        if(!r||englishManualBodyHash_(r)!==x.body||englishManualRawHash_(ctx,r)!==expected)throw new Error(key+'：処理中に原文・提案・判断・履歴・表示・受付が変わりました。');
      });current();return next;
    }
    function groupsFor(filter){return englishManualGroups_(keys.filter(filter).map(function(key){return map[key];})).map(function(g){return g.map(function(r){return r.key;});});}
    function positions(group){
      current();const rows=group.map(function(key){return map[key].rowNumber;});
      if(rows.some(function(n,i){return n!==rows[0]+i;}))throw new Error('保存対象の行位置が変わりました。再プレビューしてください。');
      return rows[0];
    }
    function guard(group,row){
      // Recheck identities and every candidate cell immediately before each rectangular mutation.
      // Source/version checks are shared by the preceding read(), never cached across writes.
      const range=ctx.sheet.getRange(row,1,group.length,30),values=range.getDisplayValues(),formulas=range.getFormulas(),notes=range.getNotes();
      group.forEach(function(key,i){const x=states[key],request={values:values[i].slice(26),formulas:formulas[i].slice(26),notes:notes[i].slice(26)};if(JSON.stringify([values[i].slice(0,26),formulas[i].slice(0,26),notes[i].slice(0,26),request])!==JSON.stringify([x.row,x.formulas,x.notes,x.request]))throw new Error(key+'：変更直前に行位置・候補・確認記録・再英訳受付が変わりました。');});
      current();
    }
    function writeStage(column,width,filter,values){
      const groups=groupsFor(filter);
      for(const group of groups){
        const row=positions(group),cells=group.map(function(key){return values(key);});
        if(cells.some(function(v){return v.length!==width;}))throw new Error('保存列数が不正です。');
        guard(group,row);
        group.forEach(function(key){touched.add(key);});
        englishManualMeasure_('saveFlush',function(){ctx.sheet.getRange(row,column,group.length,width).setRichTextValues(cells.map(function(line){return line.map(function(v){return SpreadsheetApp.newRichTextValue().setText(String(v)).build();});}));SpreadsheetApp.flush();});
        group.forEach(function(key,i){cells[i].forEach(function(v,j){states[key].row[column-1+j]=String(v);});});
        map=read(column===10);
      }
      return groups.length;
    }
    try{
      for(const chunk of chunks){
        // Finish a small group completely before starting another. Reserve time for
        // a similar group and failure bookkeeping; never extend the hard limit.
        const reserve=longestChunk?Math.ceil(longestChunk*1.5)+15000:15000;
        if(Date.now()+reserve>=deadline){deferred=true;break;}
        const chunkStarted=Date.now();keys=chunk;touched=new Set();stage='対象の再照合';
        // Retire only these keys' old mobile tickets; other settings and requests survive.
        const tokens={};keys.forEach(function(key){const token=Utilities.getUuid();states[key].token=token;tokens['english-mobile-latest:'+key]=token;});
        shared.setProperties(tokens,false);map=read();
        stage='Jの保存';
        writeStage(10,1,function(key){return states[key].row[9]==='未確認';},function(){return ['採用希望'];});
        stage='確認記録U:Xの保存';
        const proofWrites=writeStage(21,4,function(key){return !states[key].existing;},function(key){const x=states[key];return [x.source,x.proof,new Date().toISOString(),x.operation];});
        if(!proofWrites)map=read();
        // U:X has been read back and compared before any new Y confirmation.
        stage='有効性Y:Zの保存';
        writeStage(25,2,function(){return true;},function(){const text='本人がメニューを実行。内部の対象固定・再照合済み。最終検証: '+new Date().toISOString();
          return ['確認済（本番未反映）',text.split(ENGLISH_SIMPLE_HIDDEN).join('').split(ENGLISH_SIMPLE_HIDE_PENDING).join('').trim()+' '+ENGLISH_SIMPLE_HIDDEN+' '+ENGLISH_SIMPLE_HIDE_PENDING];});
        stage='非表示と読戻し';
        const groups=groupsFor(function(){return true;});
        for(const group of groups){
          const row=positions(group);
          if(group.some(function(key){return !englishSimpleReceipt_(map[key]);}))throw new Error('確認記録の保存読戻しが一致しません。');
          guard(group,row);
          englishManualMeasure_('hide',function(){ctx.sheet.hideRows(row,group.length);SpreadsheetApp.flush();});group.forEach(function(key){states[key].hidden=true;});
          map=read();
        }
        stage='最終照合';
        writeStage(26,1,function(){return true;},function(key){return [states[key].row[25].split(ENGLISH_SIMPLE_HIDE_PENDING).join('').trim()];});
        keys.forEach(function(key){if(!englishSimpleReceipt_(map[key]))throw new Error('最終確認記録が一致しません。');});
        results=results.concat(keys.map(function(key){return {key:key,status:'saved',reason:'確認済（本番未反映）・非表示'};}));
        longestChunk=Math.max(longestChunk,Date.now()-chunkStarted);touched=new Set();
      }
    }catch(error){
      stopped=error.message||'処理を停止しました。';if(Date.now()>=deadline)deferred=true;
      // Invalidate only this incomplete group's attempted rows; preserve completed
      // groups, untouched rows and matching historical J/U:X without a rollback.
      touched.forEach(function(key){let reason=stopped;try{const r=initial[key];englishSimpleInvalidate_(ctx.sheet,r,reason);}catch(_){reason+=' 状態更新を確認できません。全件の有効性点検が必要です。';}
        results.push({key:key,status:'failed',reason:reason});});
    }finally{
      s.phase='done';englishManualPut_(ctx,s);
      const finished=new Set(results.map(function(r){return r.key;}));
      const waiting=new Set((s.pending||[]).concat(allKeys.filter(function(k){return !finished.has(k);}))),progress=englishManualProgress_(ctx);
      englishManualProgressPut_(ctx,progress.pending.filter(function(k){return (!allKeys.includes(k)&&!s.pending.includes(k))||waiting.has(k);}),s.cursor);
    }
    return {selected:allKeys.length,processed:results.length,confirmed:results.filter(function(r){return r.status==='saved';}).length,remaining:englishManualQueue_(ctx).length,unprocessed:allKeys.length-results.length,deferred:deferred,stopped:stopped,results:results};
  });}finally{if(lock)lock.releaseLock();}
}
function reviewJapaneseEnglishBatch() {
  const ui=SpreadsheetApp.getUi(),lock=LockService.getScriptLock();
  // Claim before preparation too: a second click must not queue another batch or replace its selection.
  if(!lock||!lock.tryLock(1)){try{SpreadsheetApp.getActiveSpreadsheet().toast('確認処理中です。完了するまでお待ちください。','英訳作業',5);}catch(_){}return;}
  let text;
  const began=Date.now();englishManualTiming_={phases:{},selected:0,confirmed:0,bindingAttempted:0,bindingCompleted:0,outcome:'stopped'};
  ['binding','index','validation','readback','saveFlush','hide'].forEach(function(name){englishManualTiming_.phases[name]={calls:0,inclusiveMs:0};});
  function shortReason(value){return String(value||'処理結果を確認できません。').replace(/再プレビューしてください。/g,'同じメニューから再実行してください。').replace(/プレビュー/g,'内部確認').slice(0,120);}
  try{
    const deadline=began+ENGLISH_MANUAL_MENU_BUDGET-ENGLISH_MANUAL_CLEANUP_RESERVE;
    const frozen=englishManualPreview_(false),hashes=Object.create(null);
    frozen.frozen.forEach(function(r){hashes[r.key]=r.hash;});
    englishManualTiming_.selected=frozen.scanned;
    let completed=0,attention=frozen.attention.length,excluded=frozen.excluded.length,stopped='',timeStop=false,longestUnit=0,longestConfirmation=0,offset=0;
    let remaining=frozen.remaining,firstReason=frozen.attention.length?frozen.attention[0].reason:'';
    // Already-bound windows keep the efficient <=10-row confirmation engine.
    // New bindings use small bind -> confirm -> hide units within the SAME window.
    const needsBinding=frozen.pending.length>0;
    do{
      const confirmationReserve=Math.max(45000,Math.ceil(longestConfirmation*1.5)+15000);
      const unitReserve=Math.max(needsBinding?60000:15000,Math.ceil(longestUnit*1.5),needsBinding?confirmationReserve+15000:0);
      if(Date.now()+unitReserve>=deadline){timeStop=true;break;}
      const unitStarted=Date.now(),entries=needsBinding?frozen.frozen.slice(offset,offset+ENGLISH_MANUAL_BIND_GROUP):frozen.frozen;
      let p,r,confirmStarted=0;
      try{
        p=needsBinding?englishManualPreview_(true,{entries:entries,hashes:hashes,cursor:frozen.cursor,bindingDeadline:Math.min(Date.now()+90000,deadline-confirmationReserve)}):frozen;
        if(needsBinding){excluded+=p.excluded.length;attention+=p.attention.length;if(!firstReason&&p.attention.length)firstReason=p.attention[0].reason;}
        englishManualTiming_.bindingAttempted+=p.binding?p.binding.attempted:0;
        englishManualTiming_.bindingCompleted+=p.binding?(p.binding.results||[]).filter(function(r){return r.status==='bound';}).length:0;
        confirmStarted=Date.now();r=englishManualConfirm_(p.id,true,true,deadline);
      }catch(error){stopped=error.message||'処理を停止しました。';timeStop=Date.now()>=deadline;break;}
      longestConfirmation=Math.max(longestConfirmation,Date.now()-confirmStarted);
      completed+=r.confirmed;attention+=r.processed-r.confirmed;remaining=r.remaining;stopped=r.stopped;
      englishManualTiming_.confirmed=completed;
      longestUnit=Math.max(longestUnit,Date.now()-unitStarted);offset+=entries.length;
      // Never retry a partial/uncertain binding in this invocation. A new explicit
      // menu invocation revalidates saved checkpoints and resumes pending first.
      if(stopped||r.deferred||p.pending.length){timeStop=!!r.deferred||p.pending.length>0;break;}
    }while(needsBinding&&offset<frozen.frozen.length);
    const unfinished=frozen.scanned-completed-excluded-attention;
    englishManualTiming_.outcome=stopped?'stopped':timeStop?'deferred':'completed';
    englishManualTiming_.timeStopped=timeStop;englishManualTiming_.longestUnitMs=longestUnit;
    text='完了（確認・非表示） '+completed+'件／未処理 '+unfinished+'件／除外 '+excluded+'件';
    text+='／要対応 '+attention+'件。\n未完了の一覧 '+remaining+'件（保留を除外・除外や要対応を含む）。';
    text+='\n経過 '+Math.ceil((Date.now()-began)/1000)+'秒／時間による区切り '+(timeStop?'あり':'なし')+'。';
    if(stopped)text+='\n'+shortReason(stopped)+' 入力・保存済み履歴は保持しています。';
    if(firstReason&&!stopped)text+='\n'+shortReason(firstReason);
    if(unfinished)text+='\n同じメニューで未処理から再開します。';
    else if(remaining)text+='\n続きは同じメニューを実行してください。';
  }catch(error){text=shortReason(error.message)+'\n入力は保持しています。状態を確認して同じメニューを再実行してください。';}
  finally{lock.releaseLock();const timing=englishManualTiming_;englishManualTiming_=null;try{console.log(JSON.stringify({event:'english-review-performance',totalMs:Math.max(0,Date.now()-began),selected:timing.selected,confirmed:timing.confirmed,bindingAttempted:timing.bindingAttempted,bindingCompleted:timing.bindingCompleted,outcome:timing.outcome,timeStopped:!!timing.timeStopped,longestUnitMs:timing.longestUnitMs||0,phases:timing.phases}));}catch(_){}}
  // No UI suspension while holding either lock, and no candidate-by-candidate list.
  ui.alert('確認・非表示の結果',text,ui.ButtonSet.OK);
}
