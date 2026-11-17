// Stored review memo only. Must run under the writer's existing ScriptLock.
function yut40AssertLegacyReviewMemo_(memo) {
  if (memo !== null && memo !== undefined && typeof memo !== 'string')
    throw new Error('判定メモの状態を確認できません．保存していません．');
  const text = memo || '';
  if (text.indexOf('YUT40_') !== -1 || text.indexOf('[[decision-lab') !== -1)
    throw new Error('管理中の判定記録は旧画面から変更できません．保存していません．');
}

/** ISOLATED INTEGRATION LAB ONLY. Load after the pinned GAS source in a fake-service VM.
 * No deployment entry points or menu changes. Paid calls are supplied by upstream mocks.
 * Existing registration functions remain the write authority; unresolved alias writes are denied.
 */
const UNIFIED_LAB_ORIGINALS_={run:maintenanceNotesRun,register:maintenanceNotesRegister,lock:rowCompletionLock_,generate:rowCompletionGenerate,apply:rowCompletionApply,finish:rowCompletionFinish,save:rowCompletionSave_,stored:rowCompletionStored_};
let UNIFIED_LAB_EXECUTION_=null;
function unifiedIntakePreflight_(stage,id){if(UNIFIED_LAB_EXECUTION_)UNIFIED_LAB_EXECUTION_.assertCurrent();}
let UNIFIED_LAB_HOLD_TRANSITION_=null;
function unifiedIntakeHeld_(job){
  const held=job&&job.heldIntake;if(!held)return null;
  if(held.version!==1||!held.job||!held.job.intake||held.job.closed||held.job.heldIntake||held.job.book!==job.book||rowCompletionHash_(held.job)!==held.hash){const e=new Error('保留中の作業記録を確認できません．削除せず停止します．');e.code='held_record_corrupt';throw e;}
  return held;
}
function unifiedIntakeCarryHeld_(job){
  const previous=UNIFIED_LAB_ORIGINALS_.stored(),held=unifiedIntakeHeld_(previous&&previous.job);
  const stop=code=>{const e=new Error('保留枠を上書き・破棄せず停止しました．');e.code=code;throw e;};
  if(held){
    if(job.book!==held.job.book)stop('held_book_mismatch');
    if(job.id===held.job.id){if(UNIFIED_LAB_HOLD_TRANSITION_!=='restore'||rowCompletionHash_(job)!==held.hash)stop('restore_required');delete job.heldIntake;return;}
    if(job.intake)stop('held_slot_occupied');
    if(job.heldIntake&&rowCompletionHash_(job.heldIntake)!==rowCompletionHash_(held))stop('held_slot_occupied');
    job.heldIntake=JSON.parse(JSON.stringify(held));
  }else if(job.heldIntake){if(UNIFIED_LAB_HOLD_TRANSITION_!=='pause')stop('pause_required');unifiedIntakeHeld_(job);}
}
rowCompletionSave_=function(job){unifiedIntakeCarryHeld_(job);return UNIFIED_LAB_ORIGINALS_.save(job);};
function createUnifiedIntakeLab_() {
  const originalRun=UNIFIED_LAB_ORIGINALS_.run, originalRegister=UNIFIED_LAB_ORIGINALS_.register;
  const prefix='UNIFIED_INTAKE_LAB:', props={getProperty:k=>PropertiesService.getUserProperties().getProperty(k),setProperty:(k,v)=>PropertiesService.getUserProperties().setProperty(k,v),getKeys:()=>PropertiesService.getUserProperties().getKeys(),deleteProperty:k=>PropertiesService.getUserProperties().deleteProperty(k)};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const fail=(code,message)=>{const e=new Error(message);e.code=code;throw e;};
  const check=(v,code,message)=>{if(!v)fail(code,message);};
  const hash=x=>rowCompletionHash_(x);
  const normalize=x=>normalizeObservedTerm(String(x||''));
  function optional(book,name,headers){return typeof maintenanceLedgerOptionalSheet_==='function'?maintenanceLedgerOptionalSheet_(book,name,headers):book.getSheetByName(name);}
  function readRows(book,name,headers,required){
    const sheet=optional(book,name,headers);
    if(!sheet){if(required)fail('missing_records','必要な保存記録がありません．自動作成せず停止します．');return [];}
    check(sheet.getLastRow()<=10001,'too_large','保存記録の上限を確認してください．');
    const head=sheet.getRange(1,1,1,headers.length).getValues()[0];
    check(JSON.stringify(head)===JSON.stringify(headers),'layout','保存記録の列構成が変わりました．');
    return sheet.getLastRow()<2?[]:sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
  }
  function one(rows,predicate,label){const found=rows.filter(predicate);check(found.length<=1,'ambiguous_link',label+'が重複しています．');return found[0]||null;}
  function read(id){
    check(/^observation-[a-f0-9]{24}$/.test(String(id||'')),'invalid_id','観測IDが不正です．');
    const book=rowCompletionBook_();
    const observations=readRows(book,UNREGISTERED_RESULT_TERM_SHEET_NAME,UNREGISTERED_RESULT_TERM_HEADERS,true);
    const observation=one(observations,r=>String(r[0])===id,'観測');check(observation,'missing_observation','観測を確認できません．');
    const reviews=readRows(book,JEV_REVIEW_SHEET_NAME,JEV_REVIEW_HEADERS,false);
    const candidates=readRows(book,UNREGISTERED_TERM_CANDIDATE_SHEET_NAME,UNREGISTERED_TERM_CANDIDATE_HEADERS,false);
    const review=observation[9]?one(reviews,r=>String(r[0])===String(observation[9]),'判定'):null;
    if(observation[9])check(review,'missing_review','観測に対応する判定がありません．');
    if(review)check(normalize(review[1])===normalize(observation[1])&&normalize(review[3]||review[1])===normalize(observation[2]||observation[1]),'history_mismatch','判定の対象語と観測語が一致しません．');
    const cid=dictionaryCandidateRecordId('candidate',normalize(observation[2]||observation[1]));
    const candidate=one(candidates,r=>String(r[0])===cid,'旧草案');
    if(candidate){check(normalize(candidate[1])===normalize(observation[1])&&normalize(candidate[2])===normalize(observation[2]||observation[1]),'history_mismatch','旧草案の対象語と観測語が一致しません．');check(review&&String(candidate[14])===String(review[0]),'candidate_review_mismatch','旧草案の判定参照を確認できません．');}
    const notes=book.getSheetByName('Notes');check(notes,'missing_notes','Notes がありません．');
    const noteRows=notesRegistrationRead_(notes).rows;
    const mappings=readRows(book,EXPERIMENTAL_TERM_MAPPING_SHEET_NAME,EXPERIMENTAL_TERM_MAPPING_HEADERS,true);
    const storedRecord=rowCompletionStored_(),stored=storedRecord&&storedRecord.job.book===book.getId()?storedRecord.job:null;
    const holderStamp=stored?hash({revision:storedRecord.revision,slot:storedRecord.slot,job:stored}):null;
    const held=unifiedIntakeHeld_(stored);
    const job=stored&&stored.intake&&stored.intake.observationId===id?stored:held&&held.job.intake.observationId===id?held.job:null;
    const suspended=Boolean(held&&job===held.job),heldOther=Boolean(held&&!suspended);
    const entry=job?one(noteRows,r=>r.entryId===job.intake.entryId,'登録先'):one(noteRows,r=>r.entryId&&r.observationId===id&&normalize(r.values.de)===normalize(observation[1])&&['ja','en','source'].every(f=>String(r.values[f]||'').trim()),'登録先');
    let evidence=null,evidenceError='';
    try{evidence=maintenanceNotesSource_(book,String(observation[1]||''));}catch(e){evidenceError=String(e.message||e);}
    const receiptRaw=props.getProperty(prefix+'dispatch:'+id);let receipt=null;
    if(receiptRaw){try{receipt=JSON.parse(receiptRaw);}catch(_){fail('receipt_corrupt','実行記録を確認できません．再送しません．');}check(receipt&&['pending','complete'].includes(receipt.status)&&receipt.kind==='generate'&&typeof receipt.token==='string'&&receipt.token.length>0,'receipt_corrupt','実行記録の構成を確認できません．再送しません．');}
    const row=job&&job.rows&&job.rows[0],hasGenerationClaim=Boolean(row&&PropertiesService.getScriptProperties().getProperty(row.claim||rowCompletionClaimKey_(job,row)));
    const intakeClaim=PropertiesService.getScriptProperties().getProperty(ROW_COMPLETION_PREFIX+'claim:'+hash(['notes-intake',book.getId(),normalize(observation[1])]))||'';
    const raw={stored,holderStamp,suspended,heldOther,intakeClaim,observation,review,candidate,noteRows,mappings,job,entry,evidence,evidenceError,hasGenerationClaim,otherWorkPending:Boolean(stored&&!stored.closed&&stored!==job),receipt};
    raw.snapshot=hash(raw);return raw;
  }
  function status(s){
    const c=s.candidate,j=s.job,r=j&&j.rows&&j.rows[0];
    if(!['未判定','Jev判定待ち','Jev判定済み','候補移送済み'].includes(s.observation[8]))return {code:'unknown_status',message:'観測状態が未知です．'};
    if(s.observation[8]==='Jev判定待ち')return {code:'jev_unknown',message:'Jev の実行結果を確認するまで再送しません．'};
    if(c&&['生成中','結果要確認'].includes(c[12]))return {code:'legacy_unknown',message:'旧草案の結果要確認です．Stimme も新入口から再送しません．'};
    if(c&&typeof maintenanceLedgerExperimental_==='function'&&maintenanceLedgerExperimental_(c))return {code:'experimental',message:'実験草案は本番登録しません．'};
    if(c&&!['','未作成','生成中','結果要確認','作成済み','再生成待ち'].includes(c[12]))return {code:'unknown_status',message:'旧草案の状態が未知です．'};
    if(j&&(!['ready','preparing','registering','registered'].includes(j.intake.phase)||(j.intake.flow!=='review_before_insert'&&!(j.intake.flow===undefined&&Number.isInteger(j.intake.number)&&j.intake.number>=2))))return {code:'unknown_status',message:'作業段階・互換形式を確認できません．'};
    if(j&&j.intake.phase==='preparing')return {code:'legacy_preparing',message:'旧方式の準備途中です．保存内容の個別照合が必要です．'};
    if(j&&((j.intake.phase==='registering'&&!['applying','partial'].includes(r&&r.status))||(j.intake.phase==='registered'&&(!j.closed||!r||r.status!=='applied'))))return {code:'unknown_status',message:'作業段階と保存状態が一致しません．'};
    if(r&&!['pending','generating','uncertain','draft','needs_review','applying','partial','applied'].includes(r.status))return {code:'unknown_status',message:'作業状態が未知です．'};
    if(s.suspended)return {code:'paused',underlying:r&&r.status,message:'保留中の未登録語です．元の草案と予約を保持しています．空欄補完を終えてから同じ作業へ戻せます．'};
    if(r&&(['generating','uncertain'].includes(r.status)||(r.status==='pending'&&s.hasGenerationClaim)))return {code:'api_unknown',message:'生成結果は未確定です．再送しません．'};
    if(s.review&&!['未確認','採用','保留','却下'].includes(s.review[12]))return {code:'unknown_status',message:'判定状態が未知です．'};
    if(s.review&&['保留','却下'].includes(s.review[12]))return {code:'held',message:'保留・却下の記録です．先に判定を見直してください．'};
    if(s.observation[8]==='候補移送済み'&&s.review){
      const ok=s.review[6]==='NEW_TERM_CANDIDATE'?Boolean(c&&String(c[14])===String(s.review[0])):s.mappings.some(m=>normalize(m[0])===normalize(s.review[7])&&normalize(m[1])===normalize(s.observation[1]));
      if(!ok)return {code:'transfer_mismatch',message:'移送済みの履歴と登録先が不一致です．再移送しません．'};
    }
    if(c&&c[10]==='Notes反映済み'&&s.noteRows.filter(n=>normalize(n.values.de)===normalize(c[16])).length!==1)return {code:'transfer_mismatch',message:'旧登録履歴と現在の見出しが一致しません．復旧の確認が必要です．'};
    if(j&&j.closed){
      if(j.intake.phase==='registered'&&s.entry)return {code:'registered',message:'Notes 登録済み．公開反映はこの検証の対象外です．'};
      return {code:'closed',message:'終了済みの作業です．履歴を保持し，新しい生成は行いません．'};
    }
    if(j&&(!s.review||s.review[4]!=='Jev'||s.review[5]!=='ADVISORY'))return {code:'advice_required',message:'作業に対応する保存済み判定を確認できません．登録を再開せず記録を確認してください．'};
    if(j&&s.review&&(s.review[12]!=='採用'||s.review[6]!=='NEW_TERM_CANDIDATE'))return {code:'decision_changed',message:'新見出しとして保存された判定を確認してください．生成・登録を再開しません．'};
    if(r&&['applying','partial'].includes(r.status))return {code:'resume_required',message:'登録結果を照合し，保存済み承認内容だけで再開してください．'};
    if(s.receipt&&s.receipt.status==='pending'&&!j)return {code:'dispatch_unknown',message:'実行開始の結果が未確定です．別の確認からも自動再送しません．'};
    if(!j&&!s.intakeClaim&&s.entry)return {code:'registered',message:'Notes の管理ID・観測IDと本文を照合し，登録済みを確認しました．公開反映は未確認です．'};
    if(s.intakeClaim&&(!j||s.intakeClaim!==j.id))return {code:'work_record_missing',message:'この語の既存登録予約が残っています．作業記録を復旧するまで再送しません．'};
    if(s.heldOther)return {code:'held_slot_occupied',message:'別の未登録語を保留しています．先にその作業を確認してください．通常の空欄補完は利用できます．'};
    if(s.otherWorkPending)return {code:'other_work',message:'別の語または既存行補完の作業を保護しています．'};
    if(s.evidenceError)return {code:'source_unverified',message:s.evidenceError};
    if(r&&r.status==='pending')return {code:'prepared',message:'生成開始前で中断しています．保存済みの出典を確認し，API 開始を明示確認して再開してください．'};
    if(r&&['draft','needs_review','applied'].includes(r.status))return {code:'draft',message:'保存済み案の確認です．再生成しません．'};
    return {code:'review',message:'Jev の助言と原文を本人が確認してください．'};
  }
  function restartable(s){
    const j=s.job,r=j&&j.rows&&j.rows[0],c=s.candidate;
    if((rowCompletionStored_()&&rowCompletionStored_().job.book!==rowCompletionBook_().getId())||s.suspended||s.heldOther||s.otherWorkPending||s.entry)return false;
    if(s.noteRows.some(n=>normalize(n.values.de)===normalize(s.observation[1])||n.observationId===String(s.observation[0])||(j&&n.entryId===j.intake.entryId))||s.mappings.some(m=>normalize(m[1])===normalize(s.observation[1])))return false;
    if(!s.review||s.review[4]!=='Jev'||s.review[5]!=='ADVISORY'||s.review[12]!=='採用'||s.review[6]!=='NEW_TERM_CANDIDATE')return false;
    if(c&&(c[10]==='Notes反映済み'||c[12]==='生成中'||maintenanceLedgerExperimental_(c)))return false;
    if(j)return j.intake.flow==='review_before_insert'&&j.intake.phase==='ready'&&!j.intake.intent&&j.rows.length===1&&r.status==='uncertain'&&(!s.intakeClaim||s.intakeClaim===j.id);
    return !!(c&&c[12]==='結果要確認'&&!s.intakeClaim&&!s.receipt);
  }
  function restart(id,expectedSnapshot,confirmed){
    check(confirmed===true,'restart_confirmation','前の作業をやめて新しく始める確認欄を選んでください．');
    return rowCompletionLock_(function(){
      singleOperatorAliasAssertNoPending_();const s=read(id);
      check(typeof expectedSnapshot==='string'&&/^[a-f0-9]{64}$/.test(expectedSnapshot)&&expectedSnapshot===s.snapshot,'stale','表示後に状態が変わりました．読み直してください．');
      singleOperatorJudgmentAssertContext_(id,{observation:s.observation,review:s.review});if(s.review)yut40AssertLegacyReviewMemo_(s.review[13]);
      check(restartable(s),'cannot_restart','登録済み・実行中・別の保存作業がある場合は新しく始められません．');
      const j=s.job,book=rowCompletionBook_();
      if(j){const r=j.rows[0],sp=PropertiesService.getScriptProperties();check(j.intake.claim&&(!sp.getProperty(j.intake.claim)||sp.getProperty(j.intake.claim)===j.id),'claim_mismatch','保存作業の予約が変わりました．');const key=r.claim||rowCompletionClaimKey_(j,r);check(!sp.getProperty(key)||sp.getProperty(key)===j.id,'claim_mismatch','別の生成処理があります．');}
      if(s.candidate){
        const sheet=optional(book,UNREGISTERED_TERM_CANDIDATE_SHEET_NAME,UNREGISTERED_TERM_CANDIDATE_HEADERS),found=candidateWizardFindLinked(sheet,UNREGISTERED_TERM_CANDIDATE_HEADERS.length,s.candidate[0]);
        check(found&&hash(found.row)===hash(s.candidate),'stale','以前の作業が変わりました．');
        // One write through the existing ledger adapter; old generation content is discarded.
        const row=found.row.slice();row[10]='候補';row[12]='未作成';row[13]='';for(let i=16;i<row.length;i++)row[i]='';row[26]='未確認';
        sheet.getRange(found.rowNumber||found.number,1,1,row.length).setValues([row.map(sheetLiteralValue_)]);
      }
      if(j){
        // Close first: late callbacks are rejected even if cleanup is interrupted.
        j.closed=true;rowCompletionSave_(j);
        check(rowCompletionStored_().job.closed&&rowCompletionStored_().job.id===j.id,'discard_unknown','終了結果を確認できません．状態を読み直してください．');
        const sp=PropertiesService.getScriptProperties(),r=j.rows[0];
        [r.claim||rowCompletionClaimKey_(j,r),j.intake.claim].filter(Boolean).forEach(k=>{if(sp.getProperty(k)===j.id)sp.deleteProperty(k);check(!sp.getProperty(k),'discard_unknown','以前の作業の終了を確認できません．');});
        props.deleteProperty(prefix+'choice');clearCompletedReceipt(id);
        check(!props.getProperty(prefix+'dispatch:'+id),'discard_unknown','以前の開始結果を確認できません．');
        // Existing closed empty slot format. The next generation gets a new ID.
        rowCompletionSave_({id:Utilities.getUuid(),book:j.book,tab:j.tab,sheetId:j.sheetId,created:new Date().toISOString(),closed:true,rows:[]});
      }
      props.deleteProperty(prefix+'choice');clearCompletedReceipt(id);return view(id);
    });
  }
  function view(id){const s=read(id);return {restartAllowed:restartable(s),state:status(s),paused:s.suspended,holderStamp:s.holderStamp,activeWork:s.stored?{id:s.stored.id,closed:s.stored.closed,intake:Boolean(s.stored.intake)}:null,snapshot:s.snapshot,observation:clone(s.observation),review:clone(s.review),job:clone(s.job),entry:clone(s.entry),evidence:clone(s.evidence),legacy:clone(s.candidate)};}
  function basis(s,choice){const keys=[normalize(s.observation[1]),normalize(choice&&choice.headword),normalize(s.job&&s.job.intake.plan.de)].filter(Boolean);return {observation:[0,1,2,6,8,9,10].map(i=>s.observation[i]),review:s.review,candidate:s.candidate,notes:s.noteRows.filter(n=>keys.includes(normalize(n.values.de))),mappings:s.mappings.filter(m=>keys.includes(normalize(m[0]))||keys.includes(normalize(m[1]))),evidence:s.evidence,evidenceError:s.evidenceError};}
  function confirmationSnapshot(s,choice){return hash({basis:basis(s,choice),job:s.job,intakeClaim:s.intakeClaim,receipt:s.receipt,otherWorkPending:s.otherWorkPending});}
  function execute(kind,id,choice,expected,action){const previous=UNIFIED_LAB_EXECUTION_;UNIFIED_LAB_EXECUTION_={kind,observationId:id,assertCurrent:()=>{singleOperatorAliasAssertNoPending_();const current=read(id);singleOperatorJudgmentAssertContext_(id,{observation:current.observation,review:current.review});if(current.review)yut40AssertLegacyReviewMemo_(current.review[13]);check(hash(basis(current,choice))===expected,'changed_during_action','実行直前に判定・原文・登録先が変わりました．保存せず再確認してください．');}};try{return action();}finally{UNIFIED_LAB_EXECUTION_=previous;}}
  function clearCompletedReceipt(id){props.deleteProperty(prefix+'dispatch:'+id);}
  function usable(s){singleOperatorAliasAssertNoPending_();singleOperatorJudgmentAssertContext_(String(s.observation[0]),{observation:s.observation,review:s.review});if(s.review)yut40AssertLegacyReviewMemo_(s.review[13]);const st=status(s);check(['review','draft','prepared'].includes(st.code),st.code,st.message);}
  function choose(id,choice,checked){
    check(checked===true,'human_review','分類を本人が確認してください．');
    const s=read(id);usable(s);
    check(choice&&['new','alias'].includes(choice.kind),'choice','登録先の分類を確認してください．');
    // This laboratory supports previously obtained Jev advice only. Manual/no-Jev policy remains undecided.
    check(s.review&&s.review[4]==='Jev'&&s.review[5]==='ADVISORY','advice_required','既存の Jev 助言が必要です．この試作は Jev を実行しません．');
    if(choice.kind==='alias'){
      check(Object.prototype.hasOwnProperty.call(RELATED_FORM_JEV_CATEGORIES,choice.category),'choice','語形区分を確認してください．');
      check(s.noteRows.filter(n=>normalize(n.values.de)===normalize(choice.headword)).length===1,'headword','対応見出しを一意に確認してください．');
    }else{
      check(s.review[12]==='採用'&&s.review[6]==='NEW_TERM_CANDIDATE','decision_save_required','新見出しとしての判定を履歴へ保存してから進んでください．私有の選択だけで旧判定を変更しません．');
      check(!s.mappings.some(m=>normalize(m[1])===normalize(s.observation[1])),'mapping_exists','登録済みの語形対応を確認してください．');
      check(!s.noteRows.some(n=>normalize(n.values.de)===normalize(s.observation[1])&&(!s.job||n.entryId!==s.job.intake.entryId||n.observationId!==id)),'heading_exists','既存の見出しを確認してください．');
    }
    const token=Utilities.getUuid(),record={id,token,choice:clone(choice),snapshot:confirmationSnapshot(s,choice),used:false};
    props.setProperty(prefix+'choice',JSON.stringify(record));
    return {token,choice:clone(choice),message:'分岐を確認しました．Notes・語形対応は未変更です．'};
  }
  function resolve(id,token){
    const raw=props.getProperty(prefix+'choice');check(raw,'confirmation','本人確認をやり直してください．');
    let t;try{t=JSON.parse(raw);}catch(_){fail('confirmation','確認記録を読めません．');}
    check(t.token===token,'confirmation','前の画面の確認は失効しました．');
    check(t.id===id,'wrong_observation','別の語の確認は流用できません．');
    const s=read(id);usable(s);check(t.snapshot===confirmationSnapshot(s,t.choice),'stale','確認後に状態が変わりました．再確認してください．');
    return {s,t};
  }
  function open(id,token){const {s,t}=resolve(id,token);
    if(t.choice.kind==='alias')return {route:'alias',blocked:true,code:'alias_policy_unresolved',message:'検索対象・同形別見出し・Notes.source の仕様は未決です．既存設定を保持し，この統合版では語形登録しません．',mappings:clone(s.mappings),choice:clone(t.choice)};
    return {route:'new',blocked:false,job:clone(s.job),legacy:clone(s.candidate),evidence:clone(s.evidence),message:'確認画面です．API・Notes 書込は実行していません．'};
  }
  function dispatch(id,token,apiConfirmed,prepared){
    check(apiConfirmed===true,'api_confirmation','API を使う操作の確認が必要です．');
    const lock=LockService.getScriptLock();check(lock.tryLock(10000),'busy','別の処理中です．');let t,approvedBasis;
    try{
      const resolved=resolve(id,token);t=resolved.t;const s=resolved.s;approvedBasis=hash(basis(s,t.choice));
      check(t.choice.kind==='new','alias_policy_unresolved','語形登録の仕様は未決です．');
      check(!t.used,'consumed','同じ操作は再実行しません．保存状態を確認してください．');
      check(!s.candidate||s.candidate[12]!=='作成済み','saved_draft_exists','保存済み草案を読み込んでください．再生成しません．');
      if(prepared)check(s.job&&status(s).code==='prepared','not_prepared','生成前の同じ作業だけ再開できます．');
      else check(!s.job,'already_started','既存の作業を確認してください．新しい生成は行いません．');
      check(props.getKeys().filter(k=>k.startsWith(prefix+'dispatch:')).length<20||props.getProperty(prefix+'dispatch:'+id),'receipt_limit','未確定の実行記録が上限です．既存記録を確認してください．');
      t.used=true;props.setProperty(prefix+'choice',JSON.stringify(t));
      props.setProperty(prefix+'dispatch:'+id,JSON.stringify({status:'pending',kind:'generate',token}));
    }finally{lock.releaseLock();}
    try{
      execute('generate',id,t.choice,approvedBasis,()=>originalRun(id));
      rowCompletionLock_(function(){const raw=props.getProperty(prefix+'dispatch:'+id);let current;try{current=JSON.parse(raw);}catch(_){return;}if(current&&current.status==='pending'&&current.token===token)props.setProperty(prefix+'dispatch:'+id,JSON.stringify({status:'complete',kind:'generate',token}));});
      return view(id);
    }catch(e){return {state:{code:'operation_unknown',message:String(e.message||e)},saved:view(id)};}
  }
  function loadSaved(id,token){const {s,t}=resolve(id,token);check(t.choice.kind==='new','alias_policy_unresolved','語形登録の仕様は未決です．');check(s.candidate&&s.candidate[12]==='作成済み','no_saved_draft','保存済み草案がありません．');execute('prepare',id,t.choice,hash(basis(s,t.choice)),()=>maintenanceNotesPrepare_(id));return view(id);}
  function validate(id,fields){const s=read(id);check(status(s).code==='draft','no_draft','確認可能な草案がありません．');return maintenanceNotesValidateDraft(s.job.id,hash(s.job),fields);}
  function register(id,token,fields,checked){
    check(checked===true,'content_confirmation','出典・日英本文を本人が確認してください．');
    const {s,t}=resolve(id,token);check(t.choice.kind==='new','alias_policy_unresolved','語形登録の仕様は未決です．');
    check(status(s).code==='draft','no_draft','登録可能な本文案がありません．');
    execute('register',id,t.choice,hash(basis(s,t.choice)),()=>originalRegister(s.job.id,hash(s.job),fields,true));const after=view(id);if(after.state.code==='registered')clearCompletedReceipt(id);return view(id);
  }
  function resume(id,checked,expectedSnapshot){
    check(checked===true,'resume_confirmation','保存済み承認内容で再開することを確認してください．');
    singleOperatorAliasAssertNoPending_();const s=read(id);singleOperatorJudgmentAssertContext_(id,{observation:s.observation,review:s.review});if(s.review)yut40AssertLegacyReviewMemo_(s.review[13]);if(expectedSnapshot!==undefined)check(typeof expectedSnapshot==='string'&&/^[a-f0-9]{64}$/.test(expectedSnapshot)&&s.snapshot===expectedSnapshot,'stale_resume_view','表示後に保存状態が変わりました．状態を読み直して再確認してください．');check(status(s).code==='resume_required','not_resumable','登録途中の同じ作業だけ再開できます．');
    check(s.job.intake.intent,'missing_intent','保存済み承認内容を確認できません．');
    const i=s.job.intake.intent;execute('register',id,{kind:'new'},hash(basis(s,{kind:'new'})),()=>originalRegister(s.job.id,hash(s.job),{ja:i.ja,en:i.en},true));const after=view(id);if(after.state.code==='registered')clearCompletedReceipt(id);return view(id);
  }
  function pause(id,expectedJobHash,checked,expectedHolderStamp){
    check(checked===true,'pause_confirmation','草案と予約を保持したまま保留することを確認してください．');
    return rowCompletionLock_(function(){const s=read(id),j=s.job;
      if(s.suspended){check(hash(j)===expectedJobHash,'stale','保留中の内容が変わりました．');return view(id);}
      check(j&&s.stored&&s.stored.id===j.id&&!j.closed,'not_active_intake','現在の未登録語作業だけ保留できます．');
      check(expectedHolderStamp===s.holderStamp,'stale_operation','別の保留・復帰操作が完了しています．画面を更新してください．');
      check(!unifiedIntakeHeld_(s.stored),'held_slot_occupied','保留枠は使用中です．');
      check(hash(j)===expectedJobHash,'stale','確認後に作業内容が変わりました．');
      const row=j.rows[0];check(['pending','uncertain','draft','needs_review'].includes(row.status)&&j.intake.phase==='ready','cannot_pause_running','実行中・登録途中は保留できません．保存結果を確認してください．');
      check(row.status!=='pending'||!s.hasGenerationClaim,'cannot_pause_running','生成予約が残っています．結果を確認してください．');
      check(s.intakeClaim===j.id&&j.intake.claim&&PropertiesService.getScriptProperties().getProperty(j.intake.claim)===j.id,'claim_mismatch','既存の登録予約と作業が一致しません．');
      if(row.claim)check(PropertiesService.getScriptProperties().getProperty(row.claim)===j.id,'claim_mismatch','既存の生成予約と作業が一致しません．');
      const held={version:1,job:clone(j),hash:hash(j)},placeholder={id:Utilities.getUuid(),book:j.book,tab:j.tab,sheetId:j.sheetId,created:new Date().toISOString(),closed:true,rows:[],heldIntake:held};
      UNIFIED_LAB_HOLD_TRANSITION_='pause';try{rowCompletionSave_(placeholder);}finally{UNIFIED_LAB_HOLD_TRANSITION_=null;}
      props.deleteProperty(prefix+'choice');return view(id);
    });
  }
  function restore(id,expectedJobHash,checked,expectedHolderStamp){
    check(checked===true,'restore_confirmation','保留した同じ作業へ戻ることを確認してください．');
    return rowCompletionLock_(function(){const s=read(id),j=s.job;
      check(s.suspended&&j,'not_paused','本人の保留中の作業がありません．');
      check(expectedHolderStamp===s.holderStamp,'stale_operation','別の作業・保留操作が完了しています．画面を更新してください．');
      check(s.stored.closed,'active_work_pending','現在の空欄補完を確認・終了してから戻してください．');
      check(hash(j)===expectedJobHash,'stale','保留中の内容が変わりました．');
      check(s.intakeClaim===j.id,'claim_mismatch','既存の登録予約を確認できません．');
      if(j.rows[0].claim)check(PropertiesService.getScriptProperties().getProperty(j.rows[0].claim)===j.id,'claim_mismatch','既存の生成予約を確認できません．');
      UNIFIED_LAB_HOLD_TRANSITION_='restore';try{rowCompletionSave_(clone(j));}finally{UNIFIED_LAB_HOLD_TRANSITION_=null;}
      props.deleteProperty(prefix+'choice');return view(id);
    });
  }
  function installCachedClientGuards(){
    const stop=()=>fail('legacy_retired','旧実行経路はこの隔離版では停止しています．新入口で状態を確認してください．');
    maintenanceNotesRun=stop;maintenanceNotesRegister=stop;
    candidateWizardCreateDraft=stop;candidateWizardPromote=stop;candidateWizardPrepareDraftRetry=stop;
    candidateWizardSaveDraft=stop;maintenanceAliasApply=stop;
    promoteApprovedDictionaryCandidateByReviewId=stop;promoteApprovedDictionaryCandidates=stop;
    rowCompletionGenerate=(id,number)=>{const j=rowCompletionJob_(id);if(j.intake&&!(UNIFIED_LAB_EXECUTION_&&UNIFIED_LAB_EXECUTION_.kind==='generate'&&UNIFIED_LAB_EXECUTION_.observationId===j.intake.observationId))stop();return UNIFIED_LAB_ORIGINALS_.generate(id,number);};
    rowCompletionApply=(id,...args)=>{if(rowCompletionJob_(id).intake)stop();return UNIFIED_LAB_ORIGINALS_.apply(id,...args);};
    rowCompletionFinish=(id,...args)=>{const j=rowCompletionJob_(id);if(j.intake&&!j.closed)stop();return UNIFIED_LAB_ORIGINALS_.finish(id,...args);};
    // Existing selected-row completion and ledger history functions are intentionally untouched.
  }
  return {view,restart,choose,open,generate:(id,token,confirmed)=>dispatch(id,token,confirmed,false),startPrepared:(id,token,confirmed)=>dispatch(id,token,confirmed,true),loadSaved,validate,register,resume,pause,restore,installCachedClientGuards};
}

