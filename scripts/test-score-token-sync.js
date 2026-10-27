'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),{buildEnglishSite}=require('./english-site'),bilingual=require('./sync/bilingual');
const rsToken='[[score:feuersnot-desk-division]]',noteToken='[[score:hindemith-glockenspiel-fsharp5]]',operaHeaders=['Oper','Aufzug','Szene','page','whom','de','de_normalized','ja','en','whom_en'];
const tables={
 GM:[['de','de_normalized','ja','en','data'],['langsam [[score:mahler-trill-chain]]','langsam [[score:mahler-trill-chain]]','ゆっくり [[score:mahler-trill-chain]]','Slowly [[score:mahler-trill-chain]]','M-2-5-55-dir&']],
 RW:[operaHeaders,['work',1,1,0,'Singer','langsam [[score:unknown-rw-fixture]]','langsam [[score:unknown-rw-fixture]]','ゆっくり','Slowly','Singer']],
 RS:[operaHeaders,['feuersnot','','',320,'Orchester','vielleicht pultweise derart zu teilen '+rsToken,'vielleicht pultweise derart zu teilen '+rsToken,'プルトごとの分割： '+rsToken,'Division by desk: '+rsToken,'Orchestra']],
 Notes:[['de','ja','en','source'],['Ein Stab aus einem Glockenspiel (Klang Fis'+noteToken+' , ebenso notiert) ','グロッケンシュピールから取り外した音板（実音Fis） '+noteToken,'A bar taken from a glockenspiel (sounding F-sharp). '+noteToken,'[H: KM1-1]']],
 '語形対応':[['見出し','関連語形','語形区分','用語検索','実例検索','補足']],
 '略記一覧':[['','',''],['','N.B.','Note']],
 'RS幕構成':[['Oper','Aufzug','Szene','日本語'],['feuersnot','','','全1幕']],
 'RW幕構成':[['Oper','Aufzug','Szene','日本語'],['work',1,1,'第1幕']],
 '楽譜情報':[['Oper','Publisher'],['feuersnot','Adolph Fürstner'],['work','Publisher']]
};
const before=JSON.stringify(tables),reads={};
const c=vm.createContext({Logger:{log(){}},SPREADSHEET_ID:'fixture-only',CacheService:{getScriptCache:()=>({remove(){}})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:name=>!tables[name]?null:({getDataRange:()=>({getValues:()=>{reads[name]=(reads[name]||0)+1;return tables[name];}})})})}});
for(const file of ['sync_build','dictionary_notation','dictionary_example_shards','generate_dic_html','export_json'])vm.runInContext(read('src/'+file+'.js'),c);
const snapshot=JSON.parse(JSON.stringify(c.exportAllDataToJson({requestId:'score-token-fixture',includeEnglish:true}))),gm=snapshot.files['mahler-search-app/data/mahler.json'][0],rs=snapshot.files['mahler-search-app/data/richard_strauss.json'][0];
assert.equal(gm.de_normalized,'langsam');assert(gm.de.includes('[[score:'));assert(rs.de.includes(rsToken));assert.equal(rs.de_normalized,'vielleicht pultweise derart zu teilen ～ etc.','GAS export preserves the score-provided etc. search form');
// This is the real production gate that the earlier renderer-only fixture omitted.
assert.doesNotThrow(()=>bilingual.validateEnglishSource(snapshot));
for(const [tab,file]of [['GM','mahler'],['RW','richard_wagner'],['RS','richard_strauss']])assert.equal(snapshot.englishSource.tabs[tab][0].de_normalized,snapshot.files['mahler-search-app/data/'+file+'.json'][0].de_normalized,'Envelope and Japanese derived fields agree for '+tab);
const beforePrepare=JSON.stringify(snapshot),prepared=bilingual.prepare(snapshot,snapshot.requestId);
assert.equal(JSON.stringify(snapshot),beforePrepare,'The gate/build does not normalize or mutate an incoming payload');
assert.deepEqual(prepared.japanese,snapshot.files);
for(const [tab,file]of [['GM','mahler'],['RW','richard_wagner'],['RS','richard_strauss']])assert.equal(prepared.english['en/mahler-search-app/data/'+file+'.json'][0].de_normalized,snapshot.files['mahler-search-app/data/'+file+'.json'][0].de_normalized,'Full Japanese/English build keeps token-free search text for '+tab);
const rejected=[['GM','de'],['GM','ja'],['GM','data'],['GM','de_normalized'],['RW','de'],['RW','ja'],['RW','page'],['RW','de_normalized'],['RS','de'],['RS','ja'],['RS','page'],['RS','de_normalized'],['Notes','de'],['Notes','ja'],['Notes','source']];
for(const [tab,key]of rejected){const changed=JSON.parse(JSON.stringify(snapshot));changed.englishSource.tabs[tab][0][key]=String(changed.englishSource.tabs[tab][0][key])+' altered';assert.throws(()=>bilingual.validateEnglishSource(changed),/一致しません/,'Reject altered shared source field '+tab+':'+key);}
const rawNormalized=JSON.parse(JSON.stringify(snapshot));rawNormalized.englishSource.tabs.GM[0].de_normalized+=' [[score:mahler-trill-chain]]';assert.throws(()=>bilingual.validateEnglishSource(rawNormalized),/GM:2:de_normalized/,'Gate remains strict: token-bearing envelope injected after export is rejected');
for(const tab of ['GM','RW','RS','Notes']){const missing=JSON.parse(JSON.stringify(snapshot));missing.englishSource.tabs[tab].pop();assert.throws(()=>bilingual.validateEnglishSource(missing),/元行数/,'Do not weaken row-count checks');}
const english=buildEnglishSite(root,snapshot.englishSource,{baseFiles:snapshot.files});assert.equal(english.files['mahler-search-app/data/mahler.json'][0].de_normalized,'langsam');assert.equal(english.files['mahler-search-app/data/richard_strauss.json'][0].de_normalized,rs.de_normalized);assert(english.files['mahler-search-app/data/richard_strauss.json'][0].en.includes(rsToken));
for(const html of [snapshot.files['mahler-search-app/dic.html'],english.files['mahler-search-app/dic.html']]){
 assert.equal((html.match(/data-notation="glockenspiel-fsharp5"/g)||[]).length,2,'Same snapshot builds source and translation artwork');
 const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));assert(!JSON.stringify(schemas).includes('[[score:'),'Registry IDs stay out of public structured text');
 assert(html.includes('term-ein-stab-aus-einem-glockenspiel-klang-fis-ebenso-notiert'),'Stable dictionary anchor survives source token placement');
}
assert(Object.values(reads).every(n=>n===1));assert.equal(JSON.stringify(tables),before,'No Sheet fixture mutation');
const initial=JSON.parse(before);
const strip=text=>String(text).replace(/\[\[score:[a-z][a-z0-9-]{0,95}\]\]/gi,'').trim();
for(const scenario of ['legacy','partial']){
 Object.assign(tables,JSON.parse(before));for(const key of Object.keys(reads))delete reads[key];
 for(const tab of ['GM','RW','RS','Notes']){
  const headers=tables[tab][0];for(const row of tables[tab].slice(1))for(const column of ['de','de_normalized','ja','en']){
   const index=headers.indexOf(column);if(index<0|| (scenario==='partial'&&!['ja','en'].includes(column)))continue;
   row[index]=tab==='Notes'&&column==='de'?String(row[index]).replace(noteToken,'(の譜例)'):strip(row[index]);
  }
 }
 const originalRows=JSON.stringify(tables),batch=JSON.parse(JSON.stringify(c.exportAllDataToJson({requestId:'score-token-'+scenario,includeEnglish:true})));
 assert.doesNotThrow(()=>bilingual.validateEnglishSource(batch),scenario+' export passes the real row gate');
 const built=bilingual.prepare(batch,batch.requestId);assert.deepEqual(built.japanese,batch.files);assert.equal(JSON.stringify(tables),originalRows,'Export does not change '+scenario+' Sheet rows');assert(Object.values(reads).every(n=>n===1));
 for(const [tab,file]of [['GM','mahler'],['RW','richard_wagner'],['RS','richard_strauss']])assert.equal(batch.englishSource.tabs[tab][0].de_normalized,batch.files['mahler-search-app/data/'+file+'.json'][0].de_normalized,scenario+' aligns '+tab);
}
Object.assign(tables,initial);
const plan=require('./sync/main').plan('Data',['src/export_json.js'],true);assert.equal(plan.deploy,true,'Data mode updates changed GAS source before fresh export');assert.equal(plan.data,true);

console.log('Score-token sync: real bilingual gate/full prepare, 20 tamper/row-count rejections, legacy/token/partial one-read Notes/GM/RW/RS export, preserved raw tokens, Japanese/English search normalization and etc. compatibility, stable anchors and token-free structured data passed; no network or Sheet writes.');
