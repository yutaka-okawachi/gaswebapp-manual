'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {extractFunction}=require('./test-utils/extract-function');
const music=/[\u{1D100}-\u{1D1FF}♩♪♫♬]/u;
const entities=s=>s.replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const visible=html=>entities(html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,''));
const restore=html=>visible(html.replace(/<img\b[^>]*title="([^"]*)"[^>]*>/g,(_,token)=>token));
const kinds=html=>[...html.matchAll(/data-notation="([^"]+)"/g)].map(m=>m[1]);
const expected={338:['short-pause'],570:['half','dotted-quarter'],930:['quarter','half'],965:['half','quarter'],1354:['quarter','half'],2084:['quarter','half'],2590:['half','quarter']};
let symbolRows=0,paths=0;
(async()=>{for(const language of ['ja','en']){
 const prefix=language==='en'?'en/':'',nodes=[];
 const dynamicList={children:[],appendChild(n){this.children.push(n);},innerHTML:''};
 const document={documentElement:{lang:language},getElementById:id=>id==='result-list'?{appendChild:f=>nodes.push(...f.children)}:id==='dictionaryExampleAliasNotice'?{hidden:false}:id==='listContainer'?dynamicList:null,createDocumentFragment:()=>({children:[],appendChild(n){this.children.push(n);}}),createElement:()=>({classList:{add(){}},style:{},innerHTML:'',children:[],appendChild(n){this.children.push(n);}})};
 const window={addEventListener(){},appData:{dic_terms_index:{}},location:{pathname:'/'+prefix+'mahler-search-app/terms_search.html',search:''}};
 const c=vm.createContext({window,document,console,URL,URLSearchParams,setTimeout,clearTimeout,navigator:{userAgent:'test'}});vm.runInContext(read(prefix+'mahler-search-app/js/app.js'),c);
 const all={};for(const [tab,file]of [['GM','mahler'],['RW','richard_wagner'],['RS','richard_strauss']]){
  const rows=JSON.parse(read(prefix+'mahler-search-app/data/'+file+'.json'));all[tab]=rows;const original=JSON.stringify(rows);
  for(const row of rows)for(const field of ['de','ja']){
   const value=String(row[field]||'');if(!music.test(value))continue;
   const html=field==='de'?window.linkTermsInTranslation(value,{},row):window.formatNotationTranslation(value,row);
   assert(!music.test(visible(html)),tab+' leaves a raw music symbol: '+value);
   assert.equal(restore(html),value,'Display conversion preserves every original note/dot/equality/prose character');
   for(const match of html.matchAll(/src="data:image\/svg\+xml,([^"]*)"/g)){const svg=decodeURIComponent(match[1]);assert(!/fill="white"|<text\b|foreignObject|<script\b/.test(svg),'Transparent font-independent notation');}
   symbolRows++;
  }
  assert.equal(JSON.stringify(rows),original,'No dataset mutations');
 }
 const targets=Object.entries(expected).map(([number,expectedKinds])=>{const descriptor=window.MUSIC_NOTATION_CONTEXTS.find(d=>d.tab==='GM'&&d.sourceRow===Number(number));assert(descriptor);const matches=all.GM.filter(r=>r.de===descriptor.de&&r.data===descriptor.data);assert.equal(matches.length,1);return {row:matches[0],expectedKinds};});
 for(const {row,expectedKinds}of targets){
  assert.deepEqual(kinds(window.linkTermsInTranslation(row.de,{},row)),expectedKinds);
  for(const form of ['NFC','NFD'])assert.deepEqual(kinds(window.linkTermsInTranslation(row.de.normalize(form),{},{...row,de:row.de.normalize(form)})),expectedKinds);
  assert.equal(kinds(window.linkTermsInTranslation(row.de,{}, {...row,data:'M-unrelated-location&'})).length,0);
  assert.equal(kinds(window.linkTermsInTranslation(row.de,{}, {...row,de:row.de+' changed'})).length,0);
  window.appData.mahler=[row];window.dMapping={all:'all',sti:'sti',dir:'dir'};const work=row.data.split('-')[1],choice=Object.keys(window.aMapping).find(key=>window.aMapping[key]===work);
  for(const html of [window.searchMahlerTermsLocal(row.de,{},'partial'),window.searchMahlerDataLocal(['ALL'],['ALL_GLOBAL'],true),window.searchMahlerDataLocal([choice],['ALL_GLOBAL'],true)]){assert(!music.test(visible(html)));assert(kinds(html).length>=expectedKinds.length);paths++;}
 }
 const descriptors=window.MUSIC_NOTATION_CONTEXTS;window.MUSIC_NOTATION_CONTEXTS=[...descriptors].reverse().map(d=>({...d,sourceRow:d.sourceRow+1000}));vm.runInContext(read('frontend/music-notation.js'),c);
 for(const {row,expectedKinds}of targets)assert.deepEqual(kinds(window.linkTermsInTranslation(row.de,{},row)),expectedKinds,'Context sorting and provenance renumbering cannot affect rendering');
 window.MUSIC_NOTATION_CONTEXTS=descriptors;
 const page=read(prefix+'mahler-search-app/terms_search.html'),inline=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('Override/Define searchMahlerTermsLocal'));vm.runInContext(inline,c);
 for(const {row}of targets){window.appData.mahler=[row];for(const source of ['', '?source=dictionary_example&q='+encodeURIComponent(row.de)]){window.location.search=source;const html=window.searchMahlerTermsLocal(row.de,{},'partial');assert(!music.test(visible(html)));assert(kinds(html).length);paths++;}}
 window.location.search='';
 const workPage=read(prefix+'mahler-search-app/mahler.html'),start=workPage.indexOf('window.searchMahlerDataLocal = async function'),end=workPage.indexOf('\n    };',start);c.workMapping=window.aMapping;c.workReverse=window.aReverseMap;
 vm.runInContext('const aMapping=workMapping,aReverseMap=workReverse;'+workPage.slice(start,end+7),c);const matched=[];
 for(const {row}of targets){window.appData.mahler=[row];const work=row.data.split('-')[1],choice=Object.keys(window.aMapping).find(key=>window.aMapping[key]===work);matched.push(...await window.searchMahlerDataLocal([choice],['ALL_GLOBAL'],true));}
 c.matched=matched;vm.runInContext('let currentSearchResults=matched,currentSearchIndex=0;const SEARCH_BATCH_SIZE=50;let searchObserver=null;'+extractFunction(workPage,'loadMoreSearchResults')+';loadMoreSearchResults();',c);
 assert.equal(nodes.length,targets.length);for(const node of nodes){assert(!music.test(visible(node.innerHTML)));assert(kinds(node.innerHTML).length);paths++;}
 const notes=JSON.parse(read(prefix+'mahler-search-app/data/dic_notes.json')),note=notes.find(r=>r[0]==='anhalten'),before=JSON.stringify(notes);
 const expectedPauses=language==='en'?['short-pause','short-pause']:['short-pause'];
 const html=c.renderDictionaryNotationText(note[1],note[0],note[2],language,c.escapeHtmlWithBreaks);assert.deepEqual(kinds(html),expectedPauses);assert.equal(restore(html),note[1]);
 for(const [heading,source,body]of [['other',note[2],note[1]],['anhalten','[RW: Oper]',note[1]],['anhalten',note[2],note[1].replace('nicht etwa eine Fermate','eine lange Fermate')]])assert.equal(kinds(c.renderDictionaryNotationText(body,heading,source,language)).length,0,'Strict dictionary quotation context');
 const unsafe='<script>alert(1)</script>\n'+note[1]+'\n<img onerror="x"> & 𝄐';
 const safe=c.renderDictionaryNotationText(unsafe,note[0],note[2],language,c.escapeHtmlWithBreaks);assert(!/<script>|<img onerror/.test(safe));assert.deepEqual(kinds(safe),expectedPauses);assert.equal(restore(safe),unsafe,'Escape both sides of the signs, preserve line breaks, and leave unrelated music symbols literal');
 if(language==='en'){
  const translation='Here the symbol 𝄐 indicates only a brief pause at the barline, not a fermata';assert(note[1].includes(translation));
  for(const body of [note[1].replace(translation,translation.replace('brief','long')),translation,note[1].replace('nicht etwa eine Fermate','eine lange Fermate')]){
   const rendered=c.renderDictionaryNotationText(body,note[0],note[2],language,c.escapeHtmlWithBreaks);assert.equal(kinds(rendered).length,body.includes('nicht etwa eine Fermate')?1:0,'Changed translation or missing approved quotation never authorises a second sign');assert.equal(restore(rendered),body);
  }
  assert.equal(kinds(c.renderDictionaryNotationText(note[1],note[0],note[2],'ja')).length,1,'The English bridge is language-specific');
  const quote='𝄐 bedeutet hier nur ein kurzes Anhalten auf dem Taktstrich und nicht etwa eine Fermate.';
  const reversed=translation+'\n'+quote;const rendered=c.renderDictionaryNotationText(reversed,note[0],note[2],language,c.escapeHtmlWithBreaks);assert.deepEqual(kinds(rendered),['short-pause'],'Only a following translation is approved');assert.equal(restore(rendered),reversed);
 }
 window.appData.dic_notes=notes;assert(!music.test(visible(window.searchTermsLocal('anhalten'))));assert.equal(JSON.stringify(notes),before);
 c.oneDefinition=[note];vm.runInContext('renderDictionaryList(oneDefinition);',c);assert.equal(dynamicList.children.length,1);const body=dynamicList.children[0].children[1].innerHTML;assert.deepEqual(kinds(body),expectedPauses);assert.equal(restore(body),note[1],'Dynamic dictionary preserves source text and renders quotation');
 const dictionary=read(prefix+'mahler-search-app/dic.html'),position=dictionary.indexOf('<div class="row" id="term-anhalten">'),next=dictionary.indexOf('<div class="row" id=',position+1),section=dictionary.slice(position,next);
 assert.equal(kinds(section).filter(k=>k==='short-pause').length,expectedPauses.length);assert(!music.test(visible(section)),'Generated dictionary definition uses same renderer');
 const gm1550=all.GM.find(r=>r.data==='M-b1-t1-380-chor&'),score=window.formatGmTranslation(gm1550.ja,gm1550);assert.equal(kinds(score).filter(k=>k==='gm1550-example').length,1);
 const svg=decodeURIComponent(score.match(/src="data:image\/svg\+xml,([^"]*)"/)[1]);assert(svg.includes('M8 62 H212')&&!svg.includes('H131.6'));assert(svg.includes('data-pitch="G2"'));assert(!svg.includes('fill="white"'));
 }
 console.log('Notation completeness: '+symbolRows+' symbol-bearing JA/EN fields, '+paths+' actual search paths, strict contexts, stable ordering, dictionary prose and continuous transparent G2 staff passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
