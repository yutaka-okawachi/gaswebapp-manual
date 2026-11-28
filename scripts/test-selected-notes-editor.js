'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('AI draft endpoint checks the snapshot and protects existing examples and references', () => {
  const ja = '【補足】\n古い説明．\n\n【参考資料】\n[楽譜](https://example.test/a.pdf#page=4)';
  let requests = 0, proposal = ja.replace('古い説明', '新しい説明');
  const c = vm.createContext({
    directMaintenanceEntry: () => ({de:'Teller',ja,en:'private other language',signature:'revision'}),
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='OPENAI_API_KEY'?'secret':'test-model'})},
    UrlFetchApp:{fetch:(url,config)=>{
      requests++;
      const payload=JSON.parse(config.payload);
      assert.equal(payload.store,false);
      assert.equal(url,'https://api.openai.com/v1/responses');
      const input=JSON.parse(payload.input);
      assert.equal(input.current,ja);
      assert.equal(input.history[0].text,'前の指示');
      assert.ok(!config.payload.includes('private other language'));
      return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({reply:'案だよ．',draft:proposal})}]}]})};
    }},
  });
  vm.runInContext(fs.readFileSync('src/direct_maintenance_notes.js','utf8'),c);
  const edit = rev => c.directMaintenanceChatEdit('Teller',rev,'ja',ja,'補足だけ直して',[{role:'user',text:'前の指示'}]);
  assert.throws(()=>edit('stale'), /変更/);
  assert.equal(requests,0);
  assert.equal(edit('revision').draft,proposal);
  proposal = proposal.replace('page=4','page=5');
  assert.throws(()=>edit('revision'), /用例・参考資料・リンク/);
  proposal = ja.replace('古い説明．',' https://example.test/unknown.pdf 古い説明．');
  assert.throws(()=>edit('revision'), /用例・参考資料・リンク/);
  proposal = ja.replace('古い説明．','<img src=x onerror=bad()>');
  assert.throws(()=>edit('revision'), /用例・参考資料・リンク/);
  assert.equal(requests,4);
});

test('the selected-row UI can discuss, adopt, and then explicitly save; completion stays separate', () => {
  const ids={}, calls=[];
  const html=fs.readFileSync('src/row_completion_dialog.html','utf8');
  function make(){return {textContent:'',value:'',dataset:{},hidden:false,events:{},children:[],appendChild(x){this.children.push(x);},replaceChildren(){this.children=[];},addEventListener(name,cb){this.events[name]=cb;}};}
  for(const match of html.matchAll(/\bid="([^"]+)"/g)) ids[match[1]]=make();
  ids.notesChatLang.value='ja'; ids.notesChatLang.options=[{},{}];
  const run={withSuccessHandler(success){return{withFailureHandler(failure){return new Proxy({},{get:(_,name)=>(...args)=>calls.push({name,args,success,failure})});}}}};
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{
    document:{getElementById:id=>ids[id],createElement:make,querySelectorAll:()=>Object.values(ids)},
    google:{script:{run}},window:{confirm:()=>true},
  });
  const entry={de:'Teller',row:14,ja:'古い説明',en:'',source:'[GM]',signature:'revision',canFill:true};
  assert.equal(calls[0].name,'rowCompletionSelectedEditor');
  calls[0].success(entry);
  assert.equal(ids.notesEditor.hidden,false);
  assert.equal(ids.notesFill.hidden,false);
  ids.notesChatInput.value='補足を変えて';
  ids.notesChatAsk.events.click();
  assert.equal(calls.at(-1).name,'directMaintenanceChatEdit');
  calls.at(-1).success({reply:'短くしたよ',draft:'新しい説明'});
  assert.equal(ids.notesJa.value,'古い説明');
  ids.notesChatInput.value='その案を短く';
  ids.notesChatAsk.events.click();
  assert.equal(calls.at(-1).args[3],'新しい説明');
  calls.at(-1).success({reply:'短くしたよ',draft:'新しい説明'});
  ids.notesChatApply.events.click();
  assert.equal(ids.notesJa.value,'新しい説明');
  assert.equal(calls.length,3);
  ids.notesFill.events.click();
  assert.equal(calls.length,3); // Unsaved edits cannot be discarded by switching.
  ids.notesSave.events.click();
  assert.equal(calls.at(-1).name,'directMaintenanceEdit');
  assert.equal(calls.at(-1).args[2].ja,'新しい説明');
  calls.at(-1).success({status:'saved'});
  calls.at(-1).success({...entry,ja:'新しい説明',signature:'new-revision'});
  ids.notesChatInput.value='さらに短くして';
  ids.notesChatAsk.events.click();
  assert.equal(calls.at(-1).args[5][0].text,'補足を変えて');
  calls.at(-1).success({reply:'短い案',draft:'説明'});
  ids.notesFill.events.click();
  assert.equal(calls.at(-1).name,'rowCompletionPreview');
  assert.equal(calls.at(-1).args[1].signature,'new-revision');
});

test('after a sort the editor does not switch to another headword on save readback', () => {
  const ids={}, calls=[];
  const html=fs.readFileSync('src/row_completion_dialog.html','utf8');
  function make(){return {textContent:'',value:'',dataset:{},hidden:false,events:{},children:[],appendChild(x){this.children.push(x);},replaceChildren(){this.children=[];},addEventListener(name,cb){this.events[name]=cb;}};}
  for(const match of html.matchAll(/\bid="([^"]+)"/g)) ids[match[1]]=make();
  ids.notesChatLang.value='ja'; ids.notesChatLang.options=[{},{}];
  const run={withSuccessHandler(success){return{withFailureHandler(failure){return new Proxy({},{get:(_,name)=>(...args)=>calls.push({name,args,success,failure})});}}}};
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{
    document:{getElementById:id=>ids[id],createElement:make,querySelectorAll:()=>Object.values(ids)},
    google:{script:{run}},window:{confirm:()=>true},
  });
  const entry={de:'Teller',row:14,ja:'古い説明',en:'',source:'[GM]',signature:'revision',canFill:true};
  assert.equal(calls[0].name,'rowCompletionSelectedEditor');
  calls[0].success(entry);
  assert.equal(ids.notesEditor.hidden,false);
  assert.equal(ids.notesFill.hidden,false);
  ids.notesJa.value='保存する案';
  ids.notesSave.events.click();
  calls.at(-1).success({status:'saved',term:'Teller',row:15});
  calls.at(-1).success({...entry,de:'Another',ja:'触らない本文'});
  assert.equal(ids.notesEditor.hidden,true);
  assert.equal(ids.notesJa.value,'保存する案');
  assert.match(ids.message.textContent,/選択行が変わった/);
});