/* Fixed-copy splice trial only. Load after the directly patched source and intake bridge.
 * Re-run this initialization on EVERY server execution, not just when opening UI.
 * No deployment, ownership service or separate authentication here. */
var singleOperatorIntake_ = createUnifiedIntakeLab_();
singleOperatorIntake_.installCachedClientGuards();

function singleOperatorIntakeView(observationId) {
  rowCompletionBook_();
  return singleOperatorIntakeResult_(observationId, singleOperatorIntake_.view(observationId));
}

function singleOperatorIntakeResume(observationId, expectedSnapshot, confirmed) {
  rowCompletionBook_();
  if (typeof expectedSnapshot !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSnapshot)) throw new Error('表示時の保存状態を確認できません．状態を読み直してください．');
  singleOperatorAliasAssertNoPending_();
  const shown = singleOperatorIntake_.view(observationId);
  singleOperatorJudgmentAssertContext_(observationId, shown);
  if (shown.review) yut40AssertLegacyReviewMemo_(shown.review[13]);
  // Existing bridge verifies phase, original intent and current evidence; original
  // register acquires rowCompletionLock_. Do not take a nested ScriptLock here.
  return singleOperatorIntakeResult_(observationId, singleOperatorIntake_.resume(observationId, confirmed, expectedSnapshot));
}

