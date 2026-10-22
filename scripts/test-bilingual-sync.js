'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),os=require('os'),assert=require('assert/strict');
const {root}=require('./sync/core'),bilingual=require('./sync/bilingual');
const headers=['Oper','Aufzug','Szene','page','whom','de','de_normalized','ja','en','whom_en','ja_old','準備状態'];
const tables={
 GM:[['de','de_normalized','ja','en','data','ja_old','準備状態'],['langsam','langsam','ゆっくり','Slowly','M-1-1-10-v1&','PRIVATE_OLD','保留']],
 RW:[headers,['work',1,1,0,'Singer','langsam','langsam','ゆっくり','Slowly','Singer','PRIVATE_OLD','保留'],['work',1,1,' ','Singer','blank page','blank page','非表示','Hidden','Singer','PRIVATE_OLD','保留']],
 RS:[headers,['work','','',210,'','langsam','langsam','ゆっくり','Slowly','','PRIVATE_OLD','承認']],
 Notes:[['de','ja','en','source','ja_old'],['langsam','ゆっくり','Slowly','[GM], [RW], [RS]','PRIVATE_OLD']],
 '語形対応':[['見出し','関連語形','語形区分','用語検索','実例検索','補足'],['langsam','langsamer','比較級','対象','対象','']],
 '略記一覧':[['','',''],['','N.B.','Note']],
 'RS幕構成':[['Oper','Aufzug','Szene','日本語'],['work',1,1,'第1幕']],
 'RW幕構成':[['Oper','Aufzug','Szene','日本語'],['work',1,1,'第1幕']],
 '楽譜情報':[['Oper','Publisher'],['work','音楽之友社']]
};
let reads={},lockReleased=0;
const c=vm.createContext({Logger:{log(){}},SPREADSHEET_ID:'synthetic',CacheService:{getScriptCache:()=>({remove(){}})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>lockReleased++})},SpreadsheetApp:{openById:()=>({getSheetByName:name=>!tables[name]?null:({getDataRange:()=>({getValues:()=>{reads[name]=(reads[name]||0)+1;return tables[name];}})})})}});
for(const f of ['sync_build','dictionary_example_shards','generate_dic_html','export_json'])vm.runInContext(fs.readFileSync(path.join(root,'src',f+'.js'),'utf8'),c);
const exportSnapshot=english=>JSON.parse(JSON.stringify(c.exportAllDataToJson({requestId:'bilingual-fixture',includeEnglish:english})));
const legacy=exportSnapshot(false);reads={};const snapshot=exportSnapshot(true);
assert.deepEqual(snapshot.files,legacy.files,'Japanese output remains byte-equivalent with the optional English envelope');
assert(Object.values(reads).every(n=>n===1));assert.equal(Object.keys(reads).length,9);assert(!JSON.stringify(snapshot.englishSource).includes('PRIVATE_OLD'));
const originalRead=fs.readFileSync,originalWrite=fs.writeFileSync;
let prepared;
try{fs.readFileSync=function(file,...args){assert(!String(file).replaceAll('\\','/').includes('/mahler-search-app/data/'),'No stale local metadata read');return originalRead.call(this,file,...args);};fs.writeFileSync=()=>{throw Error('prepare must not write');};prepared=bilingual.prepare(snapshot,snapshot.requestId);}finally{fs.readFileSync=originalRead;fs.writeFileSync=originalWrite;}
assert.deepEqual(prepared.japanese,snapshot.files);
assert.equal(prepared.english['en/mahler-search-app/data/mahler.json'][0].ja,'Slowly');
assert.equal(prepared.english['en/mahler-search-app/data/richard_wagner.json'].length,1);assert.equal(prepared.english['en/mahler-search-app/data/richard_wagner.json'][0].page,0);
assert.equal(prepared.english['en/mahler-search-app/data/richard_strauss.json'][0].whom,'');
assert.equal(prepared.report.stats.RS.missingTargetEnglish,0);assert.equal(prepared.report.stats.RS.blankTargetRows,1);
assert(!JSON.stringify(prepared.english).includes('PRIVATE_OLD'));assert.equal(prepared.report.untranslated.length,0);
assert.equal(Object.keys(prepared.english).filter(n=>n.includes('/dictionary-examples/')).length,48);
assert(prepared.english['en/index.html'].includes('window.__SITE_LANGUAGE__="en"'));
assert(prepared.english['en/mahler-search-app/dic.html'].includes('lang="en"'));
assert(!prepared.english['en/index.html'].includes('/en/favicon.png'));
assert.equal(typeof prepared.english['en/mahler-search-app/js/app.js'],'string');
const initial=JSON.parse(JSON.stringify(tables));
for(const name of Object.keys(tables))if(name!=='略記一覧')tables[name]=tables[name].map(row=>[...row].reverse());
const reordered=exportSnapshot(true);assert.deepEqual(reordered.files,snapshot.files);assert.deepEqual(reordered.englishSource.tabs,snapshot.englishSource.tabs);assert.deepEqual(reordered.englishSource.termMappings,snapshot.englishSource.termMappings);
Object.assign(tables,initial);
const bad=()=>JSON.parse(JSON.stringify(snapshot));
for(const mutate of [s=>delete s.englishSource,s=>s.englishSource.requestId='wrong',s=>s.englishSource.sourceHash='wrong',s=>s.englishSource.tabs.RS.pop(),s=>s.englishSource.tabs.GM[0].ja='different',s=>s.englishSource.tabs.GM[0].ja_old='private',s=>s.englishSource.termMappings=[]]){const value=bad();mutate(value);assert.throws(()=>bilingual.prepare(value,value.requestId));}
for(const tab of ['GM','RW','RS','Notes']){const row=tables[tab][0],i=row.indexOf('en');row[i]='renamed_en';assert.throws(()=>exportSnapshot(true),/必須列/);assert.doesNotThrow(()=>exportSnapshot(false));row[i]='en';}
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gmt-bilingual-test-'));
try{
 fs.mkdirSync(path.join(directory,'scripts'));const policy=path.join(directory,'scripts','english-publication.json');
 const setPolicy=(publishEnglish,englishReleaseApproved)=>fs.writeFileSync(policy,JSON.stringify({schemaVersion:1,publishEnglish,englishReleaseApproved}));
 setPolicy(false,false);assert.equal(bilingual.refreshStage({root:directory}),null);const closedTicket=bilingual.publicationTicket(directory);
 const result=bilingual.stage(prepared,{root:directory});assert.equal(result.publishedEnglish,false);assert(!fs.existsSync(path.join(directory,'en')));assert(fs.existsSync(path.join(directory,'.sync-state/english/current.json')));assert(!fs.existsSync(path.join(directory,'mahler-search-app')));
 // Rebuild browser templates from the same private capture without another Sheet read.
 fs.mkdirSync(path.join(directory,'src'));for(const name of ['dictionary_example_shards','generate_dic_html'])fs.copyFileSync(path.join(root,'src',name+'.js'),path.join(directory,'src',name+'.js'));
 fs.writeFileSync(path.join(directory,'index.html'),'<html lang="ja"><head></head><body>HOME</body></html>');
 for(const [name,value]of Object.entries(prepared.japanese)){const target=path.join(directory,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,require('./sync/artifacts').formatJson(name,value));}
 assert(bilingual.refreshStage({root:directory}));assert(!fs.existsSync(path.join(directory,'en')));
 const japaneseFile=path.join(directory,'mahler-search-app/data/mahler.json'),japaneseBefore=fs.readFileSync(japaneseFile,'utf8');fs.writeFileSync(japaneseFile,'[]');assert.throws(()=>bilingual.refreshStage({root:directory}),/一致/);fs.writeFileSync(japaneseFile,japaneseBefore);
 const changed={...prepared,english:{...prepared.english,'en/index.html':'tampered'}};assert.throws(()=>bilingual.stage(changed,{root:directory}),/検証後/);
 setPolicy(true,false);assert.throws(()=>bilingual.assertPolicyUnchanged(closedTicket,directory));assert.throws(()=>bilingual.stage(prepared,{root:directory}),/ゲート/);
 setPolicy(true,true);assert.equal(bilingual.stage(prepared,{root:directory}).publishedEnglish,true);assert(fs.existsSync(path.join(directory,'en/mahler-search-app/data/richard_strauss.json')));
 setPolicy(false,false);assert.throws(()=>bilingual.assertPublicTree(directory),/ゲートが閉じ/);
}finally{const resolved=path.resolve(directory);assert(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('gmt-bilingual-test-'));fs.rmSync(resolved,{recursive:true,force:true});}
assert(lockReleased>0);console.log('Bilingual sync: one read per sheet, Japanese compatibility, column reorder, same-input binding, aliases, private staging, publication gates and tamper rejection passed; no Google/Git/publication calls.');

module.exports={snapshot};
