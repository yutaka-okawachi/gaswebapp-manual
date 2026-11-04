'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../src/maintenance_sort.js'),'utf8');let passed=0;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function test(name,run){try{run();passed++;}catch(e){e.message=name+': '+e.message;throw e;}}
function harness(){
 const h={writes:0,sorts:[],props:new Map([['SPREADSHEET_ID','fake']]),fail:'',privateJob:null};
 function sheet(name,header,rows){
  const s={name,rows:[header,...rows].map(values=>({values:values.slice(),formulas:values.map(()=>''),notes:values.map(()=>''),style:values[0]+'-style',validation:values[0]+'-validation'})),editable:true};
  s.getName=()=>name;s.getLastRow=()=>s.rows.length;s.getMaxRows=()=>s.rows.length;s.getMaxColumns=()=>header.length;
  s.getRange=(r,c,n=1,w=1)=>{
   const grid=field=>Array.from({length:n},(_,i)=>s.rows[r+i-1][field].slice(c-1,c+w-1));
   return {getValues:()=>grid('values'),getDisplayValues:()=>grid('values').map(row=>row.map(String)),getNotes:()=>grid('notes'),getFormulas:()=>grid('formulas'),canEdit:()=>s.editable,isPartOfMerge:()=>false,
    clearContent(){h.writes++;for(let i=0;i<n;i++)for(let j=0;j<w;j++){s.rows[r+i-1].values[c+j-1]='';s.rows[r+i-1].formulas[c+j-1]='';}},
    setFormula(formula){h.writes++;s.rows[r-1].formulas[c-1]=formula;},
    setValues(values){h.writes++;for(let i=0;i<n;i++)for(let j=0;j<w;j++)s.rows[r+i-1].values[c+j-1]=values[i][j];},
    sort(spec){assert.equal(r,2);assert.equal(c,1);assert.equal(w,header.length);assert.deepEqual(JSON.parse(JSON.stringify(spec)),{column:1,ascending:true});h.sorts.push(name);if(h.fail===name)throw Error('native sort failed');const sorted=s.rows.slice(1).sort((a,b)=>String(a.values[0]).localeCompare(String(b.values[0])));s.rows=[s.rows[0],...sorted];}
   };
  };return s;
 }
 h.gm=sheet('GM',['de','de_normalized','ja','en','data','history'],[['alpha','alpha','日A','En A','M1','GM!A2'],['zeta','zeta','日Z','En Z','M2','kept'],['alpha','alpha','日A2','En A2','M3','kept2']]);
 h.notes=sheet('Notes',['de','ja','en','source','maintenance_id','publication_state','history','','準備状態'],[['beta','日B','En B','[GM]','id-b','draft','GM!A2','','未確認'],['omega','日O','En O','[GM]','id-o','approved:exact','https://docs.google.com/spreadsheets/d/fake/edit#gid=4&range=A2','','保留']]);
 h.book={getId:()=>'fake',getSheetByName:name=>name==='GM'?h.gm:name==='Notes'?h.notes:(()=>{throw Error('other tab accessed');})(),getSheets(){throw Error('other tabs scanned');},createTextFinder(){throw Error('external references scanned');}};
 const properties={getProperty:k=>h.props.get(k)||null,getKeys:()=>[...h.props.keys()],setProperty(k,v){h.writes++;h.props.set(k,v);},deleteProperty(k){h.writes++;h.props.delete(k);}};
 const c=vm.createContext({Date,JSON,console,MAINTENANCE_SORT_TEST:true,ROW_COMPLETION_PREFIX:'row-completion-v1:',
  PropertiesService:{getScriptProperties:()=>properties},SpreadsheetApp:{getActiveSpreadsheet:()=>h.book,flush(){if(h.gm.rows[1].formulas[1])for(const row of h.gm.rows.slice(1))row.values[1]=String(row.values[0]).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');}},
  rowCompletionHash_:hash,rowCompletionError_:m=>Error(m),rowCompletionLock_:f=>f(),rowCompletionStored_:()=>h.privateJob});
 vm.runInContext(source,c);h.c=c;h.run=()=>c.maintenanceSortRun_();h.array=()=>{h.gm.rows[1].formulas[1]=vm.runInContext('MAINTENANCE_SORT_NORMALIZED',c);};return h;
}
test('both bodies ascend while header, IDs, status, history, styles and validations stay with items',()=>{
 const h=harness(),expected=JSON.parse(JSON.stringify([...h.gm.rows.slice(1),...h.notes.rows.slice(1)]));expected.filter(r=>r.values.length===9).forEach(r=>r.values[8]='承認');const before=JSON.stringify(expected.map(JSON.stringify).sort());h.run();
 assert.deepEqual(h.gm.rows.slice(1).map(r=>r.values[4]),['M1','M3','M2']);assert.deepEqual(h.notes.rows.slice(1).map(r=>r.values[4]),['id-b','id-o']);
 assert.deepEqual(h.notes.rows.slice(1).map(r=>r.values[8]),['承認','承認']);
 assert.equal(JSON.stringify([...h.gm.rows.slice(1),...h.notes.rows.slice(1)].map(JSON.stringify).sort()),before);assert.equal(h.gm.rows[0].values[0],'de');
});
test('the same ARRAYFORMULA returns to B2 and counter formulas remain exact',()=>{
 const h=harness();h.array();const f=h.gm.rows[1].formulas[1];h.gm.rows[0].formulas[5]='=COUNTA(A2:A)';h.notes.rows[0].formulas[6]='=COUNTIF(A2:A,"omega")';h.run();
 assert.equal(h.gm.rows[1].formulas[1],f);assert.deepEqual(h.gm.rows.slice(1).map(r=>r.values[1]),['alpha','alpha','zeta']);assert.equal(h.gm.rows[0].formulas[5],'=COUNTA(A2:A)');assert.equal(h.notes.rows[0].formulas[6],'=COUNTIF(A2:A,"omega")');
});
test('failure restores normalization and holds the exact partial outcome without replay',()=>{
 const h=harness();h.array();h.fail='Notes';assert.throws(h.run,/確認済み：GM/);assert.equal(h.gm.rows[1].formulas[1],vm.runInContext('MAINTENANCE_SORT_NORMALIZED',h.c));
 const n=h.sorts.length;assert.throws(h.run,/結果未確認/);assert.equal(h.sorts.length,n);assert.equal(h.notes.rows[1].values[4],'id-b');
});
test('unknown body formula stops before any mutation',()=>{const h=harness();h.notes.rows[1].formulas[1]='=A2';assert.throws(h.run,/未対応の数式/);assert.equal(h.writes,0);});
test('protection stops before any mutation',()=>{const h=harness();h.notes.editable=false;assert.throws(h.run,/保護/);assert.equal(h.writes,0);});
test('pending work and generation claims survive sorting without blocking or regeneration',()=>{const h=harness();h.privateJob={job:{book:'fake',closed:false,id:'existing-proposal'}};h.props.set('row-completion-v1:claim:existing','existing-proposal');const saved=JSON.stringify(h.privateJob);h.array();h.run();assert.equal(h.sorts.length,2);assert.equal(JSON.stringify(h.privateJob),saved);assert.equal(h.props.get('row-completion-v1:claim:existing'),'existing-proposal');});
test('wrong registered workbook stops before any mutation',()=>{const h=harness();h.props.set('SPREADSHEET_ID','another');assert.throws(h.run,/登録済み/);assert.equal(h.writes,0);});
test('read-only readiness neither writes nor contacts another tab or API',()=>{const h=harness(),r=h.c.maintenanceSortReadiness_();assert.equal(r.status,'ready');assert.equal(h.writes,0);assert.equal(h.sorts.length,0);});
test('preparation approval changes neither publication markers nor blank-heading rows',()=>{
 const h=harness(),blank=JSON.parse(JSON.stringify(h.notes.rows[2]));blank.values[0]='';blank.values[4]='blank-row';blank.values[8]='保留';h.notes.rows.push(blank);h.array();h.run();
 assert.equal(h.notes.rows.find(r=>r.values[4]==='blank-row').values[8],'保留');
 assert.equal(h.notes.rows.find(r=>r.values[4]==='id-b').values[5],'draft');
 assert.equal(h.notes.rows.find(r=>r.values[4]==='id-o').values[5],'approved:exact');
});
test('missing or duplicate preparation headers stop before sorting any tab',()=>{
 for(const mode of ['missing','duplicate']){const h=harness();h.notes.rows[0].values[8]=mode==='missing'?'other':'準備状態';if(mode==='duplicate')h.notes.rows[0].values[7]='準備状態';assert.throws(h.run,/準備状態/);assert.equal(h.writes,0);assert.equal(h.sorts.length,0);}
});
console.log('Simple maintenance sort: '+passed+' scenarios passed. No live Sheets/API writes.');