// Every successful view-shaped RPC uses the same alias-status presentation.
function singleOperatorIntakeResult_(id, result) {
  if (result && result.state && Array.isArray(result.observation)) {
    result.alias = createSingleOperatorAlias_().status(id);
    result.judgment = singleOperatorJudgmentState_(id, result);
  }
  return result;
}

// Thin bound-sheet RPC routing. Existing factory validates tokens, intent and inputs.
// This file supplies no credentials, storage, automatic retries or new authority.
function singleOperatorIntakeChoose(id, choice, confirmed) {
  singleOperatorIntakeNewCheck_(id);
  return singleOperatorIntake_.choose(id, choice, confirmed);
}
function singleOperatorIntakeOpen(id, token) {
  singleOperatorIntakeNewCheck_(id);
  return singleOperatorIntake_.open(id, token);
}
function singleOperatorIntakeGenerate(id, token, confirmed) {
  singleOperatorIntakeNewCheck_(id);
  return singleOperatorIntakeResult_(id, singleOperatorIntake_.generate(id, token, confirmed));
}
function singleOperatorIntakeLoadSaved(id, token) {
  singleOperatorIntakeNewCheck_(id);
  return singleOperatorIntakeResult_(id, singleOperatorIntake_.loadSaved(id, token));
}
function singleOperatorIntakeStartPrepared(id, token, confirmed) {
  singleOperatorIntakeNewCheck_(id);
  return singleOperatorIntakeResult_(id, singleOperatorIntake_.startPrepared(id, token, confirmed));
}
function singleOperatorIntakeValidate(id, fields) {
  singleOperatorIntakeNewCheck_(id);
  return singleOperatorIntake_.validate(id, fields);
}
function singleOperatorIntakeRegister(id, token, fields, confirmed) {
  singleOperatorIntakeNewCheck_(id);
  return singleOperatorIntakeResult_(id, singleOperatorIntake_.register(id, token, fields, confirmed));
}

