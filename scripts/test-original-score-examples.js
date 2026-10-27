'use strict';
const {legacyDirectionRows}=require('./test-utils/score-example-fixtures');
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const specs=[
 {file:'mahler',data:'M-2-5-55-dir&',kind:'gm325-example'},
 {file:'mahler',data:'M-5-3-136-dir&',kind:'motif-two'},
 {file:'mahler',data:'M-5-3-283-all&',kind:'motif-one'},
 {file:'mahler',data:'M-b1-t1-380-chor&',kind:'gm1550-example'},
 {file:'richard_strauss',Oper:'feuersnot',page:320,de:'vielleicht pultweise derart zu teilen ～ etc.',kind:'rs651-example'},
 {file:'richard_strauss',Oper:'salome',page:287,de:'Aufstellung der 4 Pauken: linke H. rechte Hand',kind:'rs782-example'}
];
const decoded=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const images=(html,kind)=>[...html.matchAll(/<img\b[^>]*data-notation="([^"]+)"[^>]*src="data:image\/svg\+xml,([^"]*)"[^>]*>/g)].filter(m=>m[1]===kind).map(m=>decodeURIComponent(m[2]));
const restored=html=>decoded(html.replace(/<img\b[^>]*data-notation="([^"]+)"[^>]*title="([^"]*)"[^>]*>/g,(_,kind,title)=>kind.startsWith('motif-')?title:'').replace(/<[^>]*>/g,'')).trim();
const visible=html=>decoded(html.replace(/<[^>]*>/g,''));
const music=/[\u{1D100}-\u{1D1FF}♩♪♫♬]/u;
let audited=0,paths=0;
for(const language of ['ja','en']){
 const prefix=language==='en'?'en/':'',window={addEventListener(){},appData:{dic_terms_index:{}},location:{pathname:'/'+prefix+'mahler-search-app/terms_search.html',search:''}};
 const c=vm.createContext({window,document:{documentElement:{lang:language},getElementById:id=>id==='dictionaryExampleAliasNotice'?{hidden:false}:null},URL,URLSearchParams,console,setTimeout,clearTimeout,navigator:{userAgent:'test'}});vm.runInContext(read(prefix+'mahler-search-app/js/app.js'),c);
 const all=Object.fromEntries(['mahler','richard_wagner','richard_strauss'].map(file=>[file,legacyDirectionRows(JSON.parse(read(prefix+'mahler-search-app/data/'+file+'.json')))]));
 for(const [file,rows]of Object.entries(all))for(const row of rows)if(music.test(row.de)){
  const html=window.linkTermsInTranslation(row.de,{},row);assert(!music.test(visible(html)),language+'/'+file+' leaves a raw music symbol in German: '+row.de);audited++;
 }
 for(const spec of specs){
  const pool=all[spec.file],row=pool.find(r=>spec.data?r.data===spec.data:r.Oper===spec.Oper&&r.page===spec.page&&r.de===spec.de);assert(row);const before=JSON.stringify(row);
  const original=window.linkTermsInTranslation(row.de,{},row),translation=window.formatNotationTranslation(row.ja,row);
  assert.equal(images(original,spec.kind).length,1,'Exactly one score in the German field');assert.equal(images(translation,spec.kind).length,1,'Exactly one score in the JA/EN field');
  assert.equal(images(original,spec.kind)[0],images(translation,spec.kind)[0],'German/translation share exactly the approved SVG');
  assert.equal(restored(original),row.de,'All original German prose, labels, punctuation and placeholder text survive display');
  assert.equal(restored(translation),row.ja.trim(),'All translated prose survives display');
  for(const form of ['NFC','NFD'])assert.equal(images(window.linkTermsInTranslation(row.de.normalize(form),{},{...row,de:row.de.normalize(form)}),spec.kind).length,1);
  if(!spec.kind.startsWith('motif-'))assert.equal(images(window.linkTermsInTranslation(row.de.slice(0,-1),{},row),spec.kind).length,0,'Partial source fragments never append the complete diagram');
  for(const change of [{de:row.de+' changed'},...(spec.data?[{data:row.data+'different'}]:[{Oper:'another'},{Aufzug:99},{Szene:99},{page:row.page+1}])])assert.equal(images(window.linkTermsInTranslation(row.de,{}, {...row,...change}),spec.kind).length,0,'Same words in another context do not receive a score');
  for(const rows of [[{...row,de:'unrelated'},row],[row,{...row,de:'unrelated'}],[row]])assert.equal(rows.filter(r=>images(window.linkTermsInTranslation(r.de,{},r),spec.kind).length===1).length,1,'Row insert/delete/reorder remains stable');
  const cloned={...row,__row:0,sourceRow:99999,whom:'translated target',準備状態:'保留'};assert.equal(images(window.linkTermsInTranslation(cloned.de,{},cloned),spec.kind).length,1);
  window.appData[spec.file]=[row];
  for(const source of ['', '?source=dictionary_example&q='+encodeURIComponent(row.de)]){
   window.location.search=source;
   for(let n=0;n<2;n++){
    const html=spec.file==='mahler'?window.searchMahlerTermsLocal(row.de,{},'partial'):window.searchRSTermsLocal(row.de,{},'partial');assert.equal(images(html,spec.kind).length,2,'Term/example result has one score in each of two fields');assert(!/<img[^>]*<span/.test(html),'Highlighting cannot corrupt image markup');paths++;
   }
  }
  window.location.search='';
  if(spec.file==='richard_strauss')assert.equal(images(c.formatGenericResults([row]),spec.kind).length,2,'Work/page result includes source and translation scores');
  else {
   assert.equal(images(window.searchMahlerDataLocal(['ALL'],['ALL_GLOBAL'],true),spec.kind).length,2,'All-work search includes both fields');
   const work=row.data.split('-')[1],choice=Object.keys(window.aMapping).find(k=>window.aMapping[k]===work);assert.equal(images(window.searchMahlerDataLocal([choice],['ALL_GLOBAL'],true),spec.kind).length,2,'Selected-work search includes both fields');
  }
  assert.equal(JSON.stringify(row),before,'German, translation, normalized key and context are never mutated');
 }
 const unsafe='<script>alert(1)</script>';assert.equal(window.linkTermsInTranslation(unsafe,{}, {de:unsafe,data:'unapproved'}),'&lt;script&gt;alert(1)&lt;/script&gt;');
}
console.log('Original score examples: 6 examples × JA/EN, '+paths+' real term/example searches, '+audited+' German music-symbol fields audited; preserved prose/normalization, exact SVG reuse, row stability and strict context isolation passed.');
