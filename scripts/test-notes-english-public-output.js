// Synthetic private Notes columns must not reach any public artifact, HTML or dashboard.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),fixture=path.join(__dirname,'test-export-snapshot.js');
const prefix=fs.readFileSync(fixture,'utf8').split('const first =')[0];
const {sheets,context}=vm.runInNewContext(prefix+';({sheets,context});',{require:createRequire(fixture),__dirname,console});
const cellNotes=Array.from({length:2},()=>Array(15).fill(''));
const range=(r,c,h,w)=>({getValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>sheets.Notes[r+i-1]?.[c+j-1]??'')),getNotes:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>cellNotes[r+i-1]?.[c+j-1]??''))});
const spreadsheet={getSheetByName:name=>sheets[name]?{getName:()=>name,getLastRow:()=>sheets[name].length,getDataRange:()=>({getValues:()=>sheets[name]}),getRange:range}:null};
context.SpreadsheetApp.openById=()=>spreadsheet;context.PropertiesService={getScriptProperties:()=>({getProperty:()=> 'synthetic'})};
vm.runInContext(fs.readFileSync(path.join(root,'src/dashboard_analytics.js'),'utf8'),context);
const snapshot=()=>JSON.parse(JSON.stringify(context.exportAllDataToJson({requestId:'synthetic'}))).files;
const before=snapshot(),html=context.generateDicHtmlFromSpreadsheet(),dashboard=JSON.stringify(context.readDashboardTranslationMap());
sheets.Notes[0].push('draft-ja','change','draft-en','italian','evidence','state');
sheets.Notes[1].push('PRIVATE_DRAFT_D','PRIVATE_CHANGE_E','PRIVATE_AUTOMATIC_F','PRIVATE_G','PRIVATE_H','確認待ち');
cellNotes[1][5]='PRIVATE_F_NOTE';sheets.Notes[1][9]='PRIVATE_J_CHECK';
// RW/RS I (whom_en) and J:O, and GM E:J are review workspace columns.
// Adding candidates must not change existing Japanese search/dictionary output.
for(const [tab,first,last] of [['GM',4,9],['RW',8,14],['RS',8,14]]){
  sheets[tab]=sheets[tab].map(row=>row.slice());
  for(let col=first;col<=last;col++){
    sheets[tab][0][col]='private_'+col;
    sheets[tab][1][col]='PRIVATE_'+tab+'_'+col;
  }
}
assert.deepEqual(snapshot(),before);assert.equal(context.generateDicHtmlFromSpreadsheet(),html);assert.equal(JSON.stringify(context.readDashboardTranslationMap()),dashboard);
assert(!JSON.stringify(snapshot()).includes('PRIVATE_'));assert.equal(Object.keys(before).length,58);
console.log('Notes/GM/RW/RS private candidate columns: all 58 artifacts, direct HTML and dashboard unchanged.');
