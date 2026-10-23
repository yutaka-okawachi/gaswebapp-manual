'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {validateGmOriginals}=require('./gm-original-validation');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fixtures=[
 {__row:358,de:'ungefähr so : [Notenbeispiel]',data:'M-5-3-136-dir&'},
 {__row:387,de:'Auch hier die Achtel flüchtig, ungefähr : [Notenbeispiel]',data:'M-5-3-283-all&'},
 {__row:586,de:'Die mit [dachförmigem Akzentzeichen mit Querstrich darunter] bezeichneten Noten länger gehalten.',data:'M-2-5-78-hr&M-2-5-79-ob,cl&'},
 {__row:589,de:'Der Sinn dieser Bezeichnung 𝄐 V ist, den Eintritt ...',data:'M-7-5-196-all&'},
 {__row:2577,de:'𝅘𝅥𝅘𝅥𝅘𝅥 wie früher [Vierteltriole]',data:'M-d-d01-16-all&M-d-d01-92-all&'},
 {__row:2599,de:'𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮 = wie früher [Achteltriole]',data:'M-3-2-50-all&'},
 {__row:2575,de:'𝅘𝅥 wie vorher 付点𝅗𝅥',data:'M-4-3-283-all&'}
];
const normalize=s=>s.toLowerCase().replaceAll('ä','ae').replaceAll('ö','oe').replaceAll('ü','ue').replaceAll('ß','ss');
fixtures.forEach(row=>Object.assign(row,{de_normalized:normalize(row.de),en:'Public English.',ja:'日本語訳',準備状態:'保留'}));
const before=JSON.stringify(fixtures);
assert.equal(validateGmOriginals(fixtures).length,1);
assert.equal(validateGmOriginals(fixtures.slice(0,6)).length,0);
assert.throws(()=>validateGmOriginals([...fixtures,{...fixtures[6]}]),/Japanese text/,'Duplicate exception is rejected');
for(const changed of [{de:'new 日本語'},{de_normalized:'new 日本語'},{data:'M-4-3-284-all&'},{de:'𝅘𝅥 wie vorher 付点𝅗𝅥 changed'}])assert.throws(()=>validateGmOriginals([{...fixtures[6],...changed}]),/Japanese text/);
const svgImages=html=>[...html.matchAll(/<img\b[^>]*src="data:image\/svg\+xml,([^"]*)"[^>]*>/g)].map(match=>decodeURIComponent(match[1]));
let checks=0;
(async()=>{
for(const language of ['ja','en']){
 const window={addEventListener(){},appData:{mahler:fixtures,dic_terms_index:{}},location:{pathname:'/mahler-search-app/terms_search.html',search:''},aReverseMap:{},aMapping:{},dReverseMap:{},dMapping:{hr:'hr',ob:'ob',cl:'cl',all:'all',dir:'dir'}};
 const c=vm.createContext({window,document:{documentElement:{lang:language}},console,URLSearchParams,setTimeout,clearTimeout,navigator:{userAgent:'test'}});
 vm.runInContext(read('mahler-search-app/js/app.js'),c);
 for(const [i,row]of fixtures.entries()){
  const html=window.linkTermsInTranslation(row.de,{},row),svgs=svgImages(html),expected=[0,0,1,1,2,2,0][i];
  assert.equal(svgs.length,expected,'Exact approved symbol count row '+row.__row);
  if(!expected)assert.equal(html,row.de,'Placeholders and GM2575 stay visible verbatim');
  for(const svg of svgs){assert(!/<text\b|<script\b|foreignObject|font-family|𝅘𝅥|𝅘𝅥𝅮|𝄐/.test(svg));assert(svg.includes('viewBox='));}
  if(expected){assert(language==='en'?!/[\p{Script=Han}\p{Script=Hiragana}]/u.test(html):html.includes('alt="'));assert(html.includes('aria-label="'));}
  assert.equal(c.matchesTermQuery(row.de_normalized,normalize(row.de),'partial'),true);
  checks++;
 }
 const quarter=svgImages(window.linkTermsInTranslation(fixtures[4].de,{},fixtures[4]));
 const eighth=svgImages(window.linkTermsInTranslation(fixtures[5].de,{},fixtures[5]));
 for(const svg of quarter.concat(eighth))assert.equal((svg.match(/<ellipse/g)||[]).length,3,'Exactly three note heads per group');
 assert(!quarter[0].includes('M33 3')&&!eighth[0].includes('M33 3'),'Ordinary groups have no 3');
 assert(quarter[1].includes('M33 3')&&eighth[1].includes('M33 3'),'Triplet groups have path-drawn 3');
 assert(!quarter.join('').includes('stroke-width="4"'),'Quarter notes are unbeamed');
 for(const svg of eighth)assert.equal((svg.match(/stroke-width="4"/g)||[]).length,1,'Each eighth group has one beam');
 for(const row of fixtures){
  window.appData.mahler=[row];
  const direct=window.searchMahlerTermsLocal(row.de,{},'partial');
  assert.equal(svgImages(direct).length,[0,0,1,1,2,2,0][fixtures.indexOf(row)],'Shared GM term renderer');
 }
 // Actual page overrides are also used by dictionary example links.
 for(const file of ['mahler-search-app/terms_search.html','mahler-search-app/mahler.html']){
  const page=read(file);
  if(file.includes('terms_search')){
   const inline=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).find(x=>x.includes('Override/Define searchMahlerTermsLocal'));
   vm.runInContext(inline,c);
   for(const row of fixtures){window.appData.mahler=[row];const html=window.searchMahlerTermsLocal(row.de,{},'partial');assert.equal(svgImages(html).length,[0,0,1,1,2,2,0][fixtures.indexOf(row)]);checks++;}
   window.appData.mahler=[fixtures[5]];
   for(const query of ['achtel','3','frueher']){const html=window.searchMahlerTermsLocal(query,{},'partial');for(const svg of svgImages(html))assert(!svg.includes('<span'),'Highlight cannot alter SVG URL');assert(!/<img[^>]*<span/.test(html),'Highlight cannot alter image attributes');checks++;}
  }else {
   const {extractFunction}=require('./test-utils/extract-function');
   const start=page.indexOf('window.searchMahlerDataLocal = async function'),end=page.indexOf('\n    };',start);
   assert(start>=0&&end>start);
   vm.runInContext('const aMapping={};const aReverseMap={};'+page.slice(start,end+7),c);
   window.appData.mahler=fixtures;
   const matched=await window.searchMahlerDataLocal(['ALL'],['ALL_GLOBAL'],true);
   assert.equal(matched.length,7,'All rows including held/excluded row remain searchable');
   matched.forEach((item,i)=>assert.equal(item.data,fixtures[i].data,'Row identity survives result projection'));
   const nodes=[],list={appendChild(fragment){nodes.push(...fragment.children);}};
   c.document.getElementById=id=>id==='result-list'?list:null;
   c.document.createDocumentFragment=()=>({children:[],appendChild(node){this.children.push(node);}});
   c.document.createElement=()=>({classList:{add(){}},style:{},innerHTML:''});
   c.matched=matched;
   vm.runInContext('let currentSearchResults=matched,currentSearchIndex=0;const SEARCH_BATCH_SIZE=50;let searchObserver=null;'+extractFunction(page,'loadMoreSearchResults')+';loadMoreSearchResults();',c);
   assert.equal(nodes.length,7);
   nodes.forEach((node,i)=>assert.equal(svgImages(node.innerHTML).length,[0,0,1,1,2,2,0][i],'Actual lazy-loaded work/instrument DOM'));
   checks+=7;
  }
 }
 const payload='<script>alert(1)</script> '+fixtures[4].de;
 assert(!window.linkTermsInTranslation(payload,{},fixtures[4]).includes('<script>'),'Source text remains escaped');
}
assert.equal(JSON.stringify(fixtures),before,'Canonical source/search/translation/status fields never mutate');
console.log('GM notation: '+checks+' language/search cases; confirmed vector shapes, safe highlighting, exact deferred-source guard, and unchanged canonical fields passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
