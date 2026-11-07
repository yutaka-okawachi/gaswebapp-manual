'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');let reads=0,available=true,configured=true,fail=false;
let rows=[['source','en','de','ja'],
 ['','Remove the mute\nsecond English line','Dämpfer ab','<b>弱音器を外す</b>\n第二候補'],
 ['[GM]','','mäßig',''],
 ['[RS]','Moderately','MÄSSIG','適度に'],
 ['[RW]','Later duplicate','Dämpfer ab','後の重複'],
 ['[GM]','x'.repeat(100),'long','あ'.repeat(100)]];
const c=vm.createContext({Logger:{log(){}},PropertiesService:{getScriptProperties:()=>({getProperty:()=>configured?'fixture':''})},
 SpreadsheetApp:{openById:()=>({getSheetByName:()=>available?{getLastRow:()=>rows.length,getDataRange:()=>({getValues:()=>{reads++;if(fail)throw Error('synthetic read failure');return rows;}})}:null})}});
for(const f of ['notes_registration','dashboard_analytics'])vm.runInContext(fs.readFileSync(path.join(root,'src',f+'.js'),'utf8'),c);
const before=JSON.stringify(rows),plain=v=>JSON.parse(JSON.stringify(v));
let maps=plain(c.readDashboardTranslationMaps_());
assert.equal(reads,1);assert.equal(maps.ja['daempfer ab'],'弱音器を外す');assert.equal(maps.en['daempfer ab'],'Remove the mute');
assert.equal(maps.ja.maessig,'適度に');assert.equal(maps.en.maessig,'Moderately');
assert.equal(maps.ja.long.length,80);assert.equal(maps.en.long.length,80);
assert.equal(JSON.stringify(rows),before);
assert.deepEqual(plain(c.readDashboardTranslationMap()),maps.ja);
assert.deepEqual(plain(c.readDashboardTranslationMap('en')),maps.en);
assert.equal(plain(c.readDashboardTranslationMap('source'))['daempfer ab'],'[RW]');
rows=[['de','ja','source'],['existing','編集した本文','']];
maps=plain(c.readDashboardTranslationMaps_());assert.deepEqual(maps,{ja:{existing:'編集した本文'},en:{}});
rows[1][1]='さらに編集';assert.equal(c.readDashboardTranslationMaps_().ja.existing,'さらに編集');
for(const condition of ['configuration','sheet','empty','failure']){
 configured=condition!=='configuration';available=condition!=='sheet';fail=condition==='failure';
 rows=condition==='empty'?[['de','ja','en','source']]:[['de','ja','en','source'],['a','訳','translation','']];
 assert.deepEqual(plain(c.readDashboardTranslationMaps_()),{ja:{},en:{}},condition);
}
console.log('Dashboard translation reads: one grid for both languages; column order, legacy empty English, duplicate/source-free rows, first-line/80-character rules, direct edits and read failures passed.');

