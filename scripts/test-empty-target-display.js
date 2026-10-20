'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function extract(source,name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);const open=source.indexOf('{',start);let depth=0;for(let i=open;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&!--depth)return source.slice(start,i+1);}throw Error(name);}
const baseRows=[
 {__row:169,Oper:'guntram',Aufzug:2,Szene:1,page:210,whom:'',whom_en:'',de:'Eigenthum des Verlegers für alle Länder.',ja:'Copyright notice.'},
 {__row:664,Oper:'feuersnot',Aufzug:'',Szene:'',page:331,whom:'',whom_en:'',de:'Vollendet am Geburtstage und zur höheren Ehre des „Allmächtigen“!',ja:'Completion note.'},
 {__row:665,Oper:'feuersnot',Aufzug:'',Szene:'',page:331,whom:'',whom_en:'',de:'Ende.',ja:'End.'}
];
let checks=0;
for(const [label,source]of [['frontend',['frontend/search-core.js','frontend/result-format.js','frontend/search.js'].map(read).join('\n')],['bundle',read('mahler-search-app/js/app.js')]]){
 const c=vm.createContext({window:{appData:{dic_terms_index:{}}},console});
 vm.runInContext(['hasScorePage','normalizeString','normalizeTermSearchText','termSearchTextVariants','matchesTermQuery','matchesAnyTermQuery','isTermWordCharacter','parsePageInput','escapeHtml','escapeHtmlWithBreaks','formatGenericResults','searchGenericTermsLocal'].map(n=>extract(source,n)).join('\n'),c);
 c.linkTermsInTranslation=v=>v;c.isDictionaryExampleSearch=()=>false;c.getDictionaryExampleSearchQueries=q=>[q];c.buildTermResolutionNotice=()=>'';c.createTermHighlightRegexForQueries=()=>/THIS_WILL_NOT_MATCH/g;
 for(const row of baseRows)for(const target of ['',undefined,null,' \t\u3000']){
  const item={...row,whom:target};const html=c.formatGenericResults([item]);assert(html.includes('p.'+row.page));assert(html.includes(row.ja));assert(!html.includes('【'));assert(!html.includes('Target translation unavailable'));checks++;
  c.window.appData.richard_strauss=[item];for(const dictionary of [false,true]){c.isDictionaryExampleSearch=()=>dictionary;const meta={};const term=c.searchGenericTermsLocal(row.de,'richard_strauss','RS',meta,'partial');assert.equal(meta.resultCount,1);assert(term.includes('p.'+row.page));assert(term.includes(row.ja));assert(!term.includes('【'));checks++;}
 }
 for(const whom of ['Singer','<Singer>']){const html=c.formatGenericResults([{...baseRows[0],whom}]);assert(html.includes('【'+c.escapeHtml(whom)+'】'));checks++;}
 for(const page of [0,'0'])assert(c.formatGenericResults([{...baseRows[0],page}]).includes('p.0'));
 const start=source.indexOf('window.getGenericTermsListLocal = function');vm.runInContext(source.slice(start,source.indexOf('\n};',start)+3),c);
 c.window.appData.richard_strauss=baseRows;assert.deepEqual(Array.from(c.window.getGenericTermsListLocal('richard_strauss'),r=>r.original),baseRows.map(r=>r.de));checks++;
}
// Example shards keep all three real row shapes even with no target; only page blanks are excluded.
const gas=vm.createContext({});vm.runInContext(read('src/dictionary_example_shards.js'),gas);
const built=gas.buildDictionaryExampleComposerShards(baseRows.map(r=>({...r,de_normalized:r.de.toLowerCase()})),['e'],{requirePage:true});
assert.deepEqual(Array.from(built.shards).flat().map(r=>r.__row).sort((a,b)=>a-b),[169,664,665]);checks++;
console.log('Empty-target display: '+checks+' scenarios passed; RS169/664/665 remain in work/term/example/suggestion data with pages and no target brackets.');