// These legacy NEW paths do not interpret managed review envelopes.
function singleOperatorIntakeNewCheck_(id) {
  rowCompletionBook_();
  singleOperatorAliasAssertNoPending_();
  const saved = singleOperatorIntake_.view(id);
  singleOperatorJudgmentAssertContext_(id, saved);
  if (saved.review) yut40AssertLegacyReviewMemo_(saved.review[13]);
}

function singleOperatorIntakeRestart(id, expectedSnapshot, confirmed) {
  return singleOperatorIntakeResult_(id, singleOperatorIntake_.restart(id, expectedSnapshot, confirmed));
}

/** Single-operator bound-Sheet alias writer. No transport, owner registry or new scope.
 * One latest intent per UserProperties; unfinished/unknown records are never replaced.
 */
function createSingleOperatorAlias_(){
 const clone=x=>JSON.parse(JSON.stringify(x)),hash=x=>rowCompletionHash_(x);
 const CATEGORIES={INFLECTION:'語形変化（要分類）',ORTHOGRAPHIC_VARIANT:'別綴り',TYPO:'誤記候補'};
 const KEY='YUT40_SINGLE_ALIAS_INTENT_V1';
 const fail=(code,message)=>{const e=new Error(message);e.code=code;throw e;};
 const norm=normalizeObservedTerm;
 const literal=value=>typeof value==='string'&&value.startsWith("'")?"'"+value:sheetLiteralValue_(value);
 const book=()=>rowCompletionBook_();
 const props=()=>PropertiesService.getUserProperties();

 const check=(ok,code,message)=>{if(!ok)fail(code,message);};
 function record(){book();const raw=props().getProperty(KEY);if(!raw)return null;let r;try{r=JSON.parse(raw);}catch(_){fail('alias_record_corrupt','語形の保存記録を読めません．再登録せず確認してください．');}
  check(r&&r.schema===2&&r.intent&&r.checksum===hash([r.intent,r.phase])&&['prepared','append_started','mapping_saved','source_started','completed'].includes(r.phase),'alias_record_corrupt','語形の保存記録が不整合です．再登録しません．');
  check(r.intent.book===book().getId()&&/^observation-[a-f0-9]{24}$/.test(r.intent.observation)&&typeof r.intent.operationId==='string'&&r.intent.plan&&Array.isArray(r.intent.mapping),'alias_binding','別ブックまたは不正な語形の保存記録です．');
  const i=r.intent,p=i.plan;check(i.operationId.length>0&&typeof i.previewId==='string'&&p.schema===1&&p.choice&&p.choice.kind==='alias'&&Object.prototype.hasOwnProperty.call(CATEGORIES,p.category)&&p.category===p.choice.category&&p.mappingCategory===CATEGORIES[p.category]&&Array.isArray(p.flags)&&p.flags.length===2&&p.flags.every(v=>v==='対象')&&typeof p.term==='string'&&typeof p.headword==='string'&&typeof p.sourceBefore==='string'&&typeof p.sourceAfter==='string'&&typeof p.basis==='string'&&typeof p.targetHash==='string'&&i.mapping.length===6&&i.mapping.every(v=>typeof v==='string')&&i.mapping[0]===p.headword&&i.mapping[1]===p.term&&i.mapping[2]===CATEGORIES[p.category]&&i.mapping[3]==='対象'&&i.mapping[4]==='対象','alias_record_corrupt','語形の保存項目を確認できません．');return r;
 }
 function save(r){r.checksum=hash([r.intent,r.phase]);const raw=JSON.stringify(r);check(encodeURIComponent(raw).replace(/%[A-F0-9]{2}|./g,'x').length<8500,'alias_capacity','確認内容の保存容量が不足しています．書込み前に停止します．');props().setProperty(KEY,raw);check(props().getProperty(KEY)===raw,'alias_save_unknown','語形の保存記録を確認できません．');}
 function locked(fn){const lock=LockService.getScriptLock();check(lock.tryLock(10000),'alias_busy','別の保存処理中です．');try{return fn();}finally{lock.releaseLock();}}
 function current(id,choice){
  const v=createUnifiedIntakeLab_().view(id),review=v.review;
  singleOperatorJudgmentAssertContext_(id,v);
  check(['review','source_unverified'].includes(v.state.code)&&!v.job&&!v.paused&&(!v.activeWork||v.activeWork.closed)&&!v.legacy,'alias_work_blocked','既存作業・結果不明・旧草案を先に確認してください．');
  check(choice&&choice.kind==='alias'&&Object.prototype.hasOwnProperty.call(CATEGORIES,choice.category),'alias_choice','語形区分を確認してください．');
  if(review)yut40AssertLegacyReviewMemo_(review[13]);
  check(review&&review[4]==='Jev'&&review[5]==='ADVISORY'&&review[12]==='採用'&&review[6]===choice.category&&norm(review[7])===norm(choice.headword),'alias_decision_changed','保存済みの採用判断と対応先が一致しません．');
  const sheet=book().getSheetByName('Notes'),rows=notesRegistrationRead_(sheet).rows,targets=rows.filter(n=>norm(n.values.de)===norm(choice.headword));
  check(targets.length===1,'alias_headword','対応先の見出しを一意に確認できません．');
  const target=clone(targets[0]),source=maintenanceNotesSource_(book(),String(v.observation[1]),'alias');
  check(norm(source.de)!==norm(target.values.de),'alias_self','見出しと同じ語形は追加しません．');
  // Only use the already page/location-verified maintenance evidence, not the legacy source scan.
  check(source.proof.length>0,'alias_source','確認済み出典がありません．');
  const mapping=book().getSheetByName('語形対応'),mappingHeaders=['見出し','関連語形','語形区分','用語検索','実例検索','補足'];
  check(mapping&&JSON.stringify(mapping.getRange(1,1,1,6).getValues()[0])===JSON.stringify(mappingHeaders)&&mapping.getLastRow()<=10001,'alias_layout','語形対応の列・件数を確認してください．');
  const all=mapping.getLastRow()>1?clone(mapping.getRange(2,1,mapping.getLastRow()-1,6).getValues()):[],existing=all.filter(r=>norm(r[1])===norm(source.de));
  const headers=notesRegistrationHeader_(sheet),sourceColumn=notesRegistrationColumns_(headers).source+1,cell=sheet.getRange(target.number,sourceColumn);
  check(sourceColumn>0&&!cell.getFormula()&&cell.canEdit()&&!cell.isPartOfMerge(),'alias_source_protected','出典セルが数式・保護・結合されています．変更しません．');
  return{v,target,source,existing,mapping,cell,independent:rows.some(n=>norm(n.values.de)===norm(source.de)),basis:hash({book:book().getId(),observation:[0,1,2,6,8,9,10].map(i=>v.observation[i]),review,source,layout:headers})};
 }
 function plan(id,choice){const s=current(id,choice),other=s.existing.some(r=>norm(r[0])!==norm(s.target.values.de)),duplicate=s.existing.length>0;
  const before=String(s.target.values.source||''),present=new Set(before.match(/\[[^\]\r\n]+\]/g)||[]),markers=[...new Set(s.source.proof.map(p=>({GM:'[GM]',RW:'[RW: Oper]',RS:'[RS: Oper]'})[p.tab]))];
  check(markers.every(Boolean),'alias_source','未対応の出典です．');
  const missing=other||duplicate?[]:markers.filter(m=>!present.has(m)),after=before+(missing.length?(before?', ':'')+missing.join(', '):'');
  return{schema:1,choice:clone(choice),term:s.source.de,headword:s.target.values.de,category:choice.category,mappingCategory:CATEGORIES[choice.category],flags:['対象','対象'],independent:s.independent,existing:s.existing,blocked:other,duplicate:!other&&duplicate,reason:other?'同じ語形が別見出しに登録済みです．既存対応を表示して停止します．':duplicate?'同じペアは登録済みです．既存設定・出典は変更しません．':'新しい語形対応と確認済み出典の不足分だけを追加します．',sourceBefore:before,sourceAfter:after,missing,proof:clone(s.source.proof),target:s.target,basis:s.basis};
 }
 function targetHash(target){const value=clone(target);value.values.source='';return hash(value);}
 function compactPlan(p){const value=clone(p);value.targetHash=targetHash(value.target);delete value.target;delete value.proof;delete value.existing;delete value.reason;return value;}
 function displayPlan(r,s){const p=clone(r.intent.plan),target=clone(s.target);target.values.source=p.sourceBefore;return {...p,target,proof:clone(s.source.proof),existing:[],reason:'保存済みの承認内容を照合しました．'};}
 function reconcileState(r,allowMissing=false){const p=r.intent.plan,s=current(r.intent.observation,p.choice);
  check(s.basis===p.basis,'alias_basis_changed','原文・使用箇所・本人判断が変わりました．保存済み内容は変更しません．');
  const markers=[...new Set(s.source.proof.map(x=>({GM:'[GM]',RW:'[RW: Oper]',RS:'[RS: Oper]'})[x.tab]))],present=new Set(p.sourceBefore.match(/\[[^\]\r\n]+\]/g)||[]),missing=markers.filter(x=>!present.has(x));
  check(p.term===s.source.de&&p.headword===s.target.values.de&&p.category===p.choice.category&&hash(p.missing)===hash(missing)&&p.sourceAfter===p.sourceBefore+(missing.length?(p.sourceBefore?', ':'')+missing.join(', '):''),'alias_record_corrupt','保存済み出典差分・対応先を再照合できません．');
  const other=s.existing.filter(row=>norm(row[0])!==norm(p.headword));check(!other.length,'alias_mapping_conflict','別見出しへの対応が追加されています．既存対応を確認してください．');
  const ours=s.existing.filter(row=>hash(row)===hash(r.intent.mapping));check(s.existing.length===ours.length&&ours.length<=1,'alias_mapping_changed','語形の登録結果が承認内容と異なります．上書き・追加しません．');
  const source=String(s.target.values.source||'');
  check(targetHash(s.target)===p.targetHash,'alias_target_changed','対応先の行・本文・管理情報が変わりました．上書きしません．');
  check(source===p.sourceBefore||source===p.sourceAfter,'alias_source_changed','出典が別の内容へ変わりました．上書きしません．');
  if(!ours.length)check(r.phase==='prepared'||allowMissing,'alias_append_unknown','語形の追加結果を確認できません．自動で追加し直しません．');
  if(r.phase==='completed')check(ours.length===1&&source===p.sourceAfter,'alias_completed_changed','完了後の登録内容が変更されています．再登録しません．');
  return{s,mappingPresent:ours.length===1,sourceComplete:source===p.sourceAfter};
 }
 function advance(r){let state=reconcileState(r);if(r.phase==='completed')return status(r.intent.observation);
  if(!state.mappingPresent){r.phase='append_started';save(r);
   state=reconcileState(r,true);state.s.mapping.appendRow(r.intent.mapping.map(literal));SpreadsheetApp.flush();
  }
  state=reconcileState(r);r.phase='mapping_saved';save(r);
  if(!state.sourceComplete){r.phase='source_started';save(r);state=reconcileState(r);if(!state.sourceComplete)state.s.cell.setValue(literal(r.intent.plan.sourceAfter));SpreadsheetApp.flush();}
  state=reconcileState(r);check(state.mappingPresent&&state.sourceComplete,'alias_save_unknown','両方の保存結果を確認できません．');r.phase='completed';save(r);return status(r.intent.observation);
 }
 function readExisting(term){try{const t=book().getSheetByName('語形対応');return t&&t.getLastRow()>1?clone(t.getRange(2,1,t.getLastRow()-1,6).getValues()).filter(row=>norm(row[1])===norm(term)):[];}catch(_){return null;}}
 function status(id){try{const r=record();if(!r||r.phase==='completed'&&r.intent.observation!==id)return{status:'idle',record:null};check(r.intent.observation===id,'alias_pending_other','別の語形作業が途中です．先に保存済み内容を確認してください．');let state;try{state=reconcileState(r);}catch(e){return{status:'blocked',code:e.code,message:e.message,intent:clone(r.intent),expectedIntentHash:hash(r.intent),phase:r.phase,existing:readExisting(r.intent.plan.term),canResume:false};}
   return{status:r.phase==='completed'?'completed':'resume_required',intent:clone(r.intent),expectedIntentHash:hash(r.intent),plan:displayPlan(r,state.s),phase:r.phase,mappingPresent:state.mappingPresent,sourceComplete:state.sourceComplete,canResume:r.phase!=='completed',message:r.phase==='completed'?'語形対応と承認済み出典を確認しました．公開反映はしていません．':'同じ承認内容を保持しています．再登録せず，両方の保存結果を照合して再開してください．'};
  }catch(e){return{status:'blocked',code:e.code,message:e.message,canResume:false};}}
 function previewPlan(id,choice){const old=record();check(!old||old.phase==='completed','alias_existing_intent','保存済みの語形作業があります．同じ作業を照合してください．');const p=plan(id,choice);return {...clone(p),previewId:hash([book().getId(),id,p])};}
 function register(id,choice,previewId,confirmed){check(confirmed===true,'alias_confirmation','表示された語形・検索対象・出典差分を確認してください．');return locked(()=>{
   const old=record();if(old&&old.intent.observation===id&&old.intent.previewId===previewId)return status(id);
   check(!old||old.phase==='completed','alias_existing_intent','保存済みの別操作があります．');
   const p=plan(id,choice);check(typeof previewId==='string'&&previewId===hash([book().getId(),id,p]),'alias_stale','確認後に登録先・出典・既存対応が変わりました．再確認してください．');
   check(!p.blocked,'alias_mapping_conflict',p.reason);if(p.duplicate)return{status:'already_present',message:p.reason};
   const operationId=Utilities.getUuid(),intent={operationId,previewId,book:book().getId(),observation:id,plan:compactPlan(p),mapping:[p.headword,p.term,p.mappingCategory,'対象','対象','本人確認済み [[yut40-alias:'+operationId+']]']};
   const r={schema:2,intent,phase:'prepared'};save(r);return advance(r);
  });}
 return {preview:previewPlan,register,status,assertNoPending:()=>{const r=record();check(!r||r.phase==='completed','alias_existing_intent','保存済みの語形作業が途中です．同じ作業を確認してください．');return true;},resume:(id,operationId,confirmed,expectedIntentHash)=>{check(confirmed===true,'alias_confirmation','保存済みの同じ承認内容で再開することを確認してください．');return locked(()=>{const r=record();check(r&&r.intent.observation===id&&r.intent.operationId===operationId,'alias_operation','照合する語形作業が一致しません．');check(typeof expectedIntentHash==='string'&&expectedIntentHash===hash(r.intent),'alias_intent_changed','表示後に保存済み承認内容が変わりました．再開せず確認してください．');return advance(r);});}};
}

