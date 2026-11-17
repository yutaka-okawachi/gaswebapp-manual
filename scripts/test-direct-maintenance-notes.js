'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function fixture() {
  const rows = [['source','en','de','ja'], ['[GM]','old EN','alt','旧本文']];
  let calls = 0, writes = 0, released = 0, fail = false;
  const sheet = {
    getDataRange: () => ({getValues: () => rows}), getLastRow: () => rows.length,
    getLastColumn: () => 4, getMaxRows: () => 100,
    getRange: (r,c,n,w) => ({canEdit:()=>true,isPartOfMerge:()=>false,
      setValues: values => {writes++;rows[r-1]=values[0].slice();}})
  };
  const context = {JSON,Array,Object,String,Set,Error,
    directMaintenanceTerm_: t => {if(typeof t!=='string'||!t.trim())throw Error('term');return t.trim();},
    normalizeObservedTerm: t=>String(t).toLowerCase(),
    rowCompletionBook_:()=>({getSheetByName:()=>sheet}),
    maintenanceNotesSource_: (book,term)=>({de:term,source:'[GM]',proof:[]}),
    namedSheetColumns_:()=>({positions:[2,3,1,0]}),
    PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'configured'})},
    rowCompletionNotes_:()=>({}), rowCompletionRequest_:()=>({}),
    rowCompletionNewNotes_:()=>false, rowCompletionNotesFormatHeadings_:(r,f,t)=>t,
    rowCompletionValidateText_:()=>{}, maintenanceNotesLinkAdvisory_:()=>({status:'ready',candidates:[]}),
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},
    SpreadsheetApp:{flush:()=>{}},
    UrlFetchApp:{fetch:()=>{calls++;if(fail)throw Error('offline');return {
      getResponseCode:()=>200,getContentText:()=>JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({ja:'新しい本文',en:'New text'})}]}]})};}}
  };
  vm.createContext(context);
  for(const file of ['notes_registration.js','direct_maintenance_notes.js']) vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context);
  return {context,rows,get calls(){return calls;},get writes(){return writes;},get released(){return released;},set fail(v){fail=v;}};
}
let f=fixture();
let draft=f.context.directMaintenanceDraft('neu');
assert.equal(draft.ja,'新しい本文');assert.equal(draft.en,'New text');assert.equal(draft.linkAdvisory.status,'ready');
assert.equal(f.calls,1);assert.equal(f.writes,0);
let saved=f.context.directMaintenanceNotesSave('neu',{ja:draft.ja,en:'Edited text'});
assert.equal(saved.status,'saved');assert.equal(saved.row,3);assert.equal(f.rows[2][1],'Edited text');assert.equal(f.writes,1);
saved=f.context.directMaintenanceNotesSave('neu',{ja:'overwrite',en:'overwrite'});
assert.equal(saved.status,'existing');assert.equal(f.writes,1);assert.equal(f.rows[2][1],'Edited text');
assert.throws(()=>f.context.directMaintenanceDraft('alt'),/登録済み/);assert.equal(f.calls,1);
assert.throws(()=>f.context.directMaintenanceNotesSave('other',{ja:'=IMPORTXML(1)',en:'valid'}));assert.equal(f.writes,1);
assert.throws(()=>f.context.directMaintenanceNotesSave('other',{ja:'',en:'valid'}));
f=fixture();f.fail=true;assert.throws(()=>f.context.directMaintenanceDraft('neu'),/Notesは変更していません/);
f.fail=false;assert.equal(f.context.directMaintenanceDraft('neu').en,'New text');assert.equal(f.calls,2);assert.equal(f.writes,0);
console.log('direct Notes: draft, editable save, duplicate retry, failure retry and validation passed');
