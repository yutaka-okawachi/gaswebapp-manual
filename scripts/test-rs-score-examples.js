'use strict';
const {legacyDirectionRows}=require('./test-utils/score-example-fixtures');
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const specs=[
 {kind:'gm325-example',file:'mahler',query:'Trillerkette',data:'M-2-5-55-dir&',de:"Anmerk. f. d. Dirigenten : hier, wie bei der folgende gleichartigen Stelle ist darauf zu achten, dass sich die Triller der 1. u. 2. Geigen dicht an einander schliessen, und keine Pause dazwischen entsteht (eine 'Trillerkette') also so:"},
 {kind:'rs651-example',file:'richard_strauss',query:'pultweise',Oper:'feuersnot',Aufzug:'',Szene:'',page:320,de:'vielleicht pultweise derart zu teilen ～ etc.'},
 {kind:'rs782-example',file:'richard_strauss',query:'Aufstellung',Oper:'salome',Aufzug:'',Szene:4,page:287,de:'Aufstellung der 4 Pauken: linke H. rechte Hand'}
];
const images=(html,kind)=>[...html.matchAll(/<img\b[^>]*data-notation="([^"]+)"[^>]*src="data:image\/svg\+xml,([^"]*)"[^>]*>/g)].filter(m=>m[1]===kind).map(m=>decodeURIComponent(m[2]));
const equalContext=(r,s)=>r.de.normalize('NFC')===s.de.normalize('NFC')&&(s.data?r.data===s.data:['Oper','Aufzug','Szene','page'].every(k=>String(r[k]??'')===String(s[k]??'')));
const count=(s,p)=>(s.match(p)||[]).length;
let scenarios=0;
for(const language of ['ja','en']){
 const prefix=language==='en'?'en/':'',notice={hidden:false};
 const window={addEventListener(){},appData:{dic_terms_index:JSON.parse(read(prefix+'mahler-search-app/data/dic_terms_index.json'))},location:{pathname:'/'+prefix+'mahler-search-app/rs_terms_search.html',search:''}};
 const document={documentElement:{lang:language},getElementById:id=>id==='dictionaryExampleAliasNotice'?notice:null};
 const c=vm.createContext({window,document,URL,URLSearchParams,console,setTimeout,clearTimeout,navigator:{userAgent:'test'}});vm.runInContext(read(prefix+'mahler-search-app/js/app.js'),c);
 const all=Object.fromEntries(['mahler','richard_strauss'].map(f=>[f,legacyDirectionRows(JSON.parse(read(prefix+'mahler-search-app/data/'+f+'.json')))]));
 for(const spec of specs){
  window.appData.dic_terms_index=JSON.parse(read(prefix+'mahler-search-app/data/dic_terms_index.json'));
  const pool=all[spec.file],row=pool.find(r=>equalContext(r,spec));assert(row);const original=JSON.stringify(pool),html=window.formatNotationTranslation(row.ja,row),found=images(html,spec.kind);assert.equal(found.length,1,'Exactly one diagram after JA/EN translation');
  assert(html.startsWith(c.escapeHtmlWithBreaks(row.ja)),'Preserve complete translation');assert.equal(images(window.linkTermsInTranslation(row.de,{},row),spec.kind).length,1,'Exactly one diagram in German source too');
  const svg=found[0];assert(svg.includes('SIL OPEN FONT LICENSE'));assert(!/<text\b|font-family|fill="white"|<script\b|foreignObject/.test(svg));
  if(spec.kind==='gm325-example'){
   assert(svg.includes('viewBox="0 0 300 100"'));assert.equal(count(svg,/data-duration="quarter"/g),4);assert.equal(count(svg,/data-ornament="trill"/g),4);assert.equal(count(svg,/data-after-notes="thirty-second-pair"/g),4);assert.equal(count(svg,/data-grace="thirty-second"/g),8);assert.equal(count(svg,/data-beam="thirty-second"/g),12);assert.equal(count(svg,/data-accidental="natural"/g),2);assert.equal(count(svg,/data-clef=/g),0);assert.equal(count(svg,/data-slur=/g),0);
   for(const [x,y,pitch]of [[30,38,'C6'],[99,44,'A5'],[168,50,'F5'],[237,56,'D5']])assert(svg.includes('data-pitch="'+pitch+'" cx="'+x+'" cy="'+y+'"'));
   for(const y of [50,56,62,68,74])assert(svg.includes('M8 '+y+' H292'));assert(svg.includes('M292 50 V74'));
  }else if(spec.kind==='rs651-example'){
   assert(svg.includes('viewBox="0 0 480 112"'));assert.equal(count(svg,/data-notehead="black"/g),16);assert.equal(count(svg,/data-duration="sixteenth-pair"/g),8);assert.equal(count(svg,/data-beam="sixteenth"/g),16);assert.equal(count(svg,/data-rest="eighth"/g),8);assert.equal(count(svg,/data-slur=/g),8);assert.equal(count(svg,/data-accidental=/g),11);assert(svg.includes('M436 38 V62'));assert(svg.includes('data-label="etc."'));
   const upper=[[65,68],[62,65],[56,59],[53,56]],lower=[[62,65],[59,62],[56,59],[50,53]];for(let i=0;i<4;i++)for(const [x,ys]of [[48+i*102,upper[i]],[96+i*102,lower[i]]])for(let n=0;n<2;n++)assert(svg.includes('cx="'+(x+n*20)+'" cy="'+ys[n]+'"'));
   assert(html.includes('rs-score-example-scroll')&&html.includes('tabindex="0"'));
  }else{
   assert(svg.includes('viewBox="0 0 310 104"'));assert.equal(count(svg,/data-notehead="black"/g),4);assert.equal(count(svg,/data-duration="quarter"/g),4);assert.equal(count(svg,/data-accidental="flat"/g),2);assert.equal(count(svg,/data-barline=/g),0);
   for(const [x,y]of [[57,56],[127,50],[197,53],[267,59]])assert(svg.includes('cx="'+x+'" cy="'+y+'"'));
   for(const label of ['linke H.','l. H.','rechte H.','rechte Hand'])assert(svg.includes('data-label="'+label+'"'));
  }
  for(const changed of [{de:row.de+' changed'},...(spec.data?[{data:'M-2-5-56-dir&'}]:[{Oper:'different'},{Aufzug:1},{Szene:9},{page:row.page+1}])])assert.equal(images(window.formatNotationTranslation(row.ja,{...row,...changed}),spec.kind).length,0,'Strict full context isolates unrelated rows');
  for(const patch of [{de:row.de.normalize('NFD')},{whom:'another translated target'},{sourceRow:1,__row:999999}])assert.equal(images(window.formatNotationTranslation(row.ja,{...row,...patch}),spec.kind).length,1,'NFC, translated target and physical row independence');
  const unrelated={...row,de:row.de+' unrelated'};for(const rows of [[unrelated,...pool],[...pool].reverse(),pool.filter(r=>r===row||r===unrelated)]){
   assert.equal(rows.filter(r=>images(window.formatNotationTranslation(r.ja,r),spec.kind).length===1).length,1,'Insert/delete/reorder preserves exactly the intended item');scenarios++;
  }
  window.appData[spec.file]=pool;
  for(const source of ['', '?source=dictionary_example&q='+encodeURIComponent(spec.query)]){
   window.location.search=source;
   for(let repeat=0;repeat<3;repeat++){
    const terms=spec.file==='mahler'?window.searchMahlerTermsLocal(spec.query,{},'partial'):window.searchRSTermsLocal(spec.query,{},'partial');assert.equal(images(terms,spec.kind).length,2,'One diagram per field in actual bundle terms and dictionary-example route');scenarios++;
   }
  }
  window.location.search='';
  window.appData.dic_terms_index={}; // Isolate work rendering from unrelated dictionary-link expansion across every row.
  if(spec.file==='richard_strauss')for(const rows of [pool,pool.filter(r=>r.Oper===row.Oper),[row]])assert.equal(images(c.formatGenericResults([...rows]),spec.kind).length,2,'All works, selected work and page filtering use same renderer');
  else for(const works of [['ALL'],[Object.keys(window.aMapping).find(k=>window.aMapping[k]==='2')]])assert.equal(images(window.searchMahlerDataLocal(works,['ALL_GLOBAL'],true),spec.kind).length,2);
  assert.equal(JSON.stringify(pool),original,'Canonical data unchanged');
  const shardDirectory=prefix+'mahler-search-app/data/dictionary-examples',shardPrefix=spec.file==='mahler'?'gm-':'rs-';
  const shardRows=fs.readdirSync(path.join(root,shardDirectory)).filter(f=>f.startsWith(shardPrefix)).flatMap(f=>legacyDirectionRows(JSON.parse(read(shardDirectory+'/'+f)))).filter(r=>equalContext(r,spec));
  assert(shardRows.length>0,'Target is present in actual dictionary-example shard data');
  for(const shardRow of shardRows)assert.equal(images(window.formatNotationTranslation(shardRow.ja,shardRow),spec.kind).length,1,'Actual shard row retains complete stable context');
  const unsafe={...row,ja:'<script>alert(1)</script> & '+row.ja};const safe=window.formatNotationTranslation(unsafe.ja,unsafe);assert(!safe.includes('<script>'));assert(safe.includes('&lt;script&gt;'));
 }
 const css=read(prefix+'mahler-search-app/css/common.css');assert(/\.result-content\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere/.test(css),'Work-result flex item can shrink around a scrollable diagram');assert(/rs-score-example-scroll\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto/.test(css));assert(/rs-score-example-rs651\s*\{[^}]*width:\s*29.6em;[^}]*height:\s*auto;[^}]*max-width:\s*none/.test(css));assert(/rs-score-example-rs782\s*\{[^}]*width:\s*19.1em;[^}]*height:\s*auto;[^}]*max-width:\s*100%/.test(css));
}
console.log('Approved score examples: JA/EN exact geometry, GM325 thirty-second after-notes, all/work/terms/examples routes, '+scenarios+' repeat/order scenarios, strict contexts, unchanged data and scroll containment passed.');
