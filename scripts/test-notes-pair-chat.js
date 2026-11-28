const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ref={row:11,de:'geschliffen',signature:'test'};
const stored={
  ja:'【音楽用語としての訳例】\nGM: 滑らかにつなげて\n\n【補足】\nGMではポルタメントと断定しない．\n\n【参考資料】\nhttps://example.invalid/score.pdf#page=7',
  en:'【Examples in musical contexts】\nGM: Smoothly connected.\n\n【Notes】\nIn Mahler, this does not establish portamento.\n\n【References】\nhttps://example.invalid/en.pdf#page=7'
};
let calls=[], answer={reply:'補足を残し，見出しだけ外す案がある．',mode:'discussion',ja:'',en:''},writes=0;
const rich=text=>({getText:()=>text,getLinkUrl:()=>null});
let sheetValues=[rich(stored.ja),rich(stored.en)];
const range={canEdit:()=>true,isPartOfMerge:()=>false,getFormulas:()=>[['','']],getRichTextValues:()=>[sheetValues],
  setRichTextValues:([v])=>{sheetValues=v;writes++;}};
const ctx={
  notesSpecialistEntry_:r=>{assert.deepEqual(r,ref);return {...stored,...ref};},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'fixture-not-a-real-key'})},
  UrlFetchApp:{fetch:(url,req)=>{assert.equal(url,'https://api.openai.com/v1/responses');calls.push(JSON.parse(req.payload));return {
    getResponseCode:()=>200,getContentText:()=>JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(answer)}]}]})
  };}},
  rowCompletionLock_:fn=>fn(),rowCompletionBook_:()=>({getActiveSheet:()=>({getRange:(...a)=>{assert.deepEqual(a,[11,2,1,2]);return range;}})}),
  namedSheetColumns_:()=>({positions:[1,2]}),namedSheetAssertLayout_:()=>{},SpreadsheetApp:{flush:()=>{}},
  notesExampleRich_:p=>rich(p.text)
};
vm.createContext(ctx);
for(const f of ['src/direct_maintenance_notes.js','src/notes_pair_chat.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const discuss=ctx.directMaintenanceNotesPairChat(ref,'ja',stored,'【補足】って要らないのでは？',[]);
assert.equal(discuss.drafts,null);assert.match(discuss.reply,/見出し/);assert.equal(writes,0);
assert.equal(calls[0].store,false);
assert.doesNotMatch(calls[0].input,/example\.invalid|滑らかにつなげて|Smoothly connected/);
answer={mode:'proposal',reply:'見出しだけ外した．',ja:'⟦N0⟧\nGMではポルタメントと断定しない．\n\n⟦N1⟧',en:'⟦N0⟧\nIn Mahler, this does not establish portamento.\n\n⟦N1⟧'};
const drafts=ctx.directMaintenanceNotesPairChat(ref,'ja',stored,'では見出しなしの日英案を見せて．',[{role:'assistant',text:discuss.reply}]).drafts;
assert.equal(drafts.ja,stored.ja.replace('【補足】\n',''));assert.equal(drafts.en,stored.en.replace('【Notes】\n',''));
assert.equal(writes,0);assert.equal(JSON.parse(calls[1].input).history.length,1);
assert.throws(()=>ctx.directMaintenanceNotesPairSave(ref,{ja:drafts.ja,en:drafts.en.replace('Smoothly connected.','Altered example.')}),/変更されています/);
assert.equal(writes,0);
assert.equal(ctx.directMaintenanceNotesPairSave(ref,drafts).status,'saved');assert.equal(writes,1);
assert.equal(sheetValues[0].getText(),drafts.ja);assert.equal(sheetValues[1].getText(),drafts.en);
assert.throws(()=>ctx.notesPairChatRestore_(ctx.notesPairChatMask_(stored.ja),'ラベルがない'),/保持できない/);
assert.throws(()=>ctx.notesPairChatRestore_(ctx.notesPairChatMask_(stored.ja),answer.ja+'\nhttps://example.invalid/new'),/新しいリンク/);
// Exercise the actual dialog script, including follow-up, adoption and explicit persistence.
class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.events={};this.dataset={};this.value='';this.hidden=false;this.disabled=false;this.options=[{},{}];}
  appendChild(e){this.children.push(e);return e;}
  replaceChildren(){this.children=[];}
  addEventListener(type,fn){this.events[type]=fn;}
  click(){assert(!this.disabled);this.events.click();}
}
const html=fs.readFileSync('src/row_completion_dialog.html','utf8'), ids={};
for(const [all,tag,id] of html.matchAll(/<(\w+)[^>]*id="([^"]+)"/g)) ids[id]=new Element(tag);
ids.notesChatLang.value='ja';
const queue=[], uiCalls=[];
let mockResult=discuss, currentEntry={...ref,...stored,specialistReady:true};
function runner(success,failure) {
  return new Proxy({withSuccessHandler:f=>runner(f,failure),withFailureHandler:f=>runner(success,f)},{
    get(target,k) {
      return k in target?target[k]:(...args)=>queue.push(()=>{
        uiCalls.push({method:k,args});
        if(k==='directMaintenanceNotesPairChat')return success(mockResult);
        if(k==='directMaintenanceNotesPairSave'){currentEntry={...currentEntry,...args[1]};return success({status:'saved'});}
        success(currentEntry);
      });
    }
  });
}
const document={getElementById:id=>ids[id],createElement:tag=>new Element(tag),querySelectorAll:()=>Object.values(ids)};
vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document,google:{script:{run:runner()}}}); queue.shift()();
assert.equal(ids.notesChatAsk.textContent,'AIに相談（日英）'); assert(!ids.notesSpecialistAsk);
ids.notesChatInput.value='【補足】って要らないのでは？';ids.notesChatAsk.click();queue.shift()();
assert(ids.notesPairProposal.hidden);assert.equal(ids.notesJa.value,stored.ja);assert.equal(ids.notesEn.value,stored.en);
mockResult={drafts,reply:'見出しだけ外した．'};ids.notesChatInput.value='では日英案を見せて．';ids.notesChatAsk.click();queue.shift()();
assert.equal(uiCalls.at(-1).args[4].length,2);
assert(!ids.notesPairProposal.hidden);assert.equal(ids.notesPairJa.value,drafts.ja);assert.equal(ids.notesPairEn.value,drafts.en);
ids.notesPairApply.click();assert.equal(queue.length,0);assert.equal(ids.notesJa.value,drafts.ja);assert.equal(ids.notesEn.value,drafts.en);
ids.notesSave.click();queue.shift()();queue.shift()();
assert.equal(uiCalls.filter(x=>x.method==='directMaintenanceNotesPairSave').length,1);
assert.equal(currentEntry.ja,drafts.ja);assert.equal(currentEntry.en,drafts.en);
console.log('Paired discussion, heading removal, protected GM translation and score links, explicit paired save: OK (no real API or sheet writes).');
