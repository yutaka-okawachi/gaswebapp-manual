'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),{buildEnglishSite}=require('./english-site');
const rsToken='[[score:feuersnot-desk-division]]',noteToken='[[score:hindemith-glockenspiel-fsharp5]]',operaHeaders=['Oper','Aufzug','Szene','page','whom','de','de_normalized','ja','en','whom_en'];
const tables={
 GM:[['de','de_normalized','ja','en','data'],['langsam [[score:mahler-trill-chain]]','langsam [[score:mahler-trill-chain]]','ゆっくり [[score:mahler-trill-chain]]','Slowly [[score:mahler-trill-chain]]','M-2-5-55-dir&']],
 RW:[operaHeaders,['work',1,1,0,'Singer','langsam','langsam','ゆっくり','Slowly','Singer']],
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
const english=buildEnglishSite(root,snapshot.englishSource,{baseFiles:snapshot.files});assert.equal(english.files['mahler-search-app/data/mahler.json'][0].de_normalized,'langsam');assert.equal(english.files['mahler-search-app/data/richard_strauss.json'][0].de_normalized,rs.de_normalized);assert(english.files['mahler-search-app/data/richard_strauss.json'][0].en.includes(rsToken));
for(const html of [snapshot.files['mahler-search-app/dic.html'],english.files['mahler-search-app/dic.html']]){
 assert.equal((html.match(/data-notation="glockenspiel-fsharp5"/g)||[]).length,2,'Same snapshot builds source and translation artwork');
 const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));assert(!JSON.stringify(schemas).includes('[[score:'),'Registry IDs stay out of public structured text');
 assert(html.includes('term-ein-stab-aus-einem-glockenspiel-klang-fis-ebenso-notiert'),'Stable dictionary anchor survives source token placement');
}
assert(Object.values(reads).every(n=>n===1));assert.equal(JSON.stringify(tables),before,'No Sheet fixture mutation');
console.log('Score-token sync: one-read synthetic Notes/GM/RS export, preserved raw tokens, Japanese/English search normalization and etc. compatibility, stable anchors and token-free structured data passed; no network or Sheet writes.');
