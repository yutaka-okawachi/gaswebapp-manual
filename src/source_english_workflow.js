/** Direct sheet editing. Only control metadata and a bounded current review reason persist; no previous English history. */
const SOURCE_ENGLISH_MODE='direct-english-v2';
// Indices describe canonical meanings, not physical sheet columns. Named layouts retain existing row hashes.
const SOURCE_ENGLISH_ADAPTERS={
  Notes:{name:'Notes',width:9,de:0,ja:1,source:2,draft:3,changes:4,english:5,italian:6,evidence:7,status:8,metadata:NOTES_ENGLISH_META},
  GM:{name:'GM',width:10,de:0,ja:2,source:3,draft:4,changes:5,english:6,italian:7,evidence:8,status:9,metadata:'GM_ENGLISH_ROW_V1'},
  RW:{name:'RW',width:15,de:5,ja:7,source:0,draft:9,changes:10,english:11,italian:12,evidence:13,status:14,metadata:'RW_ENGLISH_ROW_V1'},
  RS:{name:'RS',width:15,de:5,ja:7,source:0,draft:9,changes:10,english:11,italian:12,evidence:13,status:14,metadata:'RS_ENGLISH_ROW_V1'}
};
function sourceEnglishAdapter_(name){return Object.prototype.hasOwnProperty.call(SOURCE_ENGLISH_ADAPTERS,name)?SOURCE_ENGLISH_ADAPTERS[name]:null;}
// Whom is resolved locally from the user's selections; never ask the paid model to rename a target.
function sourceEnglishWhomPlan_(ctx,snapshot){
  if(!['RW','RS'].includes(ctx.adapter.name))return null;
  try{
    const sheet=ctx.book.getSheetByName('指示対象英訳確認');
    if(!sheet)return {status:'HOLD',value:'',reason:'指示対象英訳確認タブが見つからないため指示対象英訳は保持しました。',referenceHash:'missing',reviewRequired:true};
    const last=sheet.getLastRow();
    if(last<4||last>5004||sheet.getMaxColumns()<10)return {status:'HOLD',value:'',reason:'指示対象の対応表の範囲を確認できないため指示対象英訳は保持しました。',referenceHash:'invalid-range',reviewRequired:true};
    const range=sheet.getRange(4,1,last-3,10);
    return sourceEnglishWhomResolve_(ctx.adapter.name,snapshot.values[0],snapshot.values[4],range.getDisplayValues(),range.getFormulas());
  }catch(_){return {status:'HOLD',value:'',reason:'指示対象の対応表を読み取れないため指示対象英訳は保持しました。',referenceHash:'unavailable',reviewRequired:true};}
}
function sourceEnglishWhomResolve_(tab,work,whom,rows,formulas){
  const referenceHash=notesEnglishHash_([rows,formulas]);
  function held(reason){return {status:'HOLD',value:'',reason:reason+' 指示対象英訳は保持しました。',referenceHash:referenceHash,reviewRequired:true};}
  const headers=['区分','作品','指示対象（原語）','ユーザー選択案','ユーザー判断','第1案（推奨）','第2案','第3案','推奨理由・判断が難しい点','自由修正（英訳）'];
  if(!Array.isArray(rows)||!Array.isArray(formulas)||rows.length!==formulas.length||!rows.length||
    rows.some(function(r,i){return !Array.isArray(r)||r.length!==10||!Array.isArray(formulas[i])||formulas[i].length!==10||r.concat(formulas[i]).some(function(v){return typeof v!=='string'||v.length>45000;});})||
    headers.some(function(h,i){return rows[0][i]!==h||formulas[0][i];}))return held('指示対象の対応表の見出し・形式を確認してください。');
  if(typeof whom!=='string'||!whom.trim())return held('whomの指示対象が空です。');
  const workCode=String(work).trim(),source=whom.trim(),matches=Object.create(null);
  for(let i=1;i<rows.length;i++){
    const r=rows[i],code=/\[([^\[\]\r\n]+)\]\s*$/.exec(r[1]);
    if(r[0]!==tab||!code||code[1]!==workCode)continue;
    const name=r[2].trim();if(!name)continue;
    if(!matches[name])matches[name]=[];matches[name].push({row:r,formulas:formulas[i]});
  }
  let kept=0,error='';
  function resolve(name){
    const found=matches[name];
    if(found){
      if(found.length!==1){error='同じ作品・原語に複数の対応があり確定できません。';return '';}
      const r=found[0].row,f=found[0].formulas,col=[5,6,7,9][['第1案','第2案','第3案','自由修正'].indexOf(r[3])];
      if(r[4]!=='承認'){error='指示対象に保留または未承認の対応があります。';return '';}
      if(col===undefined||[0,1,2,3,4,col].some(function(i){return !!f[i];})||!r[col].trim()){
        error='承認済み指示対象の選択案・英文を確認できません。';return '';
      }
      return r[col].trim();
    }
    // Preserve an existing European-script label, explicitly without treating it as an approved translation.
    if(/^[\p{Script=Latin}\p{M}\d\s.'’()\-–—]+$/u.test(name)&&/\p{Script=Latin}/u.test(name)){
      kept++;return name;
    }
    error='指示対象に承認済み対応のない名称があります。';return '';
  }
  let value;
  if(matches[source])value=resolve(source);
  else{
    const parts=source.split(/([,、;；\r\n]+)/);
    if(parts.length>199)return held('指示対象の件数が上限を超えています。');
    value=parts.map(function(part,i){
      if(i%2)return part;
      const name=part.trim();if(!name){error='指示対象の区切りに空の対象があります。';return '';}
      return part.slice(0,part.indexOf(name))+resolve(name)+part.slice(part.indexOf(name)+name.length);
    }).join('');
  }
  if(error)return held(error);
  if(!value||value.length>45000)return held('指示対象英訳の長さを確認してください。');
  return {status:'READY',value:value,referenceHash:referenceHash,reviewRequired:kept>0,
    reason:kept?'承認対応のない欧文表記は原表記のまま保持します（英訳の確定ではありません）。':'同作品・同原語の承認済み選択を指示対象英訳へ反映します。'};
}
function sourceEnglishDirect_(){const c=notesEnglishConfig_();return !!(c&&c.mode===SOURCE_ENGLISH_MODE);}
function sourceEnglishContext_(targetName){
  const ctx=notesEnglishContext_(true);if(ctx.config.mode!==SOURCE_ENGLISH_MODE)throw new Error('「自動英訳を準備」を先に実行してください。');
  let name=targetName;
  if(!name){try{const a=SpreadsheetApp.getActiveSpreadsheet()&&SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();if(a)name=a.getName();}catch(_){}}
  if(!name||!sourceEnglishAdapter_(name))name='Notes';
  ctx.adapter=sourceEnglishAdapter_(name);ctx.sheet=ctx.book.getSheetByName(name);
  if(!ctx.sheet)throw new Error(name+'シートが見つかりません。');
  return ctx;
}
function sourceEnglishSnapshot_(ctx,row){
  const a=ctx.adapter,read=namedSheetRead_(ctx.sheet,sourceSheetNames_(ctx.sheet,a.width),row,1,true),v=read.values[0],n=read.notes[0],f=read.formulas[0];
  if(v.concat(n,f).some(function(x){return typeof x!=='string'||x.length>45000;}))throw new Error('入力が上限を超えています。切り詰めません。');
  function hash(indices){return notesEnglishHash_(indices.map(function(i){return [v[i],n[i],f[i]];}));}
  const status=v[a.status]||(a.name!=='Notes'?'確認待ち':''),draft=v[a.draft].trim()||(a.name!=='Notes'?v[a.ja].trim():'');
  return {values:v,notes:n,formulas:f,layout:read.layout,inputHash:notesEnglishHash_([v,n,f]),jaHash:hash([a.draft]),fHash:hash([a.english]),sourceHash:hash([a.de,a.ja,a.source]),
    eligible:['確認待ち','承認','保留'].includes(status)&&!!v[a.de].trim()&&!!draft&&!f.some(Boolean),
    manualEligible:['確認待ち','承認','保留'].includes(status)&&!!v[a.de].trim()&&!!draft&&!f.some(Boolean)};
}
function sourceEnglishRequestable_(snapshot,control){return snapshot.eligible||!!(control&&control.manualHold===true&&snapshot.manualEligible);}
function sourceEnglishIndex_(ctx){
  const byId=Object.create(null),byRow=Object.create(null),allIds=Object.create(null);
  ctx.book.createDeveloperMetadataFinder().withKey(ctx.adapter.metadata).find().forEach(function(t){const r=t.getLocation().getRow(),id=t.getValue();
    if(!r||r.getNumRows()!==1||!/^NE-[a-f0-9-]{36}$/.test(id)||allIds[id])throw new Error('翻訳行IDが不正または重複しています。');allIds[id]=true;
    if(r.getSheet().getSheetId()!==ctx.sheet.getSheetId())return;
    const row=r.getRow();if(row<2||byRow[row])throw new Error('翻訳行IDが不正または重複しています。');byId[id]=row;byRow[row]=id;
  });return {byId:byId,byRow:byRow,allIds:allIds};
}
function sourceEnglishControls_(ctx){
  const n=Math.max(0,ctx.ledger.getLastRow()-2),range=n?ctx.ledger.getRange(3,1,n,1):null,values=range?range.getDisplayValues():[],formulas=range?range.getFormulas():[],byId=Object.create(null),allIds=Object.create(null);
  values.forEach(function(row,i){if(!row[0])return;const c=notesEnglishJson_(row[0]);
    if(c&&c.schema===1&&c.mode==='notes-v1')return; // Historical bodies stay untouched and are never copied forward.
    if(formulas[i][0]||!c||c.schema!==2||c.mode!==SOURCE_ENGLISH_MODE||
      !c.sourceTab||typeof c.sourceTab!=='string'||!['Notes','GM','RW','RS'].includes(c.sourceTab)||
      !/^NE-[a-f0-9-]{36}$/.test(c.id)||allIds[c.id]||!['BASE','REQUEST','RESERVED','WRITING','WRITTEN','HOLD','OBSERVE'].includes(c.status)||
      !Number.isSafeInteger(c.revision)||c.revision<1||!Number.isSafeInteger(c.at)||c.reviewed!==false||![c.inputHash,c.jaHash,c.fHash,c.sourceHash].every(function(h){return /^[a-f0-9]{64}$/.test(h);})||row[0].length>4000)throw new Error('翻訳制御記録が不正です。');
    allIds[c.id]=true;
    if(c.sourceTab!==ctx.adapter.name)return;
    if(c.sheetId!==ctx.sheet.getSheetId())throw new Error('翻訳制御記録が不正です。');
    if(['REQUEST','RESERVED','WRITING'].includes(c.status)&&(!/^[-a-f0-9]{36}$/.test(c.requestId)||!Number.isSafeInteger(c.readyAt)||c.readyAt<1))throw new Error('依頼ID・待ち時間が不正です。');
    if(['RESERVED','WRITING'].includes(c.status)&&(!/^[-a-f0-9]{36}$/.test(c.operationId)||!/^\d{4}-\d{2}$/.test(c.month)||!Number.isSafeInteger(c.reservedMicro)||c.reservedMicro<1))throw new Error('費用予約の記録が不正です。');
    ['requestedAt','reservedAt','responseAt','waitObservedAt'].forEach(function(k){if(c[k]!==undefined&&(!Number.isSafeInteger(c[k])||c[k]<1))throw new Error('処理時刻の記録が不正です。');});
    if(c.waitCode!==undefined&&(!['IN_FLIGHT','KEY_MISSING','COALESCING','BATCH_LIMIT','TIME_LIMIT','DISPATCH_UNCONFIRMED'].includes(c.waitCode)||!c.waitObservedAt||c.status!=='REQUEST'))throw new Error('待機理由の記録が不正です。');
    if(c.manualHold!==undefined&&typeof c.manualHold!=='boolean')throw new Error('保留行の明示依頼が不正です。');
    if(c.reviewReason!==undefined&&(!((c.status==='HOLD'&&c.reason==='MEANING_REVIEW_REQUIRED')||(c.status==='WRITTEN'&&['UPDATED_REVIEW_REQUIRED','UPDATED_LOG_UNSAVED'].includes(c.reason)))||typeof c.reviewReason!=='string'||!c.reviewReason.trim()||c.reviewReason.length>800))throw new Error('要確認理由の記録が不正です。');
    if(c.logStatus!==undefined&&!['SAVED','EDIT_CONFLICT','H_CAPACITY','WRITE_UNCONFIRMED'].includes(c.logStatus))throw new Error('ログ保存状態が不正です。');
    if(c.whomStatus!==undefined&&(!['RW','RS'].includes(c.sourceTab)||!['PENDING','UPDATED','HELD'].includes(c.whomStatus)||typeof c.whomReason!=='string'||!c.whomReason||c.whomReason.length>400))throw new Error('指示対象英訳の保存状態が不正です。');
    byId[c.id]={row:i+3,value:c,text:row[0]};
  });return byId;
}
function sourceEnglishSave_(ctx,controls,c){
  const prior=controls[c.id],text=JSON.stringify(c);if(text.length>4000)throw new Error('制御記録の上限です。');
  const row=prior?prior.row:ctx.ledger.getLastRow()+1;if(row>NOTES_ENGLISH_MAX_ROWS)throw new Error('制御記録の件数上限です。');
  if(row>ctx.ledger.getMaxRows())ctx.ledger.insertRowsAfter(ctx.ledger.getMaxRows(),Math.min(500,NOTES_ENGLISH_MAX_ROWS-ctx.ledger.getMaxRows()));
  const r=ctx.ledger.getRange(row,1,1,1);if(r.getFormulas()[0][0]||r.getDisplayValues()[0][0]!== (prior?prior.text:''))throw new Error('制御記録が同時に変更されています。');
  notesEnglishWrite_(r,[text]);SpreadsheetApp.flush();if(r.getDisplayValues()[0][0]!==text)throw new Error('制御記録の読戻しが不一致です。');
  controls[c.id]={row:row,value:c,text:text};return c;
}
function sourceEnglishState_(ctx,id,snap,prior,status,reason){
  const now=Date.now(),c={schema:2,mode:SOURCE_ENGLISH_MODE,id:id,sourceTab:ctx.adapter.name,sheetId:ctx.sheet.getSheetId(),
    revision:prior?prior.revision+1:1,at:now,status:status,reason:reason,inputHash:snap.inputHash,jaHash:snap.jaHash,fHash:snap.fHash,sourceHash:snap.sourceHash,
    requestId:status==='REQUEST'?Utilities.getUuid():'',readyAt:status==='REQUEST'?now+1200:0,reviewed:false};
  if(status==='REQUEST')c.requestedAt=now;
  else if(prior)['requestedAt','reservedAt','responseAt'].forEach(function(k){if(prior[k]!==undefined)c[k]=prior[k];});
  return c;
}

function sourceEnglishIdentity_(ctx,row,index){
  if(index.byRow[row])return index.byRow[row];
  const latest=sourceEnglishIndex_(ctx);if(latest.byRow[row]){const existing=latest.byRow[row];index.byRow[row]=existing;index.byId[existing]=row;return existing;}
  const id='NE-'+Utilities.getUuid();if(latest.allIds[id])throw new Error('新しい行IDが重複しています。追加しません。');
  notesEnglishMetadataRowRange_(ctx.sheet,row).addDeveloperMetadata(ctx.adapter.metadata,id,SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT);SpreadsheetApp.flush();
  const fresh=sourceEnglishIndex_(ctx);if(fresh.byId[id]!==row)throw new Error('行IDの保存位置が変わりました。');index.byId[id]=row;index.byRow[row]=id;return id;
}
function sourceEnglishCapture_(ctx,controls,index,row,options){
  const snap=sourceEnglishSnapshot_(ctx,row);if(!index.byRow[row]&&!options.explicit)return null;
  const id=sourceEnglishIdentity_(ctx,row,index),entry=controls[id],prior=entry&&entry.value;
  if(sourceEnglishSnapshot_(ctx,row).inputHash!==snap.inputHash)throw new Error('行IDの確認中に対象内容が変わりました。送信しません。');
  // L may already be saved while I/readback failed. Preserve that unresolved write, even after another click/edit.
  if(prior&&prior.status==='WRITING'&&prior.whomStatus)return prior;
  if(prior&&prior.inputHash===snap.inputHash){
    if(options.cancel&&['REQUEST','RESERVED','WRITING'].includes(prior.status))return sourceEnglishSave_(ctx,controls,sourceEnglishState_(ctx,id,snap,prior,'OBSERVE','USER_EDIT'));
    if(!options.explicit||['REQUEST','RESERVED','WRITING'].includes(prior.status)||((prior.status==='WRITTEN'||prior.status==='HOLD'&&prior.requestId)&&Date.now()-prior.at<5000))return prior;
  }
  // Editing invalidates prior input; only the explicit selection menu creates a request.
  const request=options.explicit===true&&snap.manualEligible;
  const next=sourceEnglishState_(ctx,id,snap,prior,request?'REQUEST':snap.eligible?'OBSERVE':'HOLD',request?'QUEUED':snap.values[ctx.adapter.status]==='保留'?'USER_HOLD':'INPUT_CHANGED');
  if(request&&options.explicit&&snap.values[ctx.adapter.status]==='保留')next.manualHold=true;
  return sourceEnglishSave_(ctx,controls,next);
}
function prepareSourceEnglishWorkflow(){
  const result=notesEnglishLock_(function(){const book=notesEnglishBook_(),sheet=book.getSheetByName('Notes');if(!sheet||sheet.getMaxColumns()<9)throw new Error('Notesの作業列を確認してください。');
    namedSheetColumns_(sheet,sourceSheetNames_(sheet,9));
    let config=notesEnglishConfig_();if(!config){
      if(book.getSheetByName(NOTES_ENGLISH_LEDGER))throw new Error('内部タブだけが存在します。設定との対応を点検してください。');
      const old=book.getSheetByName('日英修正案');if(old&&old.getMaxColumns()>=30&&old.getLastRow()>4&&old.getRange(5,28,old.getLastRow()-4,1).getDisplayValues().some(function(r){return /^(受付|処理中)/.test(r[0]);}))throw new Error('旧再英訳の処理中受付を先に整理してください。');
      const ledger=book.insertSheet(NOTES_ENGLISH_LEDGER);if(ledger.getMaxColumns()<32)ledger.insertColumnsAfter(ledger.getMaxColumns(),32-ledger.getMaxColumns());
      notesEnglishWrite_(ledger.getRange(1,1,1,1),[NOTES_ENGLISH_MARKER]);notesEnglishWrite_(ledger.getRange(2,1,1,32),NOTES_ENGLISH_HEADERS);ledger.hideSheet();
      config={schema:1,book:book.getId(),sheet:sheet.getSheetId(),ledger:ledger.getSheetId(),phase:'PREPARING'};PropertiesService.getScriptProperties().setProperty(NOTES_ENGLISH_PROPERTY,JSON.stringify(config));
    }
    const ctx=notesEnglishContext_(true),props=PropertiesService.getScriptProperties();
    if(props.getProperty(NOTES_ENGLISH_API_FLIGHT))throw new Error('送信中または結果未確定のAPI処理があります。先に状態を確認してください。');
    if(config.mode!==SOURCE_ENGLISH_MODE){
      const count=Math.max(0,ctx.ledger.getLastRow()-2),rows=count?ctx.ledger.getRange(3,1,count,1).getDisplayValues():[],last=Object.create(null);
      rows.forEach(function(r){const v=notesEnglishJson_(r[0]);if(v&&v.schema===1&&v.id)last[v.id]=v;});
      if(Object.keys(last).some(function(id){return ['REQUEST','RESERVED','STAGED','WRITE_INTENT'].includes(last[id].kind);}))throw new Error('旧Notes方式の未処理結果があります。履歴を残して処理方針を確認してください。');
    }
    config.mode=SOURCE_ENGLISH_MODE;config.phase='ACTIVE';props.setProperty(NOTES_ENGLISH_PROPERTY,JSON.stringify(config));
    const api=notesEnglishApiConfig_();api.enabled=false;api.mode=SOURCE_ENGLISH_MODE;props.setProperty(NOTES_ENGLISH_API_CONFIG,JSON.stringify(api));
    return {sourceTab:'Notes',enabled:false,historyBodiesWritten:0};
  });console.log(JSON.stringify(result));SpreadsheetApp.getActiveSpreadsheet().toast('Notesの手動英訳を準備しました。APIキー設定後、対象1行を選び「選択行の英訳を再生成」を実行してください。','自動英訳',8);return result;
}
function sourceEnglishEdited_(e){
  const range=e&&e.range;if(!range||!e.source)return false;
  const sheetName=range.getSheet().getName();
  if(['RW','RS','GM'].includes(sheetName))return false;
  const adapter=sourceEnglishAdapter_(sheetName);
  if(!adapter||range.getLastRow()<2)return true;
  try{notesEnglishLock_(function(){const ctx=sourceEnglishContext_(sheetName);if(e.source.getId()!==ctx.book.getId()||range.getSheet().getSheetId()!==ctx.sheet.getSheetId())return;
    const a=ctx.adapter,columns=sourceEnglishColumns_(ctx).positions,first=range.getColumn()-1,last=range.getLastColumn()-1,intersects=function(c){return columns[c]>=first&&columns[c]<=last;},draftEdit=intersects(a.draft),cancel=!draftEdit||intersects(a.english)||[a.de,a.ja,a.source,a.status].some(intersects);
    if(!columns.some(function(c){return c>=first&&c<=last;}))return;
    const controls=sourceEnglishControls_(ctx),index=sourceEnglishIndex_(ctx),start=Date.now();let processed=0;
    for(let row=Math.max(2,range.getRow());row<=Math.min(ctx.sheet.getLastRow(),range.getLastRow());row++){
      if(processed>=20||Date.now()-start>7000)break;sourceEnglishCapture_(ctx,controls,index,row,{draftEdit:draftEdit,cancel:cancel,explicit:false});processed++;
    }
    // Selection rechecks every row before sending. Historical pending ranges stay untouched.
  });}catch(_){try{e.source.toast('受付を完了できませんでした。入力は保持しています。必要なら対象行を選び英訳を再生成してください。','自動英訳',8);}catch(ignore){}}
  return true;
}
function handleSourceEnglishEdit(e){if(!e||!e.triggerUid||!e.source||e.source.getId()!==notesEnglishBook_().getId()||!sourceEnglishDirect_())return;sourceEnglishEdited_(e);}

function retrySourceEnglishQueue(e){return {stoppedReason:'MANUAL_ONLY'};}

function sourceEnglishDrainRanges_(){return {stoppedReason:'MANUAL_ONLY'};}

function regenerateSourceEnglishSelection(){
  let targetTab='Notes';
  const selected=notesEnglishLock_(function(){
    const activeBook=SpreadsheetApp.getActiveSpreadsheet(),range=activeBook&&activeBook.getActiveRange();
    if(!range)throw new Error('Notes、GM、RW、RSの対象1〜20行を選択してください。');
    const sheetName=range.getSheet().getName(),adapter=sourceEnglishAdapter_(sheetName);
    if(!adapter)throw new Error('Notes、GM、RW、RSの対象1〜20行を選択してください。');
    targetTab=sheetName;const ctx=sourceEnglishContext_(sheetName);
    if(range.getSheet().getSheetId()!==ctx.sheet.getSheetId())throw new Error(sheetName+'の対象1〜20行を選択してください。');
    sourceEnglishColumns_(ctx);
    const first=Math.max(2,range.getRow()),last=Math.min(ctx.sheet.getLastRow(),range.getLastRow()),count=last-first+1;if(count<1||count>20)throw new Error('見出しを除き、'+sheetName+'の対象1〜20行を選択してください。');
    const key=PropertiesService.getScriptProperties().getProperty(NOTES_ENGLISH_API_KEY),api=notesEnglishApiConfig_();if(!key)throw new Error('APIキーを先に設定してください。');if((!api.tested||api.testedKeyHash!==notesEnglishHash_(key))&&count!==1)throw new Error('初回はテストする1行だけを選択してください。');
    const controls=sourceEnglishControls_(ctx),index=sourceEnglishIndex_(ctx),ids=[];
    for(let row=first;row<=last;row++){const c=sourceEnglishCapture_(ctx,controls,index,row,{explicit:true,draftEdit:false,cancel:false});if(c)ids.push(c.id);}return ids;
  });const result=sourceEnglishProcess_(selected,targetTab);
  SpreadsheetApp.getActiveSpreadsheet().toast(sourceEnglishProcessMessage_(result),'手動英訳',30);return result;
}
function sourceEnglishProcessMessage_(result){
  const reasons={IN_FLIGHT:'送信中または結果未確定の記録があります。現在の実行状況は不明です。再送せず確認してください。',
    RESPONSE_UNCONFIRMED:'送信予約が残っており、応答を確認できません。再送せず確認してください。',
    SAVE_UNCONFIRMED:'保存完了を確認できません。再送せず確認してください。',
    KEY_MISSING:'APIキーが未設定です。',
    QUEUED:'今回の送信開始を確認できません。対象行の状態を確認してください。',
    BATCH_LIMIT:'1回3件の上限です。残りの行を選んで再生成してください。',
    TIME_LIMIT:'今回の処理時間上限です。残りの行を選んで再生成してください。',
    COALESCING:'編集確定の待ち時間内です。少し待って対象行を再生成してください。'};
  let message='英訳再生成：保存 '+result.written+'件／要確認 '+result.held+'件／待ち '+result.pending+'件。'+(reasons[result.pendingReason]||'');
  if(result.held)message+=' 要確認には、入力変更による応答破棄や受付記録の欠落も含みます。対象行の状態と'+(result.whomHeld!==undefined?'本文英訳・指示対象英訳・根拠欄':'英訳候補・根拠欄')+'を確認してください。';
  if(result.pending)message+=' 自動再試行予定はありません。';
  if(result.waitRecordSaved===false&&result.pending)message+=' 待ち理由の保存を確認できません。状態メニューで再確認してください。';
  if(result.whomHeld)message+=' 指示対象英訳は '+result.whomHeld+'件を保持しました。本文英訳・指示対象英訳・根拠欄を確認してください。';
  if(result.whomUnconfirmed)message+=' 指示対象英訳は '+result.whomUnconfirmed+'件の保存完了が未確認です。再送せず本文英訳・指示対象英訳・根拠欄を確認してください。';
  return message;
}
function enableSourceEnglishAutomatic(){SpreadsheetApp.getActiveSpreadsheet().toast('英訳は手動再生成のみです。対象行を選び「選択行の英訳を再生成」を実行してください。','英訳',12);return {enabled:false,stoppedReason:'MANUAL_ONLY'};}

function disableSourceEnglishAutomatic(){return notesEnglishLock_(function(){sourceEnglishContext_();const c=notesEnglishApiConfig_();c.enabled=false;PropertiesService.getScriptProperties().setProperty(NOTES_ENGLISH_API_CONFIG,JSON.stringify(c));return {enabled:false};});}
// Read only. Trigger enumeration is best effort under the existing manifest scopes.
function sourceEnglishStatusTriggers_(book){
  try{let edit=0,retry=0;ScriptApp.getProjectTriggers().forEach(function(t){const name=t.getHandlerFunction();
    if(name==='handleSourceEnglishEdit'&&t.getEventType()===ScriptApp.EventType.ON_EDIT&&t.getTriggerSource()===ScriptApp.TriggerSource.SPREADSHEETS&&t.getTriggerSourceId()===book.getId())edit++;
    if(name==='retrySourceEnglishQueue'&&t.getEventType()===ScriptApp.EventType.CLOCK&&t.getTriggerSource()===ScriptApp.TriggerSource.CLOCK)retry++;
  });return {known:true,edit:edit,retry:retry,scope:'CURRENT_USER',runningVerified:false};
  }catch(_){return {known:false,edit:null,retry:null,scope:'CURRENT_USER',runningVerified:false};}
}
function showSourceEnglishStatus(){
  let active;try{active=SpreadsheetApp.getActiveSpreadsheet();}catch(_){}
  if(!active)throw new Error('Notes、GM、RW、RSを開き、シートの英訳状態メニューから確認してください。');
  const props=PropertiesService.getScriptProperties(),expected=props.getProperty('SPREADSHEET_ID');
  if(!expected||active.getId()!==expected)throw new Error('対象ブックが設定と一致しません。対象シートから状態を確認してください。');
  let selected;try{selected=active.getActiveRange();}catch(_){}
  let sheetName='Notes';
  try{
    const sName=selected&&selected.getSheet&&typeof selected.getSheet().getName==='function'&&selected.getSheet().getName();
    if(sName&&typeof sourceEnglishAdapter_==='function'&&sourceEnglishAdapter_(sName))sheetName=sName;
    else{
      const aSheet=active&&typeof active.getActiveSheet==='function'&&active.getActiveSheet();
      const aName=aSheet&&typeof aSheet.getName==='function'&&aSheet.getName();
      if(aName&&typeof sourceEnglishAdapter_==='function'&&sourceEnglishAdapter_(aName))sheetName=aName;
    }
  }catch(_){}
  const ctx=sourceEnglishContext_(sheetName),controls=sourceEnglishControls_(ctx),flight=props.getProperty(NOTES_ENGLISH_API_FLIGHT);
  const s={mode:'MANUAL_ONLY',automaticRetry:false,keyPresent:!!props.getProperty(NOTES_ENGLISH_API_KEY),inFlight:!!flight,
    pending:0,held:0,selectedRow:null,selectedStatus:'NO_SELECTION',selectedReason:'NO_SELECTION'};
  Object.keys(controls).forEach(function(id){const c=controls[id].value;if(['REQUEST','RESERVED','WRITING'].includes(c.status))s.pending++;if(c.status==='HOLD')s.held++;});
  s.message='手動再生成のみ。'+ctx.adapter.name+'の対象行を選び、状態メニューを実行してください。';
  if(selected&&selected.getSheet().getSheetId()===ctx.sheet.getSheetId()&&selected.getRow()>=2&&selected.getRow()<=ctx.sheet.getLastRow()){
    const row=selected.getRow(),index=sourceEnglishIndex_(ctx),id=index.byRow[row],c=id&&controls[id]&&controls[id].value;
    const snapshot=sourceEnglishSnapshot_(ctx,row),now=Date.now();
    const heading=snapshot.values[ctx.adapter.de].trim();
    const title=heading?sourceEnglishReviewText_(heading,props.getProperty(NOTES_ENGLISH_API_KEY)).replace(/\s+/g,' ').slice(0,80):'（見出しなし）';
    const facts={now:now,keyPresent:s.keyPresent,inFlight:!!flight,inputChanged:!!c&&snapshot.inputHash!==c.inputHash,
      flightMatched:!!flight&&Object.keys(controls).some(function(k){const v=controls[k].value;return ['RESERVED','WRITING'].includes(v.status)&&v.operationId===flight;})};
    const detail=sourceEnglishStatusDetail_(c,facts),timezone=ctx.book.getSpreadsheetTimeZone();
    s.selectedRow=row;s.selectedStatus=c?c.status:'NO_RECORD';s.selectedReason=c?c.reason:'NO_RECORD';s.detail=detail;
    const fresh=id&&sourceEnglishControls_(ctx)[id];
    if((id&&sourceEnglishIndex_(ctx).byId[id]!==row)||(c&&(!fresh||JSON.stringify(fresh.value)!==JSON.stringify(c)))){
      s.message=ctx.adapter.name+' '+row+'行：確認中に受付または行位置が変わりました。状態メニューを再実行してください。';
      s.selectedReason='STATUS_CHANGED';
    }else{
      s.message=ctx.adapter.name+' '+row+'行「'+title+'」\n'+detail.phase+'\n理由：'+detail.reason+
        '\n受付：'+sourceEnglishStatusTime_(detail.requestedAt,timezone)+
        '\n送信予約：'+sourceEnglishStatusTime_(detail.reservedAt,timezone)+'（API開始時刻は未確認）'+
        '\n応答確認：'+sourceEnglishStatusTime_(detail.responseAt,timezone)+
        '\n最終記録：'+sourceEnglishStatusTime_(detail.lastRecordedAt,timezone)+
        '\n受付から：'+(detail.elapsedMs===null?'不明':Math.floor(detail.elapsedMs/60000)+'分')+
        '\n次回：自動再試行予定なし／残り時間：不明'+
        '\n次の操作：'+detail.nextAction;
      if(c&&['BATCH_LIMIT','TIME_LIMIT'].includes(c.waitCode))s.message+='\n前回理由の記録：'+sourceEnglishStatusTime_(c.waitObservedAt,timezone);
      if(c){s.selectedReviewReason=sourceEnglishReviewMessage_(ctx,c,row);if(s.selectedReviewReason)s.message+='\n注意：'+s.selectedReviewReason;}
      s.selectedColumns={english:namedSheetColumnLabel_(snapshot.layout.positions[ctx.adapter.english]),evidence:namedSheetColumnLabel_(snapshot.layout.positions[ctx.adapter.evidence])};
      if(['RW','RS'].includes(ctx.adapter.name))s.selectedColumns.whomEnglish=namedSheetColumnLabel_(snapshot.layout.positions[8]);
      s.message+='\n現在の保存先：英訳候補 '+s.selectedColumns.english+'列'+(s.selectedColumns.whomEnglish?'／指示対象英訳 '+s.selectedColumns.whomEnglish+'列':'')+'／根拠 '+s.selectedColumns.evidence+'列';
      s.message+='\n処理ログ全文：同じ行の'+namedSheetColumnLabel_(snapshot.layout.positions[ctx.adapter.evidence])+'列（根拠・未解決点）';
    }
  }
  s.displayed=false;try{ctx.book.toast(s.message,'英訳の状態（手動）',60);s.displayed=true;}catch(_){}
  // No heading, candidate text, key, operation identifier or raw reason goes to logs.
  console.log(JSON.stringify({mode:s.mode,pending:s.pending,held:s.held,selectedRow:s.selectedRow,selectedStatus:s.selectedStatus,displayed:s.displayed}));
  return s;
}

// Freeze both remaining cell contents and source row order; changed/moved ranges are never guessed.


function sourceEnglishRangeHash_(ctx,from,to){
  const names=sourceSheetNames_(ctx.sheet,ctx.adapter.width),r=namedSheetRead_(ctx.sheet,names,from,to-from+1,true),source=namedSheetRead_(ctx.sheet,names.slice(0,3),2,ctx.sheet.getLastRow()-1,true),index=sourceEnglishIndex_(ctx);
  return notesEnglishHash_([r.values,r.notes,r.formulas,source.values,Object.keys(index.byId).sort().map(function(id){return [id,index.byId[id]];})]);
}

// Keep only the current needs_review explanation; never persist the response or F history.
function sourceEnglishReviewText_(text,key){
  if(typeof text!=='string'||!text.trim()||text.length>45000)throw new Error('要確認理由の形式が不正です。');
  let value=text;
  if(typeof key==='string'&&key)value=value.split(key).join('[秘密情報を除去]');
  value=value.replace(/\bsk-[A-Za-z0-9_-]+/gi,'[秘密情報を除去]')
    .replace(/\bBearer\s+[^\s,;<>]+/gi,'Bearer [秘密情報を除去]')
    .replace(/\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret)\s*[:=]\s*["']?[^\s,"';<>]+/gi,'$1=[秘密情報を除去]')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'')
    .replace(/\r\n?/g,'\n').trim();
  if(!value)value='理由本文を安全に表示できません。';
  if(value.length>800){value=value.slice(0,790).replace(/[\uD800-\uDBFF]$/,'')+'…（以下省略）';}
  return value;
}
function sourceEnglishReviewMessage_(ctx,c,row){
  if(!((c.status==='HOLD'&&c.reason==='MEANING_REVIEW_REQUIRED')||(c.status==='WRITTEN'&&['UPDATED_REVIEW_REQUIRED','UPDATED_LOG_UNSAVED'].includes(c.reason))))return '';
  const index=sourceEnglishIndex_(ctx),latest=sourceEnglishControls_(ctx)[c.id];
  if(index.byId[c.id]!==row||!latest||JSON.stringify(latest.value)!==JSON.stringify(c)||sourceEnglishSnapshot_(ctx,row).inputHash!==c.inputHash||sourceEnglishIndex_(ctx).byId[c.id]!==row)
    return '内容または制御記録が変更されています。以前の理由は現在の行に適用できません。';
  if(c.reviewReason===undefined)return '旧処理のため具体理由未保存';
  const key=PropertiesService.getScriptProperties().getProperty(NOTES_ENGLISH_API_KEY);
  return sourceEnglishReviewText_(c.reviewReason,key).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});
}
// Pure presentation: a reservation proves a record exists, not that an HTTP call is running.
function sourceEnglishStatusDetail_(c,facts){
  const detail={phase:'未受付',reason:'受付記録がありません。',nextAction:'対象行を選び「選択行の英訳を再生成」を実行してください。',
    requestedAt:c&&c.requestedAt||null,reservedAt:c&&c.reservedAt||null,responseAt:c&&c.responseAt||null,
    lastRecordedAt:c&&c.at||null,waitObservedAt:c&&c.waitObservedAt||null,nextRunAt:null,automaticRetry:false,
    elapsedMs:c&&c.requestedAt&&facts.now>=c.requestedAt?facts.now-c.requestedAt:null};
  if(!c)return detail;
  const reasons={API_UNCONFIRMED:'APIの通信または応答形式を確認できませんでした。',EMPTY_ENGLISH:'応答の英訳が空でした。',
    MONTHLY_LIMIT:'月の費用または回数上限に達しました。',INPUT_LIMIT:'送信文字量の上限に達しました。',
    WRITE_CONFLICT:'保存時に同時編集を検出しました。',ROW_ID_MISSING:'対象行の識別を確認できません。',
    USER_HOLD:'行は保留です。',INPUT_CHANGED:'受付後に入力内容が変わりました。',USER_EDIT:'編集により受付が停止しました。',
    MEANING_REVIEW_REQUIRED:'旧処理の意味確認待ちです。英訳候補は未保存です。',
    UPDATED_UNREVIEWED:'英訳候補保存済みです。採否は未確認です。',UPDATED_REVIEW_REQUIRED:'英訳候補保存済みです。意味や引用の注意があります。',
    UPDATED_LOG_UNSAVED:'英訳候補保存済みですが、同時編集または容量上限により根拠欄のログを保存できませんでした。'};
  if(c.status==='RESERVED'||c.status==='WRITING'){
    detail.phase=c.status==='RESERVED'?'送信予約あり・応答未確認':'応答確認済み・保存完了未確認';
    detail.reason=c.status==='RESERVED'?'送信予約の記録があります。実際のAPI開始・実行中・終了は確認できません。':'保存開始の記録があります。現在も保存中か、途中で停止したかは確認できません。';
    detail.nextAction='再送せず、GASの実行履歴と同じ行の英訳候補・根拠欄を確認してください。';
  }else if(facts.inputChanged){
    detail.phase='入力変更あり';
    detail.reason='現在の内容と受付記録が一致しません。以前の結果や注意は現在の内容に適用できません。';
    detail.nextAction='現在の内容を確認し、対象行を選んで再生成してください。';
    if(facts.inFlight){
      detail.reason+=' 送信／結果未確定の記録もあります。現在の実行状況は不明です。';
      detail.nextAction='再送せず、GASの実行履歴と関係する行の英訳候補・根拠欄を確認してください。送信中記録は自動解除しません。';
    }
  }else if(c.status==='REQUEST'){
    detail.phase='受付済み・送信開始未確認';
    if(facts.inFlight){
      detail.reason=facts.flightMatched?'別の送信中または結果未確定の記録があり、新しい送信を止めています。':'対応する処理を確認できない送信中記録があり、新しい送信を止めています。実行中かは不明です。';
      detail.nextAction='再送せず、GASの実行履歴と前回の英訳候補・根拠欄を確認してください。送信中記録は自動解除しません。';
    }else if(!facts.keyPresent){
      detail.phase='停止・設定不足';detail.reason='APIキーが未設定のため送信できません。';
      detail.nextAction='APIキー設定を確認後、対象行を選んで再生成してください。';
    }else if(facts.now<c.readyAt){
      detail.phase='受付済み・編集確定待ち';detail.reason='短い編集確定待ち時間内です。自動送信の予約ではありません。';
      detail.nextAction='少し待って、対象行を選んで再生成してください。';
    }else{
      detail.reason=c.waitCode==='BATCH_LIMIT'?'前回は1回3件の上限で受付処理を終了しました。':c.waitCode==='TIME_LIMIT'?'前回は処理時間の上限で受付処理を終了しました。':'送信開始の記録がありません。受付操作が実行中か終了済みかは確認できません。';
      detail.nextAction='実行履歴で前回の終了を確認し、残りの対象行を選んで再生成してください。';
    }
  }else if(c.status==='WRITTEN'){
    detail.phase='保存済み・本人確認待ち';detail.reason=reasons[c.reason]||'保存済みです。採否は未確認です。';
    detail.nextAction='同じ行の英訳候補と根拠欄を確認し、内容と採否を本人が判断してください。';
  }else if(c.status==='HOLD'){
    detail.phase='停止・要確認';detail.reason=reasons[c.reason]||'停止理由を確認できません。';
    detail.nextAction='同じ行の根拠欄と必要に応じて実行履歴を確認し、原因を解消してから手動再生成してください。';
  }else{
    detail.phase='再生成未依頼';detail.reason=reasons[c.reason]||'明示的な再生成依頼はありません。';
  }
  if(facts.inputChanged&&['RESERVED','WRITING'].includes(c.status))detail.reason+=' 現在の入力も受付時から変わっています。';
  if(c.whomStatus){
    if(c.status==='WRITING')detail.reason+=' 本文英訳・指示対象英訳の保存完了は未確認です。';
    else if(!facts.inputChanged)detail.reason+=' 指示対象英訳：'+(c.whomStatus==='PENDING'?'更新完了は未確認です。':c.whomStatus==='UPDATED'?'保存済みです。':'保持しました。')+c.whomReason;
    detail.nextAction+=' 本文英訳・指示対象英訳・根拠欄を確認してください。';
  }
  return detail;
}
function sourceEnglishStatusTime_(timestamp,timezone){
  return timestamp?Utilities.formatDate(new Date(timestamp),timezone,'yyyy-MM-dd HH:mm:ss')+' '+timezone:'不明（時刻の記録なし）';
}
