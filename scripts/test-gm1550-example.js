'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {extractFunction}=require('./test-utils/extract-function');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const images=html=>[...html.matchAll(/<img\b[^>]*data-notation="gm1550-example"[^>]*src="data:image\/svg\+xml,([^"]*)"[^>]*>/g)].map(m=>decodeURIComponent(m[1]));
let checks=0;
for(const language of ['ja','en']){
 const prefix=language==='en'?'en/':'';
 const rows=JSON.parse(read(prefix+'mahler-search-app/data/mahler.json'));
 const row=rows.find(r=>r.data==='M-b1-t1-380-chor&');
 assert.equal(row.de,'Müßte so sein (Herausgebervorschlag)');
 const before=JSON.stringify(row),nodes=[];
 const document={documentElement:{lang:language},getElementById:id=>id==='result-list'?{appendChild:f=>nodes.push(...f.children)}:null,
 createDocumentFragment:()=>({children:[],appendChild(n){this.children.push(n);}}),createElement:()=>({classList:{add(){}},style:{},innerHTML:''})};
 const window={addEventListener(){},appData:{mahler:[row],dic_terms_index:{}},location:{pathname:'/'+prefix+'mahler-search-app/terms_search.html',search:''},aReverseMap:{},aMapping:{},dReverseMap:{},dMapping:{chor:'chor'}};
 const c=vm.createContext({window,document,console,URL,URLSearchParams,setTimeout,clearTimeout,navigator:{userAgent:'test'}});
 vm.runInContext(read(prefix+'mahler-search-app/js/app.js'),c);
 const result=window.formatGmTranslation(row.ja,row),svgs=images(result);
 assert.equal(svgs.length,1,'One approved example after translation');
 assert(result.startsWith(c.escapeHtmlWithBreaks(row.ja)+' '),'Preserve full translated text');
 assert.equal(images(window.linkTermsInTranslation(row.de,{},row)).length,1,'Exactly one example in German source too');
 const svg=svgs[0];
 assert(svg.includes('viewBox="0 0 220 96"'));
 assert(svg.includes('data-pitch="G2"')&&!svg.includes('data-pitch="F2"'));
 assert(svg.includes('cx="136" cy="62" rx="4.6" ry="3.1"'));
 assert(svg.includes('M140 61 V40'));
 assert(svg.includes('M8 62 H212')&&!svg.includes('H131.6'),'Continuous staff remains visible through transparent G2 head');
 assert(svg.includes('data-clef="bass"')&&svg.includes('translate(12 44) scale(.024 -.024)'));
 assert.equal((svg.match(/data-accidental="flat"/g)||[]).length,3);
 for(const pos of ['37 56','45 47','53 59'])assert(svg.includes('translate('+pos+') scale(.024 -.024)'));
 assert(svg.includes('data-rest="half" x="84" y="46.6" width="9" height="3.4"'));
 assert(svg.includes('data-underlay="Und"'));
 assert(svg.includes('M181 38 V62 M185 38 V62'));
 assert(svg.includes('data-time-signature="common"')&&svg.includes('data-glyph="timeSigCommon"'));
 assert(!/fill="white"|<text\b|<script\b|foreignObject|font-family/.test(svg));
 assert(svg.includes('SIL OPEN FONT LICENSE')&&svg.includes('AFFERO GENERAL PUBLIC LICENSE'));
 assert(result.includes('gm-score-example-gm1550'));
 assert(result.includes(language==='en'?'Editorial example:':'編集者提案の譜例：'));
 for(const changed of [{data:'M-b1-t1-381-chor&'},{de:row.de+' changed'},{__row:1550,data:'different'}])assert.equal(images(window.formatGmTranslation(row.ja,{...row,...changed})).length,0);
 assert.equal(images(window.formatGmTranslation(row.ja,{...row,de:row.de.normalize('NFD')})).length,1);
 assert.equal(images(window.formatNotationTranslation(row.ja,row)).length,1,'Dictionary example/shared translation route');
 for(let repeat=0;repeat<3;repeat++)assert.equal(images(window.searchMahlerTermsLocal('muesste',{},'partial')).length,2,'Bundle search');
 const inline=[...read(prefix+'mahler-search-app/terms_search.html').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('Override/Define searchMahlerTermsLocal'));
 vm.runInContext(inline,c);
 for(let repeat=0;repeat<3;repeat++)assert.equal(images(window.searchMahlerTermsLocal('muesste',{},'partial')).length,2,'Actual page search');
 c.results=[{...row,locs:['380'],count:1}];
 vm.runInContext('let currentSearchResults=results,currentSearchIndex=0;const SEARCH_BATCH_SIZE=50;let searchObserver=null;'+extractFunction(read(prefix+'mahler-search-app/mahler.html'),'loadMoreSearchResults')+';loadMoreSearchResults();',c);
 assert.equal(nodes.length,1);assert.equal(images(nodes[0].innerHTML).length,2,'Work/instrument result');
 for(const [data,kind]of [['M-5-3-136-dir&','two'],['M-5-3-283-all&','one']]){
  const existing=rows.find(r=>r.data===data),html=window.formatGmTranslation(existing.ja,existing);
  assert(html.includes('gm-score-example-'+kind));assert.equal(images(html).length,0,'GM358/387 untouched');
 }
 assert.equal(JSON.stringify(row),before,'No canonical data changes');
 assert(/\.gm-music-notation\.gm-score-example-gm1550\s*\{\s*width:\s*13.6em;\s*height:\s*auto;\s*max-width:\s*100%/.test(read(prefix+'mahler-search-app/css/common.css')));
 checks+=38;
}
console.log('GM1550 example: '+checks+' JA/EN geometry, transparency, strict context, repeat search and existing-example checks passed.');
