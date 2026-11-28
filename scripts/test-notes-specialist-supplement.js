const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const files = ['src/direct_maintenance_notes.js','src/notes_specialist_supplement.js'];
const first='【補足】\r\n語形の説明が不足している．\r\n\r\n【音楽用語としての訳例】\r\nSYNTHETIC_CONTEXT_PRIVATE\r\n\r\n【参考資料】\r\nhttps://example.invalid/a.pdf#page=3';
const english='【Additional notes】\nAn old explanation.\n\n【References】\nhttps://example.invalid/en.pdf';
const payload={ja:'複数与格である．',en:'Dative plural.',review:''};
const entry={row:7,de:'Teller',ja:first,en:english,signature:'v1',source:'INTERNAL_SOURCE_SENTINEL'};
const ref={row:7,de:'Teller',signature:'v1'};
let calls=[], unlocks=0, selects=0, shift=false, ready=false, data=payload, refusedDelete=false, missingEn=false;
let writes=0, reverse=false, protectedCell=false, linked=false, stored;
const styleObj={bold:true};
const rich=(text,links=[],styles=[])=>({getText:()=>text,links,styles,
  getRuns:()=>[{getStartIndex:()=>0,getEndIndex:()=>text.length,getTextStyle:()=>styleObj}],
  getLinkUrl:(i)=>linked ? 'https://example.invalid/embedded' : links.find(([a,b])=>i>=a&&i<b)?.[2]||null});
function richBuilder(){
  let text; const links=[],styles=[];
  return {setText(v){text=v;return this;},setLinkUrl(...v){links.push(v);return this;},
    setTextStyle(...v){styles.push(v);return this;},build(){return rich(text,links,styles);}};
}
const both={
  canEdit:()=>!protectedCell,isPartOfMerge:()=>false,getFormulas:()=>[['','']],
  getRichTextValues:()=>[stored],
  setRichTextValues:([v])=>{writes++;stored=v;}
};
const sheet={getRange:(...args)=>{assert.deepEqual(args,[7,2,1,2]);return both;}};
const response=(obj,status=200)=>({getResponseCode:()=>status,getContentText:()=>JSON.stringify(obj)});
const ctx={
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>ready && k==='OPENAI_NOTES_AGENT_KEY'?'sk-'+'a'.repeat(30):null})},
  rowCompletionSelectedEditor:()=>shift && ++selects>1 ? {...entry,signature:'v2'} : missingEn ? {...entry,en:'no supplement'} : entry,
  rowCompletionLock_:fn=>fn(),rowCompletionBook_:()=>({getActiveSheet:()=>sheet}),
  namedSheetColumns_:()=>({positions:reverse?[2,1]:[1,2]}),namedSheetAssertLayout_:()=>{},
  SpreadsheetApp:{flush:()=>{},newRichTextValue:richBuilder},
  LockService:{getUserLock:()=>({tryLock:()=>true,releaseLock:()=>unlocks++})},
  Utilities:{sleep:()=>{},getUuid:()=>'fake-id'},
  UrlFetchApp:{fetch:(url,o)=>{
    calls.push([url,o]); const m=o.method;
    assert.equal(o.followRedirects,false);
    if(m==='post')return response({id:'sess_A'});
    if(m==='delete')return response({deleted:!refusedDelete});
    if(url.includes('/items?'))return response({data:[{type:'message',role:'assistant',phase:'final_answer',status:'completed',turn_id:'turn_1',content:[{type:'output_text',text:JSON.stringify(data)}]}]});
    return response({data:[{id:'turn_1',status:'completed'}]});
  }}
};
vm.createContext(ctx);
const source=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const unconfigured=vm.createContext({PropertiesService:{getScriptProperties:()=>{throw Error('Should not read key without target IDs');}}});
const withTarget=(agent,project)=>source
  .replace(/NOTES_SPECIALIST_AGENT_ = '[^']*'/, `NOTES_SPECIALIST_AGENT_ = '${agent}'`)
  .replace(/NOTES_SPECIALIST_PROJECT_ = '[^']*'/, `NOTES_SPECIALIST_PROJECT_ = '${project}'`);