function singleOperatorAliasAssertNoPending_(){return createSingleOperatorAlias_().assertNoPending();}

// Thin bound-Sheet RPCs; all mutation checks and locking stay in the alias writer.
function singleOperatorAliasPreview(id, choice) {
  return createSingleOperatorAlias_().preview(id, choice);
}
function singleOperatorAliasRegister(id, choice, previewId, confirmed) {
  return createSingleOperatorAlias_().register(id, choice, previewId, confirmed);
}
function singleOperatorAliasResume(id, operationId, expectedIntentHash, confirmed) {
  if (typeof expectedIntentHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedIntentHash)) throw new Error('表示時の語形作業を確認できません．保存状態を読み直してください．');
  return createSingleOperatorAlias_().resume(id, operationId, confirmed, expectedIntentHash);
}

// Isolated judgment front-end. Existing records/locks remain the only persistence.
var singleOperatorJudgmentExpected_ = null;
function singleOperatorJudgmentError_(code) { const e=new Error('判定の状態が変わったか，作業が開始済みです．保存状態を確認してください．');e.code=code;throw e; }
function singleOperatorJudgmentView_(id) { return singleOperatorIntake_.view(id); }
function singleOperatorJudgmentScope_(id, view) {
  const v=view||singleOperatorJudgmentView_(id);
  const stored=rowCompletionStored_(),jobs=stored?[stored.job,stored.job&&stored.job.heldIntake&&stored.job.heldIntake.job].filter(Boolean):[];
  if(jobs.some(j=>j.intake&&(j.intake.observationId===id||normalizeObservedTerm(j.intake.plan&&j.intake.plan.de)===normalizeObservedTerm(v.observation[1]))))singleOperatorJudgmentError_('judgment_work_started');
  if(['work_record_missing','dispatch_unknown','api_unknown'].includes(v.state.code))singleOperatorJudgmentError_('judgment_work_unknown');
  if(v.job||v.entry||v.legacy||v.observation[8]==='候補移送済み')singleOperatorJudgmentError_('judgment_work_started');
  const a=createSingleOperatorAlias_().status(id);
  if(a.status!=='idle'&&a.code!=='alias_pending_other')singleOperatorJudgmentError_('judgment_alias_started');
  if(v.review)yut40AssertLegacyReviewMemo_(v.review[13]);
  return v;
}
function singleOperatorJudgmentCheckExpected_(id,v) {
  const e=singleOperatorJudgmentExpected_;
  if(e&&(e.id!==id||e.snapshot!==v.snapshot))singleOperatorJudgmentError_('judgment_stale');
}
function singleOperatorJudgmentCandidates_(book,o) {
  const notes=book.getSheetByName(EXPERIMENTAL_NOTES_SHEET_NAME);
  if(!notes)singleOperatorJudgmentError_('judgment_notes_missing');
  return {context:jevCandidateContext(book,o),candidates:jevCandidateHeadwords(readSheetRows(notes,3),String(o[1]||''))};
}
function singleOperatorJudgmentContext_(book,view) {
  const current=jevCandidateContext(book,view.observation),saved=view.review&&view.review[2]!==null&&view.review[2]!==undefined?String(view.review[2]):'';
  const same=!saved||[current,jevCandidateSheetText(current),sheetLiteralValue_(current)].includes(saved);
  return {context:saved?(same?current:saved):current,currentContext:current,contextSource:saved?'saved':'current',contextChanged:!same};
}
function singleOperatorJudgmentAssertContext_(id,view) {
  const c=singleOperatorJudgmentContext_(rowCompletionBook_(),view||singleOperatorJudgmentView_(id));
  if(c.contextChanged){const e=new Error('保存されたJev原文と現在の原文が一致しません．助言は保存原文に対するものです．再送せず記録を確認してください．');e.code='judgment_context_changed';throw e;}
  return c;
}
function singleOperatorJudgmentState_(id,view) {
  const out={schema:1,status:'blocked',canRun:false,canSave:false,reason:'保存記録を確認してください．',context:'',currentContext:'',contextSource:'current',contextChanged:false,candidates:[],reviewHash:null};
  try {
    const book=rowCompletionBook_(),v=view||singleOperatorJudgmentView_(id),context=singleOperatorJudgmentContext_(book,v);
    Object.assign(out,context);
    if(context.contextChanged){out.reason='保存されたJev原文と現在の原文が一致しません．保存原文の助言を保持し，訂正・登録・再送は停止しています．';return out;}
    singleOperatorJudgmentScope_(id,v);
    const info=singleOperatorJudgmentCandidates_(book,v.observation);out.candidates=info.candidates;
    if(v.review){const records=maintenanceLedgerData_(book).filter(r=>r.kind==='review'&&String(r.id)===String(v.review[0]));if(records.length!==1)return out;out.reviewHash=records[0].hash;if(v.review[4]!=='Jev'||v.review[5]!=='ADVISORY'||v.observation[8]!=='Jev判定済み')return out;out.status='review';out.canSave=true;out.reason='助言を確認し，採否・分類・対応先を本人が保存してください．';return out;}
    if(v.observation[8]!=='未判定'||v.observation[9]||!info.context)return out;
    const obs=requireSheetWithHeaders(book,UNREGISTERED_RESULT_TERM_SHEET_NAME,UNREGISTERED_RESULT_TERM_HEADERS),reviews=requireSheetWithHeaders(book,JEV_REVIEW_SHEET_NAME,JEV_REVIEW_HEADERS),key=normalizeObservedTerm(v.observation[1]);
    if(!key||readSheetRows(obs,11).some(r=>r[0]!==id&&normalizeObservedTerm(r[1])===key&&r[8]==='Jev判定待ち')||readSheetRows(reviews,15).some(r=>r[4]==='Jev'&&r[5]==='ADVISORY'&&normalizeObservedTerm(r[3])===key))return out;
    out.status='ready';out.canRun=true;out.reason='表示した文脈・候補をJevへ送信します．課金確認が必要です．';return out;
  } catch(_) { return out; }
}
function singleOperatorJudgmentBeforeJev_(observation,request) {
  const book=rowCompletionBook_(),id=String(observation[0]),v=singleOperatorJudgmentScope_(id);
  singleOperatorJudgmentCheckExpected_(id,v);
  if(!singleOperatorJudgmentState_(id,v).canRun)singleOperatorJudgmentError_('judgment_not_ready');
  if(JSON.stringify([0,1,2,6,8,9,10].map(i=>v.observation[i]))!==JSON.stringify([0,1,2,6,8,9,10].map(i=>observation[i])))singleOperatorJudgmentError_('judgment_changed');
  const fresh=singleOperatorJudgmentCandidates_(book,v.observation);
  if(rowCompletionHash_(buildJevCandidateRequest(String(v.observation[1]).normalize('NFC').trim(),fresh.context,fresh.candidates))!==rowCompletionHash_(request))singleOperatorJudgmentError_('judgment_request_changed');
}
function singleOperatorJudgmentReviewGuard_(reviewId) {
  const book=rowCompletionBook_(),sheet=requireSheetWithHeaders(book,UNREGISTERED_RESULT_TERM_SHEET_NAME,UNREGISTERED_RESULT_TERM_HEADERS),matches=readSheetRows(sheet,11).filter(r=>String(r[9])===String(reviewId));
  if(matches.length>1)singleOperatorJudgmentError_('judgment_ambiguous');
  if(!matches.length){if(singleOperatorJudgmentExpected_)singleOperatorJudgmentError_('judgment_unlinked');return;}
  const id=String(matches[0][0]),v=singleOperatorJudgmentScope_(id);singleOperatorJudgmentCheckExpected_(id,v);
  if(!singleOperatorJudgmentState_(id,v).canSave)singleOperatorJudgmentError_('judgment_not_editable');
}
function singleOperatorJudgmentLocate_(sheet,original) {
  const rows=readSheetRows(sheet,11),matches=rows.map((r,i)=>({row:r,number:i+2})).filter(x=>String(x.row[0])===String(original[0]));
  if(matches.length!==1)return null;const f=matches[0];
  return f.row[8]==='Jev判定待ち'&&!f.row[9]&&[1,2,6,10].every(i=>String(f.row[i])===String(original[i]))?f:null;
}
function singleOperatorJudgmentLinkPaid_(sheet,original,reviewId) {
  const f=singleOperatorJudgmentLocate_(sheet,original);
  if(!f)singleOperatorJudgmentError_('judgment_paid_review_unlinked');
  sheet.getRange(f.number,9,1,3).setValues([['Jev判定済み',reviewId,'']]);
}
function singleOperatorJudgmentFailed_(sheet,original) {
  const lock=LockService.getScriptLock();if(!lock.tryLock(10000))return;
  try {const f=singleOperatorJudgmentLocate_(sheet,original);if(f)sheet.getRange(f.number,11).setValue('Jev呼出しの結果は未確認です．再送せず利用状況と判定記録を確認してください．');}catch(_){}finally{lock.releaseLock();}
}
function singleOperatorJudgmentExecute_(id,snapshot,confirmed,action) {
  if(confirmed!==true||typeof snapshot!=='string'||!/^[a-f0-9]{64}$/.test(snapshot))singleOperatorJudgmentError_('judgment_confirmation');
  rowCompletionBook_();if(singleOperatorJudgmentExpected_)singleOperatorJudgmentError_('judgment_busy');
  singleOperatorJudgmentExpected_={id:id,snapshot:snapshot};
  try{const v=singleOperatorJudgmentScope_(id);singleOperatorJudgmentCheckExpected_(id,v);action(v);return singleOperatorIntakeView(id);}finally{singleOperatorJudgmentExpected_=null;}
}
function singleOperatorIntakeRunJev(id,expectedSnapshot,confirmed) {
  return singleOperatorJudgmentExecute_(id,expectedSnapshot,confirmed,function(v){
    if(!singleOperatorJudgmentState_(id,v).canRun)singleOperatorJudgmentError_('judgment_not_ready');
    const sheet=requireSheetWithHeaders(rowCompletionBook_(),UNREGISTERED_RESULT_TERM_SHEET_NAME,UNREGISTERED_RESULT_TERM_HEADERS),f=candidateWizardFindLinked(sheet,11,id);
    if(!f)singleOperatorJudgmentError_('judgment_missing');singleOperatorJudgmentOriginalJev_(f.rowNumber,id,true);
  });
}
function singleOperatorIntakeSaveReview(id,expectedSnapshot,fields,confirmed) {
  return singleOperatorJudgmentExecute_(id,expectedSnapshot,confirmed,function(v){
    if(!fields||JSON.stringify(Object.keys(fields).sort())!==JSON.stringify(['category','decision','headword','memo'])||Object.keys(fields).some(k=>typeof fields[k]!=='string'))singleOperatorJudgmentError_('judgment_fields');
    const s=singleOperatorJudgmentState_(id,v);if(!s.canSave)singleOperatorJudgmentError_('judgment_not_editable');
    maintenanceLedgerSaveReview(v.review[0],s.reviewHash,fields.decision,fields.category,fields.headword,fields.memo);
  });
}

// Retire hashless/legacy action entrypoints on every server execution.
var singleOperatorJudgmentOriginalJev_ = createJevReviewForObservation;
createJevReviewForObservation = function(){singleOperatorJudgmentError_('legacy_retired');};
candidateWizardSaveReview = function(){singleOperatorJudgmentError_('legacy_retired');};
