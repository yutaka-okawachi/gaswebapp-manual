'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function setup(tab='RS') {
  const make=(de,en)=>({values:{de,ja:'十分に引き延ばして',en,Oper:'guntram',page:'16',whom:'Orchester',data:'3rd movement'},formulas:{},layout:'layout-1'});
  const rows={3:make('Gut ausgehalten','well sustained https://example.invalid/a#page=2'),4:make('Leise','soft')};
  const applied=[], requests=[];
  let sheet, formula=false, richLink=false, rangeList=1, requestedRows=1, mayEdit=true;
  sheet={getName:()=>tab,getSheetId:()=>42,getRange:(r,c)=>({getRichTextValue:()=>({getLinkUrl:()=>richLink?'https://example.invalid/link':null,getRuns:()=>[{}],getTextStyle:()=>({bold:true})}),setRichTextValue:v=>{applied.push([r,c,v]);rows[r].values.en=v.text;}})};
  const range={getSheet:()=>sheet,getNumRows:()=>requestedRows,getRow:()=>3};
  const book={getActiveSheet:()=>sheet,getActiveRange:()=>range,getActiveRangeList:()=>({getRanges:()=>Array(rangeList).fill(range)}),getSheetByName:n=>n===tab?sheet:null};
  const context=vm.createContext({SpreadsheetApp:{flush(){},newRichTextValue:()=>({setText(value){this.text=value;return this;},setTextStyle(style){this.style=style;return this;},build(){return {text:this.text,style:this.style};}})},
    namedSheetColumns_:()=>({positions:[9]}),
    directMaintenanceSelectedEntry:()=>({de:'Notes test'}),
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>({OPENAI_API_KEY:'fixture',OPENAI_DRAFT_MODEL:'fixture-model'})[key]})},
    UrlFetchApp:{fetch:(url,o)=>{const p=JSON.parse(o.payload);requests.push({url,p});const data=JSON.parse(p.input);
      const draft=data.current.replace('well sustained','fully sustained');
      return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({reply:'英訳を調整した．',draft})}]}]})};}},
  });
  vm.runInContext(read('src/row_completion.js')+'\n'+read('src/direct_maintenance_notes.js'),context);
  Object.assign(context,{rowCompletionBook_:()=>book,rowCompletionLock_:fn=>fn(),rowCompletionRead_:(s,n)=>rows[n],rowCompletionWritable_:()=>!formula&&mayEdit,rowCompletionHash_:s=>JSON.stringify(s)});
  return {context,rows,applied,requests,setFormula:v=>{formula=v;},setLink:v=>{richLink=v;},setRangeCount:v=>{rangeList=v;},setRowCount:v=>{requestedRows=v;},setMayEdit:v=>{mayEdit=v;}};
}
for (const tab of ['RS','RW','GM']) test(tab+' draft does not save; accept explicit English-only save',()=>{
  const {context:c,rows,applied,requests}=setup(tab);
  const entry=c.rowCompletionSelectedEditor();assert.equal(entry.tab,tab);assert.equal(entry.canEditEn,true);
  const before=JSON.stringify(rows);
  const proposal=c.rowCompletionCorpusChat(entry,entry.en,'原文に忠実にして．',[]);
  assert.equal(JSON.stringify(rows),before); assert.equal(applied.length,0);
  assert.equal(requests.length,1); assert.equal(requests[0].url,'https://api.openai.com/v1/responses');
  const p=requests[0].p, input=JSON.parse(p.input);
  assert.equal(p.store,false);assert.equal(input.german,'Gut ausgehalten');assert.equal(input.japanese,'十分に引き延ばして');
  assert.equal(input.language,'en'); assert.equal(input.whom,undefined); assert.equal(input.Oper,undefined);
  assert.match(proposal.draft,/fully sustained/);
  assert.equal(c.rowCompletionCorpusSave(entry,proposal.draft).status,'saved');
  assert.deepEqual(applied.map(v=>v.slice(0,2)),[[3,10]]);
  assert.equal(applied[0][2].style.bold,true);
  const expected=JSON.parse(before);expected[3].values.en=proposal.draft;
  assert.deepEqual(rows,expected);
});
test('Rejects stale row, protected cells, formula, formatting, altered URL and blank replacement',()=>{
  const m=setup(),c=m.context,entry=c.rowCompletionSelectedEditor();
  assert.throws(()=>c.rowCompletionCorpusSave(entry,''),/6000/);
  assert.throws(()=>c.rowCompletionCorpusSave(entry,entry.en.replace('page=2','page=3')),/リンク/);
  assert.throws(()=>c.rowCompletionCorpusSave(entry,'=BAD'),/6000/);
  m.setFormula(true); assert.throws(()=>c.rowCompletionCorpusSave(entry,entry.en),/数式/);
  m.setFormula(false);m.setMayEdit(false);assert.throws(()=>c.rowCompletionCorpusSave(entry,entry.en),/保護/);
  m.setMayEdit(true);m.setLink(true); assert.throws(()=>c.rowCompletionCorpusChat(entry,entry.en,'test',[]),/部分書式/);
  m.setLink(false);m.rows[3].values.page='17';assert.throws(()=>c.rowCompletionCorpusSave(entry,entry.en),/行または本文/);
  assert.equal(m.applied.length,0); assert.equal(m.requests.length,0);
});
test('Empty English and multi-row selections stay in blank completion; Notes keeps its entry',()=>{
  const m=setup();m.setRangeCount(2);assert.equal(m.context.rowCompletionSelectedEditor(),null);
  m.setRangeCount(1);m.setRowCount(2);assert.equal(m.context.rowCompletionSelectedEditor(),null);
  m.setRowCount(1);m.rows[3].values.en='';assert.equal(m.context.rowCompletionSelectedEditor(),null);
  assert.equal(setup('Notes').context.rowCompletionSelectedEditor().de,'Notes test');
});
test('Dialog separates proposal, adoption and explicit save',()=>{
  const html=read('src/row_completion_dialog.html');
  assert.match(html,/rowCompletionSelectedEditor/);
  assert.match(html,/rowCompletionCorpusChat/);
  assert.match(html,/notesChatApply[^]*?area\.value = notesProposal\.draft/);
  assert.match(html,/notesSave[^]*?rowCompletionCorpusSave/);
  assert.match(html,/notesJa'\)\.readOnly = corpus/);
});

test('Selected RS dialog displays reference texts and saves only after explicit action',()=>{
  const html=read('src/row_completion_dialog.html'),calls=[],ids={};
  function make(){return {textContent:'',value:'',dataset:{},hidden:false,events:{},children:[],appendChild(x){this.children.push(x);},replaceChildren(){this.children=[];},addEventListener(name,cb){this.events[name]=cb;}};}
  for(const m of html.matchAll(/\bid="([^"]+)"/g)) ids[m[1]]=make();
  ids.notesChatLang.options=[{},{}];
  const run={withSuccessHandler(success){return{withFailureHandler(failure){return new Proxy({},{get:(_,name)=>(...args)=>calls.push({name,args,success,failure})});}}}};
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document:{getElementById:id=>ids[id],createElement:make,querySelectorAll:()=>Object.values(ids)},google:{script:{run}}});
  const entry={tab:'RS',sheetId:42,row:3,de:'Gut ausgehalten',ja:'十分に引き延ばして',en:'well sustained',signature:'abc',location:'guntram / 16 / Orchester',canEditEn:true,canFill:false};
  assert.equal(calls[0].name,'rowCompletionSelectedEditor');calls[0].success(entry);
  assert.equal(ids.notesHeading.textContent,'RS 3行：英訳を編集');
  assert.match(ids.notesSource.textContent,/guntram/);assert.match(ids.corpusOriginal.textContent,/Gut ausgehalten/);
  assert.equal(ids.notesJa.readOnly,true);assert.equal(ids.notesEn.readOnly,false);
  assert.equal(ids.notesChatLang.value,'en');assert.equal(ids.notesChatLang.options[0].disabled,true);
  ids.notesChatInput.value='自然な英語にして';ids.notesChatAsk.events.click();
  assert.equal(calls.at(-1).name,'rowCompletionCorpusChat');
  calls.at(-1).success({reply:'整えた．',draft:'fully sustained'});
  assert.equal(ids.notesEn.value,'well sustained');
  ids.notesChatApply.events.click();assert.equal(ids.notesEn.value,'fully sustained');assert.equal(calls.length,2);
  assert.equal(ids.notesJa.value,'十分に引き延ばして');
  ids.notesSave.events.click();assert.equal(calls.at(-1).name,'rowCompletionCorpusSave');
  assert.equal(calls.at(-1).args[1],'fully sustained');assert.equal(calls.at(-1).args[0].signature,'abc');
  calls.at(-1).success({status:'saved',entry:{...entry,en:'fully sustained',signature:'new'}});
  assert.match(ids.message.textContent,/英訳だけを保存/);
});
