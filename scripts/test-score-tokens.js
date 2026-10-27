'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const specs=[['mahler','M-2-5-55-dir&','mahler-trill-chain','gm325-example'],['mahler','M-b1-t1-380-chor&','mahler-editorial-g2','gm1550-example'],['richard_strauss','feuersnot','feuersnot-desk-division','rs651-example'],['richard_strauss','salome','salome-timpani-layout','rs782-example']];
const kinds=html=>[...html.matchAll(/data-notation="([^"]+)"/g)].map(m=>m[1]);
const count=(html,kind)=>kinds(html).filter(k=>k===kind).length;
let cases=0;
for(const language of ['ja','en']){
 const prefix=language==='en'?'en/':'',window={addEventListener(){},appData:{dic_terms_index:{}},location:{pathname:'/'+prefix+'mahler-search-app/terms_search.html',search:''}};
 const c=vm.createContext({window,document:{documentElement:{lang:language},getElementById:()=>null},URL,URLSearchParams,console,setTimeout,clearTimeout,navigator:{userAgent:'test'}});vm.runInContext(read(prefix+'mahler-search-app/js/app.js'),c);
 for(const [file,location,id,kind]of specs){
  const rows=JSON.parse(read(prefix+'mahler-search-app/data/'+file+'.json')),row=rows.find(r=>file==='mahler'?r.data===location:r.Oper===location&&r.de.startsWith(location==='feuersnot'?'vielleicht pultweise':'Aufstellung der 4 Pauken'));assert(row);
  const token='[[score:'+id+']]',modern={...row,de:id==='feuersnot-desk-division'?row.de.replace('～ etc.',token):row.de+' '+token,ja:row.ja+' '+token,en:(row.en||row.ja)+' '+token};
  assert.equal(count(window.linkTermsInTranslation(modern.de,{},modern),kind),1);assert.equal(count(window.formatNotationTranslation(modern.ja,modern),kind),1);
  assert(!window.linkTermsInTranslation(modern.de,{},modern).includes('[[score:'),'Known IDs do not leak through image tooltips');
  const positioned=window.formatNotationTranslation('Before '+token+' after',modern);assert(positioned.startsWith('Before '));assert(positioned.endsWith(' after'));assert.equal(count(positioned,kind),1,'Explicit insertion works within a sentence');
  assert.equal(count(window.linkTermsInTranslation(modern.de+' '+token,{},modern),kind),1,'Duplicate token does not duplicate artwork');
  assert.equal(count(window.formatNotationTranslation(row.ja,modern),kind),1,'Migrated source and old translation remain compatible');
  assert.equal(count(window.formatNotationTranslation(modern.ja,row),kind),1,'Migrated translation and old source remain compatible');
  assert.equal(count(window.linkTermsInTranslation(row.de,{},row),kind),1,'Legacy context fallback remains available');
  assert.equal(c.normalizeString(modern.de),c.normalizeString(row.de),'Score ID is excluded; RS651 preserves its legacy etc. search text');assert.equal(c.normalizeForId(row.de+' '+token),c.normalizeForId(row.de),'Adding only a token cannot change dictionary anchor identity');
  const changed={...modern,de:'Revised German prose '+token};assert.equal(count(window.linkTermsInTranslation(changed.de,{},changed),kind),1,'Explicit ID survives source prose edits at the intended location');
  const wrong=file==='mahler'?{...modern,data:'M-wrong-location&'}:{...modern,page:modern.page+1};assert.equal(count(window.linkTermsInTranslation(modern.de,{},wrong),kind),0,'Copied ID in another context is not rendered');
  window.appData[file]=[modern];const terms=file==='mahler'?window.searchMahlerTermsLocal(''+row.de.slice(0,20),{},'partial'):window.searchRSTermsLocal(row.de.slice(0,20),{},'partial');assert.equal(count(terms,kind),2,'Real search returns one score per field');
  for(const mixed of [token+' <img src=x onerror=alert(1)>',token+' [[score:unknown-artwork]]']){const html=window.formatNotationTranslation(mixed,modern);assert.equal(count(html,kind),1);assert(!html.includes('<img src=x'));assert(!html.includes('onerror=alert(1)>'));if(mixed.includes('unknown-artwork')){assert(html.includes('unknown-artwork'));assert(html.includes('role="note"'));assert(html.includes(language==='en'?'Score example unavailable:':'譜例を表示できません:'));}}
  assert(!kinds(window.formatNotationTranslation('[[score:unknown-artwork]]',row)).length,'Unknown token suppresses implicit duplicate fallback and stays visible');cases+=13;
 }
 const notes=JSON.parse(read(prefix+'mahler-search-app/data/dic_notes.json')),note=notes.find(r=>r[0].startsWith('Ein Stab aus einem Glockenspiel')&&r[2]==='[H: KM1-1]'),id='hindemith-glockenspiel-fsharp5',token='[[score:'+id+']]',modern=[note[0].replace('(の譜例)',token),note[1]+' '+token,note[2]];
 assert.equal(count(c.renderDictionaryNotationText(modern[0],modern[0],modern[2],language),'glockenspiel-fsharp5'),1);assert.equal(count(c.renderDictionaryNotationText(modern[1],modern[0],modern[2],language),'glockenspiel-fsharp5'),1);
 assert.equal(count(c.renderDictionaryNotationText(note[1],modern[0],modern[2],language),'glockenspiel-fsharp5'),1,'Notes partial migration fallback');
 assert.equal(count(c.renderDictionaryNotationText(token+' '+token,modern[0],modern[2],language),'glockenspiel-fsharp5'),1);
 assert.equal(count(c.renderDictionaryNotationText(token,modern[0],'[GM]',language),'glockenspiel-fsharp5'),0,'Notes ID never becomes GM data');
 assert.equal(c.normalizeForId(note[0]),c.normalizeForId(modern[0]),'Notes anchor remains compatible after removing Japanese placeholder');
 window.appData.dic_notes=[modern];assert.equal(count(window.searchTermsLocal('Ein Stab aus einem Glockenspiel'),'glockenspiel-fsharp5'),2);
 assert(!kinds(window.searchTermsLocal(token)).length,'An ID alone is not a dictionary search term');
 const standalone=vm.createContext({});vm.runInContext(read('src/dictionary_example_shards.js'),standalone);assert.equal(standalone.normalizeDictionaryExampleTerm('Dirigent '+token),'dirigent');
 const modernNoteData=JSON.stringify(modern);for(const moved of [[['eilen','',''],modern],[modern],[[...modern],[...note]].reverse()])assert(moved.some(r=>JSON.stringify(r)===modernNoteData),'Row order is not a token identity');
 cases+=9;
}
console.log('Score tokens: '+cases+' JA/EN cases; five semantic IDs, old/new mixed data, word-search and anchor normalization, deduplication, unknown-ID safe fallback, context guards and preserved existing notation passed.');
