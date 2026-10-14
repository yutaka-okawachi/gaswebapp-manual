'use strict';
// Header permutations use synthetic data and mocked paid responses only.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,'src',n+'.js'),'utf8');
const {extract}=require('./test-source-english-edit-stop');
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const clone=v=>JSON.parse(JSON.stringify(v));
let passed=0;
function test(name,fn){try{fn();passed++;}catch(e){e.message=name+': '+e.message;throw e;}}
function harness(tab,options={}){
  const id='NE-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',props=new Map([['key','mock-key'],['SPREADSHEET_ID','book']]),lines=[],writes=[];
  let now=1800000000000,fetches=0,settled=0,headerRace=false;
  const referenceHeaders=['区分','作品','指示対象（原語）','ユーザー選択案','ユーザー判断','第1案（推奨）','第2案','第3案','推奨理由・判断が難しい点','自由修正（英訳）'];
  const reference=[referenceHeaders,[tab,'Synthetic [work]','使者','第1案','承認','Messenger','','','','']];
  const apiProps={getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)};
  const ledger={getLastRow:()=>lines.length+2,getMaxRows:()=>1000,getRange:(r,c,n=1,w=1)=>({kind:'ledger',row:r,col:c,width:w,getDisplayValues:()=>Array.from({length:n},(_,i)=>[lines[r-3+i]||'']),getFormulas:()=>Array.from({length:n},()=>[''])})};
  let headers=[],values=[],notes=[],formulas=[];
  const sheet={getName:()=>tab,getSheetId:()=>7,getLastRow:()=>2,getMaxColumns:()=>headers.length,getLastColumn:()=>headers.length,
    getRange:(r,c,n=1,w=1)=>({kind:'source',row:r,col:c,width:w,
      getValues:()=>Array.from({length:n},(_,i)=>(r+i===1?headers:values).slice(c-1,c-1+w)),
      getDisplayValues:()=>{const out=Array.from({length:n},(_,i)=>(r+i===1?headers:values).slice(c-1,c-1+w).map(String));if(r===2&&options.readRace&&!headerRace){headerRace=true;permute();}return out;},
      getNotes:()=>Array.from({length:n},(_,i)=>(r+i===1?headers.map(()=>''):notes).slice(c-1,c-1+w)),
      getFormulas:()=>Array.from({length:n},(_,i)=>(r+i===1?headers.map(h=>options.headerFormula&&['en','改訂英訳候補'].includes(h)?'="en"':''):formulas).slice(c-1,c-1+w)),
      setValues:rows=>{rows.forEach((row,i)=>{assert.equal(r+i,2);row.forEach((v,j)=>{writes.push(headers[c+j-1]);values[c+j-1]=v;});});},setValue:v=>{writes.push(headers[c-1]);values[c-1]=v;}})};
  const referenceSheet={getLastRow:()=>5,getMaxColumns:()=>12,getRange:()=>({getDisplayValues:()=>clone(reference),getFormulas:()=>reference.map(()=>Array(10).fill(''))})};
  const selection={getSheet:()=>sheet,getRow:()=>2,getLastRow:()=>2};
  const book={getId:()=> 'book',getActiveRange:()=>selection,getSpreadsheetTimeZone:()=> 'Asia/Tokyo',toast(){},getSheetByName:name=>name==='指示対象英訳確認'?referenceSheet:name===tab?sheet:null};
  class Clock extends Date{constructor(v){super(arguments.length?v:now);}static now(){return now;}}
  const c=vm.createContext({NOTES_ENGLISH_META:'meta',NOTES_ENGLISH_MAX_ROWS:10000,NOTES_ENGLISH_API_KEY:'key',NOTES_ENGLISH_API_FLIGHT:'flight',NOTES_ENGLISH_API_CONFIG:'config',NOTES_ENGLISH_API_MAX_CALLS:100,NOTES_ENGLISH_API_MONTHLY_MICRO:5000000,NOTES_ENGLISH_API_MODEL:'mock',NOTES_ENGLISH_API_OUTPUT:16384,
    Date:Clock,console:{log(){}},notesEnglishHash_:hash,notesEnglishJson_:s=>{try{return JSON.parse(s);}catch(_){return null;}},notesEnglishLock_:f=>f(),
    PropertiesService:{getScriptProperties:()=>apiProps},SpreadsheetApp:{getActiveSpreadsheet:()=>book,flush(){}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}}),getDocumentLock:()=>({tryLock:()=>true,releaseLock(){}})},
    Utilities:{getUuid:()=>crypto.randomUUID(),sleep:ms=>{now+=ms;},formatDate:()=> 'mock-time'},notesEnglishApiConfig_:()=>({tested:true,testedKeyHash:hash('mock-key')}),notesEnglishApiBudget_:()=>({entries:[],total:0}),notesEnglishApiBudgetSave_(){},notesEnglishApiEstimate_:()=>({micro:1}),notesEnglishApiSettle_:()=>{settled++;},
    notesEnglishWrite_:(range,data)=>{if(range.kind==='ledger'){lines[range.row-3]=data[0];return;}assert.equal(range.row,2);assert.equal(range.width,1);writes.push(headers[range.col-1]);values[range.col-1]=data[0];},
    UrlFetchApp:{fetch:()=>{fetches++;if(options.responseMove)permute();if(options.responseRename)headers[headers.indexOf('改訂英訳候補')]='en';if(options.responseAmbiguous){headers.push('en');values.push('do not overwrite');notes.push('');formulas.push('');}return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({status:'completed',output:[{type:'message',status:'completed',content:[{type:'output_text',text:JSON.stringify({status:'candidate',english:'quietly',reason:''})}]}]})};}}
  });
  vm.runInContext(read('sheet_column_layout')+'\n'+read('source_english_workflow')+'\n'+read('source_english_api')+'\n'+extract(read('notes_english_api'),'notesEnglishApiPayload_')+'\n'+extract(read('notes_english_api'),'notesEnglishApiParse_'),c);
  headers=JSON.parse(vm.runInContext('JSON.stringify(SOURCE_SHEET_COLUMN_NAMES.'+tab+')',c));
  const initial={de:'leise',de_normalized:'leise',ja:'静かに',data:'x-a-1-1-vn',source:'[GM]',Oper:'work',Aufzug:'1',Szene:'1',page:'12',whom:'使者',whom_en:'old target','現在の日本語（修正案）':'静かに','修正点':'','改訂英訳候補':'old English','イタリア語の比較':'','根拠・未解決点':'existing evidence','準備状態':'確認待ち'};
  values=headers.map(h=>initial[h]);headers.push('UNRELATED');values.push('keep this cell');notes=headers.map(()=>'');formulas=headers.map(()=>'');
  function permute(){headers.reverse();values.reverse();notes.reverse();formulas.reverse();}
  if(options.padding)for(let i=0;i<options.padding;i++){headers.push('PADDING'+i);values.push('keep padding');notes.push('');formulas.push('');}
  if(options.move)permute();if(options.rename)headers[headers.indexOf('改訂英訳候補')]='en';
  if(options.ambiguous){headers.push(options.rename?'改訂英訳候補':'en');values.push('do not overwrite');notes.push('');formulas.push('');}
  if(options.missing)headers[headers.indexOf('ja')]='renamed_ja';
  if(options.missingEnglish)headers[headers.indexOf('改訂英訳候補')]='English';
  if(options.duplicateEnglish){headers.push(options.rename?'en':'改訂英訳候補');values.push('do not overwrite');notes.push('');formulas.push('');}
  const ctx={book,sheet,ledger,adapter:c.sourceEnglishAdapter_(tab)};
  c.sourceEnglishContext_=()=>ctx;c.sourceEnglishIndex_=()=>({byId:{[id]:2},byRow:{2:id},allIds:{[id]:true}});
  const value=name=>values[headers.indexOf(name)],control=()=>lines.length?JSON.parse(lines[lines.length-1]):null;
  return {c,ctx,sheet,headers,values,initial,writes,props,value,control,counts:()=>({fetches,settled}),run:()=>c.regenerateSourceEnglishSelection(),permute};
}
for(const tab of ['Notes','GM','RW','RS']){
  for(const options of [{move:true},{move:true,rename:true},{responseMove:true},{responseMove:true,responseRename:true}])test(tab+' semantic read/write survives '+JSON.stringify(options),()=>{
    const h=harness(tab,options),r=h.run();assert.equal(r.written,1);assert.equal(h.value(h.headers.includes('en')?'en':'改訂英訳候補'),'quietly');assert.equal(h.value('UNRELATED'),'keep this cell');assert.equal(h.value('de'),'leise');assert.equal(h.value('ja'),'静かに');assert.equal(h.value('現在の日本語（修正案）'),'静かに');assert.equal(h.value('準備状態'),'確認待ち');assert.match(h.value('根拠・未解決点'),/^existing evidence/);
    assert.equal(h.control().reviewed,false);assert.equal(h.counts().fetches,1);assert.ok(h.writes.every(k=>['en','改訂英訳候補','whom_en','根拠・未解決点'].includes(k)));
    if(['RW','RS'].includes(tab)){assert.equal(h.value('whom_en'),'Messenger');assert.equal(h.control().whomStatus,'UPDATED');}
    const state=h.c.showSourceEnglishStatus();assert.equal(state.selectedReason,h.control().reason);const logColumn=h.c.namedSheetColumnLabel_(h.headers.indexOf('根拠・未解決点'));assert.ok(state.message.includes('同じ行の'+logColumn+'列'));assert.equal(state.selectedColumns.english,h.c.namedSheetColumnLabel_(h.headers.indexOf(h.headers.includes('en')?'en':'改訂英訳候補')));if(['RW','RS'].includes(tab))assert.equal(state.selectedColumns.whomEnglish,h.c.namedSheetColumnLabel_(h.headers.indexOf('whom_en')));
  });
  for(const options of [{move:true,ambiguous:true},{move:true,rename:true,ambiguous:true},{missing:true},{readRace:true},{move:true,duplicateEnglish:true},{move:true,rename:true,duplicateEnglish:true},{missingEnglish:true},{move:true,rename:true,headerFormula:true}])test(tab+' invalid/moving header stops before paid request '+JSON.stringify(options),()=>{const h=harness(tab,options);assert.throws(()=>h.run(),/見出し|列構成/);assert.equal(h.counts().fetches,0);assert.deepEqual(h.writes,[]);});
  test(tab+' header ambiguity after response preserves cells and flight',()=>{const h=harness(tab,{responseAmbiguous:true});assert.throws(()=>h.run(),/見出し/);assert.equal(h.counts().fetches,1);assert.deepEqual(h.writes,[]);assert.ok(h.props.get('flight'));});
  test(tab+' permutation and en rename preserve existing input hash',()=>{const h=harness(tab),a=h.c.sourceEnglishSnapshot_(h.ctx,2);h.permute();h.headers[h.headers.indexOf('改訂英訳候補')]='en';const b=h.c.sourceEnglishSnapshot_(h.ctx,2);assert.equal(a.inputHash,b.inputHash);assert.equal(a.sourceHash,b.sourceHash);assert.deepEqual(Array.from(a.values),Array.from(b.values));});
}
test('Notes moved draft edit invalidates only the existing row without dispatch',()=>{const h=harness('Notes',{move:true,rename:true}),flags=[];h.c.sourceEnglishCapture_=(ctx,controls,index,row,options)=>flags.push({row,...options});const col=h.headers.indexOf('現在の日本語（修正案）')+1;const range={getSheet:()=>h.sheet,getRow:()=>2,getLastRow:()=>2,getColumn:()=>col,getLastColumn:()=>col};assert.equal(h.c.sourceEnglishEdited_({range,source:h.ctx.book}),true);assert.deepEqual(flags,[{row:2,draftEdit:true,cancel:false,explicit:false}]);assert.equal(h.counts().fetches,0);});
test('Notes public field writes preserve en and review cells after reordering',()=>{const h=harness('Notes',{move:true,rename:true});h.c.namedSheetWriteRows_(h.sheet,['de','ja','source'],2,[['neu','新訳','[RW: Oper]']]);assert.equal(h.value('de'),'neu');assert.equal(h.value('ja'),'新訳');assert.equal(h.value('source'),'[RW: Oper]');assert.equal(h.value('en'),'old English');assert.equal(h.value('根拠・未解決点'),'existing evidence');assert.equal(h.value('UNRELATED'),'keep this cell');});
test('legacy Notes snapshots and review source lookup follow the same meaning order',()=>{const h=harness('Notes',{move:true,rename:true});vm.runInContext(read('notes_english_workflow')+'\n'+read('english_translation_review'),h.c);h.c.notesEnglishHash_=hash;const s=h.c.notesEnglishSnapshot_(h.sheet,2);assert.equal(s.values[0],'leise');assert.equal(s.values[2],'[GM]');assert.equal(s.values[5],'old English');const sources=h.c.englishReviewSources_(h.ctx.book,['Notes']);assert.equal(sources.Notes.byRow[2].row[0],'leise');assert.equal(sources.Notes.byRow[2].row[1],'静かに');});
for(const mode of ['moved source','unrelated column','ambiguous header'])test('legacy Notes edit: '+mode,()=>{
  const h=harness('Notes',{move:true,rename:true,padding:12}),observed=[];
  vm.runInContext(read('notes_english_workflow'),h.c);
  h.c.notesEnglishOwns_=()=>true;h.c.legacyEnglishBindingsRetired_=()=>false;h.c.sourceEnglishDirect_=()=>false;
  h.c.notesEnglishLock_=fn=>fn();h.c.notesEnglishContext_=()=>({...h.ctx,config:{phase:'ACTIVE'}});
  h.c.notesEnglishIndex_=()=>({byRow:{2:'existing-id'}});h.c.notesEnglishRecords_=()=>[];h.c.notesEnglishObserve_=(ctx,records,index,id,reason)=>observed.push({id,reason});
  const draftName=JSON.parse(vm.runInContext('JSON.stringify(SOURCE_SHEET_COLUMN_NAMES.Notes)',h.c))[3];
  const col=h.headers.indexOf(mode==='unrelated column'?'UNRELATED':draftName)+1;assert.ok(col>9);
  if(mode==='ambiguous header'){h.headers.push('en');h.values.push('do not overwrite');}
  const range={getSheet:()=>h.sheet,getRow:()=>2,getLastRow:()=>2,getColumn:()=>col,getLastColumn:()=>col};
  assert.equal(h.c.notesEnglishEdited_({range,source:h.ctx.book}),true);
  assert.deepEqual(observed,mode==='moved source'?[{id:'existing-id',reason:'EDIT'}]:[]);
  assert.equal(h.counts().fetches,0);assert.deepEqual(h.writes,[]);
});
console.log('Source column layout: '+passed+' scenarios passed (no network or production writes).');
