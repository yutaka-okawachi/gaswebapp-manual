'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {root}=require('./sync/core'),synopsis=require('./synopsis-links'),bilingual=require('./sync/bilingual');
const base=synopsis.readBaseMetadata(root),byId=new Map();
for(const [work,meta]of Object.entries(base))if(meta.synopsis&&!byId.has(synopsis.pdfId(meta.synopsis)))byId.set(synopsis.pdfId(meta.synopsis),{work,ja:meta.synopsis,en:'https://drive.google.com/file/d/synthetic_english_'+work.replace(/[^a-z]/g,'')+'/view'});
const source={schema:1,rows:[...byId.values()]};assert.equal(source.rows.length,28);
const ja=synopsis.projectMetadata(base,source,'ja'),en=synopsis.projectMetadata(base,source,'en');
assert.deepEqual(ja,base,'Japanese B links preserved');assert.equal(new Set(Object.values(en).map(meta=>meta.synopsis)).size,28);
for(const key of Object.keys(base)){assert(en[key].synopsis);assert.notEqual(synopsis.pdfId(en[key].synopsis),synopsis.pdfId(base[key].synopsis));}
assert.equal(en.hollaender.synopsis,en['holländer'].synopsis);assert.equal(en.tann_paris.synopsis,en.tann_dresden.synopsis);assert.equal(en.walkuere.synopsis,en['walküre'].synopsis);assert.equal(en.goetter.synopsis,en['götter'].synopsis);
const empty={schema:1,rows:source.rows.map(row=>({...row,en:''}))},none=synopsis.projectMetadata(base,empty,'en');
assert(Object.values(none).every(meta=>meta.synopsis===''));
assert(Object.values(synopsis.projectMetadata(base,undefined,'en')).every(meta=>meta.synopsis===''),'Legacy cache never falls back to Japanese PDF in English');
for(const language of ['ja','en'])for(const composer of ['rw','rs']){
 const original=fs.readFileSync(path.join(root,'mahler-search-app/'+composer+'_synopsis.html'),'utf8'),projected=language==='ja'?ja:en;
 const result=synopsis.rewriteList(original,base,projected,language),links=[...result.matchAll(/<a\b[^>]*href="(https:\/\/drive.google.com[^\"]+)"[^>]*data-synopsis-work="([^\"]+)"/g)];
 assert.equal(links.length,composer==='rw'?13:15);for(const [,url,key]of links)assert.equal(url.replaceAll('&amp;','&'),projected[key].synopsis);
 assert.equal(synopsis.rewriteList(result,base,projected,language),result,'Repeated build is stable');
 const missing=synopsis.rewriteList(original,base,none,'en');assert(!missing.includes('<a href="https://drive.google.com'));assert.equal((missing.match(/class="synopsis-unavailable"/g)||[]).length,composer==='rw'?13:15);
}
// A new B URL still binds by stable work/alias, and a second generation keeps the new URL.
const changed=JSON.parse(JSON.stringify(source));changed.rows[0].ja='https://drive.google.com/file/d/changed_japanese/view';
const changedJa=synopsis.projectMetadata(base,changed,'ja'),rw=fs.readFileSync(path.join(root,'mahler-search-app/rw_synopsis.html'),'utf8');
const changedList=synopsis.rewriteList(rw,base,changedJa,'ja');assert(changedList.includes('changed_japanese'));assert.equal(synopsis.rewriteList(changedList,base,changedJa,'ja'),changedList);
for(const mutation of [s=>s.rows.push({...s.rows[0]}),s=>s.rows[0].en=s.rows[0].ja,s=>s.rows[0].en='javascript:alert(1)',s=>s.rows[0].en='https://drive.google.com.evil.test/file/d/x/view',s=>s.rows[0].work='overview',s=>s.rows[0].ja='https://example.test/file.pdf']){const s=JSON.parse(JSON.stringify(source));mutation(s);assert.throws(()=>synopsis.projectMetadata(base,s,'en'));}
// Exercise the real result renderer for every alias and both languages, with no browser/network.
for(const language of ['ja','en'])for(const [key,meta]of Object.entries(language==='ja'?ja:en)){
 const c=vm.createContext({window:{__SITE_LANGUAGE__:language,appData:{dic_terms_index:{}}},normalizeString:s=>String(s).toLowerCase(),hasScorePage:()=>true});
 vm.runInContext(synopsis.metadataScript({[key]:meta}),c);vm.runInContext(fs.readFileSync(path.join(root,'frontend/result-format.js'),'utf8'),c);
 const html=c.formatGenericResults([{Oper:key,page:1,de:'langsam',ja:'Slowly',whom:'','楽譜情報':'Publisher'}]);assert(html.includes(meta.synopsis));assert(!html.includes('Available in Japanese only.'));
}
// Reuse a minimal authenticated same-snapshot fixture for full bilingual generation.
const {snapshot}=require('./test-bilingual-sync');const value=JSON.parse(JSON.stringify(snapshot));value.englishSource.synopsis=source;
const prepared=bilingual.prepare(value,value.requestId);assert.deepEqual(prepared.japanese,value.files);assert(!JSON.stringify(prepared.japanese).includes('synthetic_english'));
for(const composer of ['rw','rs']){const html=prepared.english['en/mahler-search-app/'+composer+'_synopsis.html'];assert(!html.includes('data-japanese-only="synopsis"'));assert(!html.includes('Available in Japanese only.'));assert(html.includes('synthetic_english'));}
assert(prepared.english['en/mahler-search-app/other.html'].includes('data-japanese-only="essay"'));
const changedEnglish=JSON.parse(JSON.stringify(value));changedEnglish.englishSource.synopsis.rows[0].en='https://drive.google.com/file/d/different_english_pdf/view';const second=bilingual.prepare(changedEnglish,value.requestId);
assert.notEqual(second.report.buildHash,prepared.report.buildHash);const version=s=>s.english['en/mahler-search-app/richard_wagner.html'].match(/score_metadata\.js\?v=([a-f0-9]+)/)?.[1];assert(version(prepared));assert.notEqual(version(second),version(prepared),'C-only edits update English script cache key');
const noEnglish=JSON.parse(JSON.stringify(value));noEnglish.englishSource.synopsis=empty;const pending=bilingual.prepare(noEnglish,value.requestId);assert(!pending.english['en/mahler-search-app/rw_synopsis.html'].includes('https://drive.google.com/file/d/'));assert.equal(pending.report.untranslated.length,0);
// The additional tab is read once only for an authenticated bilingual capture; extra columns/rows are ignored.
const tabs={GM:[['de','de_normalized','ja','en','data'],['langsam','langsam','ゆっくり','Slowly','M-1-1-10-v1&']],RW:[['Oper','Aufzug','Szene','page','whom','whom_en','de','de_normalized','ja','en'],['work',1,1,1,'Singer','Singer','langsam','langsam','ゆっくり','Slowly']],RS:[['Oper','Aufzug','Szene','page','whom','whom_en','de','de_normalized','ja','en'],['work',1,1,1,'Singer','Singer','langsam','langsam','ゆっくり','Slowly']],Notes:[['de','ja','en','source'],['langsam','ゆっくり','Slowly','[GM], [RW], [RS]']],'語形対応':[['見出し','関連語形','語形区分','用語検索','実例検索','補足']],'略記一覧':[['','',''],['','N.B.','Note']],'RS幕構成':[['Oper','Aufzug','Szene','日本語'],['work',1,1,'場面']],'RW幕構成':[['Oper','Aufzug','Szene','日本語'],['work',1,1,'場面']],'楽譜情報':[['Oper','Publisher'],['work','Publisher']],synopsis:[['work','Japanese','English','private review'],...source.rows.map(row=>[row.work,row.ja,row.en,'PRIVATE_REVIEW']),['overview','DO_NOT_EXPORT','DO_NOT_EXPORT']]};
let reads={};const c=vm.createContext({SPREADSHEET_ID:'synthetic',Logger:{log(){}},CacheService:{getScriptCache:()=>({remove(){}})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:name=>tabs[name]?{getDataRange:()=>({getValues:()=>{reads[name]=(reads[name]||0)+1;return tabs[name];}})}:null})}});
for(const file of ['sync_build','dictionary_notation','dictionary_example_shards','generate_dic_html','export_json'])vm.runInContext(fs.readFileSync(path.join(root,'src/'+file+'.js'),'utf8'),c);
const captured=JSON.parse(JSON.stringify(c.exportAllDataToJson({requestId:'synopsis-fixture',includeEnglish:true})));assert.equal(reads.synopsis,1);assert.equal(Object.keys(reads).length,10);assert.equal(captured.englishSource.synopsis.rows.length,28);assert(!JSON.stringify(captured.englishSource.synopsis).includes('PRIVATE_REVIEW'));assert(!JSON.stringify(captured.englishSource.synopsis).includes('DO_NOT_EXPORT'));assert(!JSON.stringify(captured.files).includes('synthetic_english'));
reads={};const legacy=c.exportAllDataToJson({requestId:'synopsis-fixture'});assert.equal(reads.synopsis,undefined);assert(!legacy.englishSource);
console.log('Synopsis links: 28 works, aliases, Japanese/English list and result routes, pending/invalid URLs, one-read export, private fields, repeated generation and C-only cache invalidation passed; no Google, browser, telemetry or publication calls.');
