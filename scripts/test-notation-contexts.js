'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const tables={GM:'mahler',RW:'richard_wagner',RS:'richard_strauss'};
const databases={};for(const language of ['ja','en'])databases[language]=Object.fromEntries(Object.entries(tables).map(([tab,file])=>[tab,JSON.parse(read((language==='en'?'en/':'')+'mahler-search-app/data/'+file+'.json'))]));
const fixture=vm.createContext({window:{}});vm.runInContext(read('frontend/notation-contexts.js'),fixture);const descriptors=JSON.parse(JSON.stringify(fixture.window.MUSIC_NOTATION_CONTEXTS));
assert.equal(descriptors.length,82);assert.equal(descriptors.filter(r=>r.tab==='GM').length,75);
assert.deepEqual(descriptors.find(r=>r.tab==='GM'&&r.sourceRow===1099).tokens.map(t=>t[1]),['eighth'],'Eighth-note decomposition does not authorise a standalone quarter note');
assert.deepEqual(descriptors.find(r=>r.tab==='GM'&&r.sourceRow===2601).tokens.map(t=>t[1]),['dotted-quarter','half'],'Only the dotted quarter is present at the left of 2601');
const identity=(a,b)=>a.data!==undefined?a.data===b.data&&a.de.normalize('NFC')===b.de.normalize('NFC'):['Oper','Aufzug','Szene','page'].every(k=>String(a[k]??'')===String(b[k]??''));
const svgImages=html=>[...html.matchAll(/src="data:image\/svg\+xml,([^"]*)"/g)].map(m=>decodeURIComponent(m[1]));
const kinds=html=>[...html.matchAll(/data-notation="([^"]+)"/g)].map(m=>m[1]);
const excluded={GM:[37,1920,338,570,930,965,1354,2084,2590,325,582],RW:[4642,349,410,742,832,2704,3128,3908,5428],RS:[651,727,782,5052]};
let checks=0;
for(const language of ['ja','en']){
 const window={addEventListener(){},appData:{dic_terms_index:{}},location:{pathname:'/mahler-search-app/terms_search.html',search:''},aReverseMap:{},aMapping:{},dReverseMap:{},dMapping:{}};
 const c=vm.createContext({window,document:{documentElement:{lang:language}},console,URLSearchParams,setTimeout,clearTimeout,navigator:{userAgent:'test'}});vm.runInContext(read('mahler-search-app/js/app.js'),c);
 const originals=new Map();
 for(const descriptor of descriptors){
  const pool=databases[language][descriptor.tab];const source=pool.find(r=>identity(descriptor,r)&&r.de.normalize('NFC')===descriptor.de.normalize('NFC'))||(descriptor.tab==='RS'&&descriptor.sourceRow===726?pool.find(r=>identity(descriptor,r)):undefined);assert(source,descriptor.tab+descriptor.sourceRow+' has stable location');
  // RS726 is the sole separately authorised Sheet spelling correction. Its published
  // location/translation also grounds this fixture before the next ordinary sync.
  if(descriptor.tab!=='RS')assert.equal(source.de,descriptor.de);
  const row={...source,de:descriptor.de,de_normalized:c.normalizeString(descriptor.de),準備状態:'保留'},before=JSON.stringify(row);
  const html=window.linkTermsInTranslation(row.de,{},row);assert(kinds(html).length>0,descriptor.tab+descriptor.sourceRow);
  originals.set(descriptor.tab+descriptor.sourceRow,{row,html});
  for(const form of ['NFC','NFD']){
   const text=row.de.normalize(form),normalizedRow={...row,de:text};
   assert.deepEqual(kinds(window.linkTermsInTranslation(text,{},normalizedRow)),kinds(html),'Canonical music sequences and German accents remain renderable');checks++;
  }
  assert.equal(window.linkTermsInTranslation(row.de,{},Object.fromEntries(Object.entries(row).reverse())),html,'Named-field lookup ignores column/key order');
  const translated=window.formatNotationTranslation(row.ja,row);
  if(!/[𝅝𝅗𝅥𝅘𝅥𝅘𝅥𝅮𝄐𝄌♩＋+^>＞|/\\↓＊Θ]|(?:\btr\b)|\bC\b/u.test(row.ja))assert.equal(kinds(translated).length,0,'Spelled-out note names do not create images');
  const unapproved={...row,de:row.de+' changed context'};assert.equal(kinds(window.linkTermsInTranslation(unapproved.de,{},unapproved)).length,0,'Changed source context is not a blanket replacement');
  if(descriptor.tab!=='GM'){
   const key=tables[descriptor.tab];window.appData[key]=[row];const meta={};const terms=c.searchGenericTermsLocal(row.de,key,descriptor.tab,meta,'partial');assert.equal(meta.resultCount,1);assert(terms.includes('data-notation='));
   const work=c.formatGenericResults([row]);assert(work.includes('data-notation='));
   assert(!/<img[^>]*<span/.test(terms),'Highlighting never rewrites SVG attributes');checks+=2;
  }
  assert.equal(JSON.stringify(row),before,'German/normalization/status/location are unchanged');checks++;
 }
 for(const [id,expected]of Object.entries({GM2602:['dotted-quarter','eighth-triplet-below'],GM654:['quarter','half'],GM651:['quarter','dotted-quarter'],GM652:['quarter','dotted-quarter'],GM2601:['dotted-quarter','half'],GM2231:['half','quarter'],GM2589:['half','quarter'],GM2569:['quarter','eighth','eighth','eighth'],GM2598:['eighth','eighth','eighth','quarter'],GM2600:['eighth','eighth','eighth','quarter'],RS726:['quarter','quarter']}))assert.deepEqual(kinds(originals.get(id).html),expected,id+' preserves the exact order and duration');
 for(const id of ['GM2569','GM2598','GM2600'])assert(!originals.get(id).html.includes('triplet'),'Ordinary three-note sequences never acquire a triplet 3');
 assert(svgImages(originals.get('GM2602').html)[1].includes('data-tuplet-position="below"'),'GM2602 reproduces the source triplet numeral below the beamed group');
 assert(originals.get('GM2589').html.includes('die früher die'),'Existing die/wie wording remains unchanged');
 assert(originals.get('GM603').html.includes('fp'),'Dynamic fp is not transformed');
 for(const id of ['RW364','RW841','RW865','RW1025','RW1219']){const html=originals.get(id).html;assert.deepEqual(kinds(html),['circle-cross-marker']);assert(!/coda|D\.S\.|D\.C\./i.test(html),'No added navigation meaning');}
 assert.equal(originals.get('RW1025').row.Aufzug,'III zu Seite 233');
 if(language==='ja')assert.equal(kinds(window.formatNotationTranslation(originals.get('RW841').row.ja,originals.get('RW841').row)).length,0,'No sign is added to a translation that has no sign');
 for(const id of ['RW865','RW1219'])assert(window.formatNotationTranslation(originals.get(id).row.ja,originals.get(id).row).includes(language==='en'?'pp.':'p.'),'Page abbreviations remain text');
 const time=originals.get('RW2106');assert.deepEqual(kinds(time.html),['time-signature-c']);assert(time.html.includes('piano'));assert.equal(kinds(window.formatNotationTranslation('Cadenza at C, piano',time.row)).length,1,'Only standalone C is a time signature');
 for(const [tab,numbers]of Object.entries(excluded))for(const number of numbers){const japanese=databases.ja[tab][number-2];const row=language==='ja'?japanese:databases.en[tab].find(r=>identity(japanese,r)&&r.de===japanese.de);assert(row,tab+number);assert.equal(window.linkTermsInTranslation(row.de,{},row),c.escapeHtmlWithBreaks(row.de),tab+number+' excluded source remains literal');checks++;}
 assert.equal(window.linkTermsInTranslation('* p pp f fp 3/4 8va > C tr',{},{data:'__proto__',de:'unknown'}),'* p pp f fp 3/4 8va &gt; C tr');
 for(const {html}of originals.values())for(const svg of svgImages(html))assert(!/<text\b|font-family|<script\b|foreignObject/.test(svg),'Every added notation is font-independent vector geometry');
 // Actual GM page override, including dictionary-example return paths.
 const inline=[...read('mahler-search-app/terms_search.html').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).find(x=>x.includes('Override/Define searchMahlerTermsLocal'));vm.runInContext(inline,c);
 for(const descriptor of descriptors.filter(r=>r.tab==='GM')){const {row}=originals.get('GM'+descriptor.sourceRow);window.appData.mahler=[row];const html=window.searchMahlerTermsLocal(row.de,{},'partial');assert(html.includes('data-notation='));checks++;}
}
console.log('Notation contexts: '+checks+' scenarios; 75 GM + 7 opera contexts, exact positions, ordered durations, literal exclusions, boundaries, preserved text and result paths passed.');