assert.match(source,/NOTES_SPECIALIST_AGENT_ = 'agent_6b0aa9a273048191a7c20f3101618c07'/);
assert.match(source,/NOTES_SPECIALIST_PROJECT_ = 'proj_V9MgFujKOJm6Z8Shly3xx1xp'/);
vm.runInContext(withTarget('',''),unconfigured);
assert.equal(unconfigured.notesSpecialistKey_(),'');
vm.runInContext(withTarget('agent_test','proj_test'),ctx);
const current={ja:first,en:english};
const tryJa=(override=ref,base=current)=>ctx.directMaintenanceSpecialistSupplement(override,'ja',base,'語形のみ補足．');
assert.equal(ctx.notesSpecialistKey_(),'');
assert.throws(tryJa,/有効になっていません/);
assert.equal(calls.length,0);
ready=true;
assert.throws(()=>tryJa({...ref,row:8}),/開き直/);
assert.throws(()=>tryJa(ref,{ja:first,en:english+'unsaved'}),/開き直/);
missingEn=true;
assert.throws(()=>tryJa(ref,{ja:first,en:'no supplement'}),/日英それぞれ/);
missingEn=false;
assert.equal(calls.length,0);
const draft=tryJa();
assert.equal(draft.drafts.ja,first.replace('語形の説明が不足している．',payload.ja));
assert.equal(draft.drafts.en,english.replace('An old explanation.',payload.en));
assert.match(draft.reply,/確認点/);
assert.equal(calls[0][1].headers['OpenAI-Project'],'proj_test');
const sent=JSON.parse(calls[0][1].payload);
assert.deepEqual(JSON.parse(sent.input.split(' Input: ')[1]),{term:'Teller',language:'ja',supplement:'語形の説明が不足している．',instruction:'語形のみ補足．'});
assert.match(sent.input,/translate that final revision/);
assert.doesNotMatch(sent.input,/An old explanation|SYNTHETIC_CONTEXT_PRIVATE|example\.invalid|INTERNAL_SOURCE_SENTINEL/);
assert.equal(calls.at(-1)[1].method,'delete');
assert.equal(entry.ja,first);
assert.equal(writes,0);
assert.equal(ctx.directMaintenanceSpecialistSupplement(ref,'en',current,'語形のみ補足．').drafts.en,draft.drafts.en);
const sentEn=JSON.parse(calls.filter(([,o])=>o.method==='post').at(-1)[1].payload).input;
assert.equal(JSON.parse(sentEn.split(' Input: ')[1]).supplement,'An old explanation.');
assert.doesNotMatch(sentEn,/語形の説明が不足/);
for(const bad of ['[偽リンク](https://example.invalid/x)','【補足】\n別段落','']){
  data={...payload,en:bad};assert.throws(tryJa);
}
data=payload; shift=true;
assert.throws(tryJa,/開き直/);
shift=false; refusedDelete=true; assert.throws(tryJa,/応答を確認できません/);
assert.equal(unlocks,7);
const offset1=first.indexOf('SYNTHETIC_CONTEXT_PRIVATE'),offset2=english.indexOf('References');
stored=[rich(first,[[offset1,offset1+3,'https://example.invalid/one'],[offset1+3,offset1+6,'https://example.invalid/two']]),
  rich(english,[[offset2,offset2+4,'https://example.invalid/en']])];
assert.throws(()=>ctx.directMaintenanceSpecialistSave({...ref,signature:'stale'},draft.paragraphs),/開き直/);
assert.throws(()=>ctx.directMaintenanceSpecialistSave(ref,{...draft.paragraphs,en:'First.\nSecond.'}),/1段落/);
protectedCell=true;
assert.throws(()=>ctx.directMaintenanceSpecialistSave(ref,draft.paragraphs),/保護/);
protectedCell=false; linked=true;
assert.throws(()=>ctx.directMaintenanceSpecialistSave(ref,draft.paragraphs),/埋め込みリンク/);
linked=false;
assert.equal(writes,0);
assert.equal(ctx.directMaintenanceSpecialistSave(ref,draft.paragraphs).status,'saved');
assert.deepEqual(Array.from(stored,r=>r.getText()),[draft.drafts.ja,draft.drafts.en]);
const newOffset=draft.drafts.ja.indexOf('SYNTHETIC_CONTEXT_PRIVATE');
assert.equal(JSON.stringify(stored[0].links),JSON.stringify([[newOffset,newOffset+3,'https://example.invalid/one'],[newOffset+3,newOffset+6,'https://example.invalid/two']]));
assert.equal(stored[0].styles.length,2);
assert.equal(writes,1);
reverse=true; stored=[rich(english),rich(first)];
assert.equal(ctx.directMaintenanceSpecialistSave(ref,draft.paragraphs).status,'saved');
assert.deepEqual(Array.from(stored,r=>r.getText()),[draft.drafts.en,draft.drafts.ja]);
assert.equal(writes,2);
for (const x of ['【補足】\nhttps://example.invalid','【補足】\n第一段落．\n第二段落．','【補足】\n第一．\n【補足】\n第二．']) assert.equal(ctx.notesSpecialistSelection_(x,'ja'),null);
const timeoutCalls=[];
assert.throws(()=>ctx.notesSpecialistSession_((method,path)=>{
  timeoutCalls.push([method,path]);
  if(path.endsWith('/events')) throw Error('cancel failed');
  if(method==='POST') return {id:'sess_TIMEOUT'};
  if(method==='GET') return {data:[{status:'in_progress'}]};
  assert.equal(method,'DELETE');
},()=>{},'synthetic fixture',1),/TURN_TIMEOUT/);
assert.deepEqual(timeoutCalls.at(-1),['DELETE','/agents/sessions/sess_TIMEOUT']);
const html=fs.readFileSync('src/row_completion_dialog.html','utf8');
assert.match(html,/id="notesChatAsk">AIに相談/);
assert.doesNotMatch(html,/id="notesSpecialistAsk"/);
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
console.log('Notes specialist: no key no call, only permitted supplement sent, links and examples preserved, rejects stale selection and bad output, cleanup required.');
