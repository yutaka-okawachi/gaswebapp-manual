'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const urls=['https://grammis.ids-mannheim.de/verbs/view/400210/1','https://dizionari.corriere.it/dizionario_tedesco/Tedesco/A/achten.shtml','https://en.langenscheidt.com/german-english/achten'];
const labels={ja:['IDS grammis：achten auf（注意を向ける）の語義・構文','il Sansoni：achten のイタリア語訳','Langenscheidt：achten の英語訳'],en:['IDS grammis: meaning and syntax of achten auf (pay attention to)','il Sansoni: Italian translations of achten','Langenscheidt: English translations of achten']};
const references=language=>(language==='en'?'References':'参考資料')+'\n'+urls.map((url,i)=>'['+labels[language][i]+']('+url+')').join('\n');
const c=vm.createContext({});for(const name of ['dictionary_notation','generate_dic_html'])vm.runInContext(read('src/'+name+'.js'),c);
const links=html=>[...html.matchAll(/<a\b[^>]*class="dictionary-reference-link"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
const internal=text=>c.linkTermsInTranslation(text,{achten:'term-achten'});
let checks=0;
for(const language of ['ja','en']){
 const html=c.renderDictionaryReferenceText('achten\n'+references(language),internal),found=links(html);assert.equal(found.length,3);assert.equal((html.match(/class="term-link"/g)||[]).length,1,'Internal linking applies to prose only');
 assert.deepEqual(found.map(m=>m[1]),urls);assert.deepEqual(found.map(m=>m[2]),labels[language]);assert.equal((html.match(/<br>/g)||[]).length,4);let depth=0;for(const tag of html.match(/<\/?a\b[^>]*>/g)||[]){if(tag.startsWith('</'))depth--;else{assert.equal(depth,0,'No nested anchors');depth++;}}assert.equal(depth,0,'All anchors close');
 assert.equal((html.match(/rel="noopener noreferrer"/g)||[]).length,3);assert.equal((html.match(/target="_blank"/g)||[]).length,3);assert(html.includes('overflow-wrap:anywhere'));
 const bare=c.renderDictionaryReferenceText('achten '+urls[2],internal);assert.equal(links(bare).length,1);assert.equal((bare.match(/class="term-link"/g)||[]).length,1,'URL path cannot turn into an internal achten link');checks+=10;
}
for(const url of ['http://example.org/path','https://example.org/a_(b_(c))?a=1&b=2#page=31','https://[2001:db8::1]:8443/a','https://example.org/ä']){
 assert(c.isSafeDictionaryReferenceUrl(url));const html=c.renderDictionaryReferenceText('[A & B <C>](%URL%)'.replace('%URL%',url),internal);assert.equal(links(html).length,1);assert(html.includes('A &amp; B &lt;C&gt;'));assert(!html.includes('<C>'));assert.equal(links(html)[0][1],c.escapeHtml(url));checks++;
}
for(const url of ['javascript:alert(1)','data:text/html,<script>x</script>','mailto:a@example.org','//example.org/a','https://user:password@example.org/achten','https://user@example.org/a','https://example.org/\nfoo','https://example.org/\tfoo','https://example.org/%0Afoo','https://example.org/%00','https://example.org/%7f','https://example.org/a\\b','https://example.org/%zz','https://','https://bad..example/a','https://[:::1]/x','https://[:1:2:3:4:5:6:7:8]/x','https://[::1:]/x','https://'+Array(4).fill('a'.repeat(63)).join('.')+'/x','https://example.org:99999/a','https://exa\u0000mple.org/a','https://example.org/\u200bfoo']){
 assert.equal(c.isSafeDictionaryReferenceUrl(url),false,url);const input='[achten]('+url+')',html=c.renderDictionaryReferenceText(input,internal);assert.equal(links(html).length,0,url);assert(!html.includes('class="term-link"'),'Rejected Markdown is protected literal text');assert(!/<script\b/.test(html));checks++;
}
for(const input of ['[achten](https://example.org/path','[](https://example.org/achten)','![achten](https://example.org/a)','[achten](https://example.org/a "title")','<a href="https://example.org/achten">achten</a>','<img src=x onerror=alert(1)>']){
 const html=c.renderDictionaryReferenceText(input,internal);assert.equal(links(html).length,0);assert(!html.includes('class="term-link"'));assert(!/<img\b|<a\b|<script\b/.test(html));checks++;
}
const balanced=c.renderDictionaryReferenceText('（https://example.org/achten_(x)?a=1&b=2#page=31）。',internal);assert.equal(links(balanced)[0][1],'https://example.org/achten_(x)?a=1&amp;b=2#page=31');assert(balanced.endsWith('）。'));
const token='[[score:hindemith-glockenspiel-fsharp5]]',heading='Ein Stab aus einem Glockenspiel (Klang Fis '+token+' , ebenso notiert) ',source='[H: KM1-1]';
for(const language of ['ja','en']){
 const text='Body '+token+'\n'+references(language),html=c.renderDictionaryNotationText(text,heading,source,language,part=>c.renderDictionaryReferenceText(part,c.escapeHtmlWithBreaks));assert.equal(links(html).length,3);assert.equal((html.match(/data-notation="glockenspiel-fsharp5"/g)||[]).length,1);assert(!html.includes('[[score:'));
 const window={addEventListener(){},appData:{dic_notes:[['achten',references(language),'[GM]'],[heading,text,source]],dic_terms_index:{achten:'term-achten'}},location:{pathname:'/mahler-search-app/other.html',search:''}};
 const nodes=[],container={appendChild(n){nodes.push(n);},innerHTML:''},document={documentElement:{lang:language},getElementById:id=>id==='listContainer'?container:null,createElement:()=>({innerHTML:'',style:{},classList:{add(){}},children:[],appendChild(n){this.children.push(n);}})};
 const b=vm.createContext({window,document,URL,URLSearchParams,console,setTimeout,clearTimeout,navigator:{userAgent:'test'}});vm.runInContext(read('mahler-search-app/js/app.js'),b);
 assert.equal(links(window.searchTermsLocal('achten')).length,3,'Real generated search bundle');assert.equal(links(window.searchTermsLocal('Ein Stab')).length,3);b.fixture=window.appData.dic_notes;vm.runInContext('renderDictionaryList(fixture);',b);assert.equal(links(nodes[0].children[1].innerHTML).length,3,'Dynamic Notes dictionary');assert.equal(links(nodes[1].children[1].innerHTML).length,3);
 checks+=7;
}
// Same Notes snapshot -> GAS Japanese dictionary and English dictionary, without Sheet writes.
const headers=['Oper','Aufzug','Szene','page','whom','de','de_normalized','ja','en','whom_en'];
const tables={GM:[['de','de_normalized','ja','en','data'],['langsam','langsam','ゆっくり','Slowly','M-2-1-1-dir&']],RW:[headers,['work',1,1,0,'Singer','langsam','langsam','ゆっくり','Slowly','Singer']],RS:[headers,['feuersnot','','',320,'Orchester','langsam','langsam','ゆっくり','Slowly','Orchestra']],Notes:[['de','ja','en','source'],['achten',references('ja'),references('en'),'[GM]'],[heading,'譜例 '+token+'\n'+references('ja'),'Example '+token+'\n'+references('en'),source]],'語形対応':[['見出し','関連語形','語形区分','用語検索','実例検索','補足']],'略記一覧':[['','',''],['','N.B.','Note']],'RS幕構成':[['Oper','Aufzug','Szene','日本語'],['feuersnot','','','全1幕']],'RW幕構成':[['Oper','Aufzug','Szene','日本語'],['work',1,1,'第1幕']],'楽譜情報':[['Oper','Publisher'],['feuersnot','Adolph Fürstner'],['work','Publisher']]};
const before=JSON.stringify(tables),reads={};
const gas=vm.createContext({Logger:{log(){}},SPREADSHEET_ID:'fixture',CacheService:{getScriptCache:()=>({remove(){}})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:name=>!tables[name]?null:({getDataRange:()=>({getValues:()=>{reads[name]=(reads[name]||0)+1;return tables[name];}})})})}});
for(const name of ['sync_build','dictionary_notation','dictionary_example_shards','generate_dic_html','export_json'])vm.runInContext(read('src/'+name+'.js'),gas);
const snapshot=JSON.parse(JSON.stringify(gas.exportAllDataToJson({requestId:'notes-reference-fixture',includeEnglish:true}))),prepared=require('./sync/bilingual').prepare(snapshot,snapshot.requestId);
for(const html of [prepared.japanese['mahler-search-app/dic.html'],prepared.english['en/mahler-search-app/dic.html']]){assert.equal(links(html).length,6);assert(html.includes('id="term-achten"'));assert(html.includes('term-ein-stab-aus-einem-glockenspiel-klang-fis-ebenso-notiert'));assert.equal((html.match(/data-notation="glockenspiel-fsharp5"/g)||[]).length,2);}
assert.equal(JSON.stringify(tables),before);assert(Object.values(reads).every(n=>n===1));
// All existing anchors and unaffected rows survive an appended reference section.
const notes=JSON.parse(read('mahler-search-app/data/dic_notes.json')),copy=JSON.parse(JSON.stringify(notes)),notesBefore=JSON.stringify(notes);copy.find(r=>r[0]==='achten')[1]+='\n'+references('ja');
const first=c.generateDicListHtml(notes,{achten:'term-achten'},{},null,'ja'),second=c.generateDicListHtml(copy,{achten:'term-achten'},{},null,'ja'),ids=s=>[...s.matchAll(/<div class="row" id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids(first).length,988);assert.deepEqual(ids(first),ids(second));
const split=s=>s.split(/(?=<div class="row" id=)/),a=split(first),b=split(second);assert.equal(a.filter((part,i)=>part!==b[i]).length,1,'Only the edited fixture row changes');assert.equal(JSON.stringify(notes),notesBefore);
console.log('Notes references: '+checks+' safety/JA/EN/bundle cases; portable GAS validation, named/bare link precedence, literal HTML/invalid fallback, fragments/queries, notation, one-read export/bilingual gate and 988 unchanged anchors passed; no Sheet or network writes.');
